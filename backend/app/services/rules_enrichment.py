"""Service to enrich scanner results with scraped Malaysian trade policy data from Supabase."""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class RulesEnrichmentService:
    """Fetches and formats relevant Malaysian trade rules from Supabase cached content."""

    def __init__(self, supabase_client=None):
        self.supabase_client = supabase_client

    async def get_relevant_context(
        self,
        materials: list[str] | None = None,
        product_name: str | None = None,
        destination_country: str | None = None,
    ) -> str | None:
        """
        Query Supabase for relevant scraped content based on detected materials/product.

        Args:
            materials: List of detected materials from image analysis
            product_name: Detected product name
            destination_country: Destination country for export

        Returns:
            Formatted context string from scraped Malaysian trade sources, or None if not found
        """
        if not self.supabase_client:
            return None

        search_terms = self._build_search_terms(materials, product_name, destination_country)
        if not search_terms:
            return None

        try:
            # Fetch all scraped content (we'll filter client-side for better control)
            response = self.supabase_client.table("scraped_content").select("url, content").order(
                "scraped_at", desc=True
            ).limit(10).execute()

            if not response.data:
                logger.debug("No scraped content found in Supabase")
                return None

            # Search for relevant content
            relevant_snippets = self._search_snippets(response.data, search_terms)

            if not relevant_snippets:
                logger.debug(f"No relevant content found for terms: {search_terms}")
                return None

            # Format as context block
            return self._format_context(relevant_snippets)

        except Exception as e:
            logger.warning(f"Error fetching enrichment context: {e}")
            return None

    def _build_search_terms(
        self,
        materials: list[str] | None,
        product_name: str | None,
        destination_country: str | None,
    ) -> list[str]:
        """Build search terms from detected materials and product."""
        terms = []

        # Add materials
        if materials:
            terms.extend([m.lower().strip() for m in materials if m and isinstance(m, str)])

        # Add product name
        if product_name:
            product_lower = product_name.lower().strip()
            terms.append(product_lower)
            # Add first 2 words as search term
            words = product_lower.split()[:2]
            terms.extend(words)

        # Add country-specific terms
        if destination_country:
            terms.append(destination_country.lower().strip())

        # Add export-related terms
        terms.extend(["export", "customs", "permit", "restrictions", "prohibited"])

        # Deduplicate and clean
        terms = list(set(t for t in terms if t and len(t) > 2))

        return terms[:10]  # Limit to top 10 terms

    def _search_snippets(self, scraped_records: list[dict], search_terms: list[str]) -> list[dict]:
        """Search scraped content for relevant snippets matching search terms."""
        relevant = []

        for record in scraped_records:
            content = record.get("content", "").lower()
            url = record.get("url", "")

            # Count matching terms in this record
            match_count = sum(1 for term in search_terms if term in content)

            if match_count >= 2:  # At least 2 terms must match
                # Extract relevant snippets
                snippets = self._extract_snippets(record.get("content", ""), search_terms, max_length=300)

                if snippets:
                    relevant.append(
                        {
                            "url": url,
                            "snippets": snippets,
                            "match_count": match_count,
                        }
                    )

        # Sort by relevance (match count)
        relevant.sort(key=lambda x: x["match_count"], reverse=True)
        return relevant[:3]  # Return top 3 sources

    def _extract_snippets(
        self, content: str, search_terms: list[str], max_length: int = 300
    ) -> list[str]:
        """Extract relevant text snippets containing search terms."""
        snippets = []
        content_lower = content.lower()
        content_sentences = content.split(".")

        for sentence in content_sentences:
            # Check if sentence contains any search term
            if any(term in sentence.lower() for term in search_terms):
                snippet = sentence.strip()
                if snippet and len(snippet) > 20:
                    snippets.append(snippet[:max_length])

        return snippets[:2]  # Return up to 2 snippets per source

    def _format_context(self, relevant_snippets: list[dict]) -> str:
        """Format relevant snippets as a context block for the prompt."""
        if not relevant_snippets:
            return ""

        context_lines = ["[Malaysian Trade Policy Context from Scraped Sources]"]

        for source in relevant_snippets:
            url = source.get("url", "")
            snippets = source.get("snippets", [])

            if snippets:
                # Extract domain for readability
                domain = url.split("//")[-1].split("/")[0] if url else "Unknown source"
                context_lines.append(f"\nFrom {domain}:")

                for snippet in snippets:
                    context_lines.append(f"• {snippet.strip()}")

        return "\n".join(context_lines)

    async def search_policies(self, query: str, limit: int = 3) -> str | None:
        """
        Search scraped content for policies matching a free-form query.

        Args:
            query: Natural language query (e.g., "leather export requirements")
            limit: Max number of results to return

        Returns:
            Formatted context string with matching policies
        """
        if not self.supabase_client:
            return None

        query_terms = [t.lower().strip() for t in query.split() if t and len(t) > 2]
        if not query_terms:
            return None

        try:
            response = self.supabase_client.table("scraped_content").select("url, content").limit(
                20
            ).execute()

            if not response.data:
                return None

            relevant = self._search_snippets(response.data, query_terms)
            if not relevant:
                return None

            return self._format_context(relevant[:limit])

        except Exception as e:
            logger.warning(f"Error searching policies: {e}")
            return None
