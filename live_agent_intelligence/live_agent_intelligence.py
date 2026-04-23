from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any
from urllib import error, request

from agent2.glm_core import GLMArchitectCore
from .policy_sources_news import NEWS_FEED_SOURCES
from .policy_sources_websites import OFFICIAL_POLICY_WEBSITES


@dataclass(slots=True)
class PolicySignal:
    source_name: str
    source_type: str
    title: str
    url: str
    published_at: str | None
    snippet: str


@dataclass(slots=True)
class IntelligenceReport:
    topic: str
    generated_at: str
    summary: str
    rules: list[str]
    signals: list[PolicySignal]
    source_links: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "topic": self.topic,
            "generated_at": self.generated_at,
            "summary": self.summary,
            "rules": self.rules,
            "signals": [asdict(s) for s in self.signals],
            "source_links": self.source_links,
        }


class LiveAgentIntelligence:
    """Research and retrieval agent for live policy context."""

    def __init__(self, glm: GLMArchitectCore, timeout_seconds: int = 12) -> None:
        self.glm = glm
        self.timeout_seconds = timeout_seconds

    def build_report(self, topic: str, max_signals: int = 8) -> IntelligenceReport:
        signals = self._collect_signals(topic)[:max_signals]

        if not signals:
            summary = "No live policy signals found. Continue with baseline rules and request manual confirmation."
            rules = [
                "Use baseline export workflow rules.",
                "Request user confirmation for any potentially changed regulation.",
            ]
            source_links = []
        else:
            summary, rules, source_links = self._summarize_signals(topic, signals)

        return IntelligenceReport(
            topic=topic,
            generated_at=datetime.now(timezone.utc).isoformat(),
            summary=summary,
            rules=rules,
            signals=signals,
            source_links=source_links,
        )

    def as_workflow_context(self, topic: str, max_signals: int = 8) -> dict[str, Any]:
        return self.build_report(topic=topic, max_signals=max_signals).to_dict()

    def _collect_signals(self, topic: str) -> list[PolicySignal]:
        signals: list[PolicySignal] = []

        for source in NEWS_FEED_SOURCES:
            signals.extend(self._fetch_feed_matches(source_name=source["name"], feed_url=source["url"], topic=topic))

        for site in OFFICIAL_POLICY_WEBSITES:
            snippet = self._fetch_page_snippet(site["url"], topic=topic)
            if snippet:
                signals.append(
                    PolicySignal(
                        source_name=site["name"],
                        source_type="website",
                        title=f"Policy context mention on {site['name']}",
                        url=site["url"],
                        published_at=None,
                        snippet=snippet,
                    )
                )

        return signals

    def _fetch_feed_matches(self, source_name: str, feed_url: str, topic: str) -> list[PolicySignal]:
        xml_text = self._safe_get_text(feed_url)
        if not xml_text:
            return []

        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            return []

        tokens = [t for t in re.split(r"\W+", topic.lower()) if t]
        if not tokens:
            tokens = [topic.lower()]

        out: list[PolicySignal] = []
        for item in root.findall(".//item"):
            title = self._xml_text(item, "title")
            link = self._xml_text(item, "link")
            pub_date = self._xml_text(item, "pubDate")
            description = self._xml_text(item, "description")
            hay = f"{title} {description}".lower()
            if any(t in hay for t in tokens):
                out.append(
                    PolicySignal(
                        source_name=source_name,
                        source_type="news",
                        title=title or "Untitled policy update",
                        url=link or feed_url,
                        published_at=pub_date,
                        snippet=self._clean_text(description)[:280],
                    )
                )
        return out

    def _summarize_signals(self, topic: str, signals: list[PolicySignal]) -> tuple[str, list[str], list[str]]:
        prompt = (
            "You are a Government Policy Analyst for Malaysia export compliance. "
            "Given latest policy signals, identify changes in the last 3 months that can impact export checklist decisions. "
            "Return JSON with keys: summary (string), rules (array of short actionable rules), source_links (array)."
        )
        context = {
            "topic": topic,
            "signals": [asdict(s) for s in signals],
        }

        out = self.glm.run_json(prompt, context=context)
        if out.ok and isinstance(out.data, dict):
            summary = str(out.data.get("summary", "Policy signals analyzed."))
            rules_raw = out.data.get("rules", [])
            links_raw = out.data.get("source_links", [])
            rules = [str(r) for r in rules_raw] if isinstance(rules_raw, list) else []
            links = [str(u) for u in links_raw] if isinstance(links_raw, list) else []
            if not links:
                links = [s.url for s in signals]
            if not rules:
                rules = ["Review the listed policy updates before approving current workflow stage."]
            return summary, rules, links

        fallback_summary = "Live policy signals found. Manual review recommended before compliance approval."
        fallback_rules = [
            "Cross-check permit requirements against latest MITI/RMCD updates.",
            "If source confidence is low, request user confirmation and retry retrieval.",
        ]
        fallback_links = [s.url for s in signals]
        return fallback_summary, fallback_rules, fallback_links

    def _fetch_page_snippet(self, url: str, topic: str) -> str | None:
        html = self._safe_get_text(url)
        if not html:
            return None
        text = self._clean_text(html)
        lower = text.lower()
        topic_lower = topic.lower().strip()
        if topic_lower and topic_lower in lower:
            idx = lower.index(topic_lower)
            start = max(0, idx - 120)
            end = min(len(text), idx + 160)
            return text[start:end].strip()
        return None

    def _safe_get_text(self, url: str) -> str | None:
        req = request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; BorderlessAI-PolicyResearch/1.0)",
                "Accept": "text/html,application/xml,text/xml,application/rss+xml,*/*",
            },
            method="GET",
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                content_type = response.headers.get("Content-Type", "")
                raw = response.read()
                if "charset=" in content_type:
                    encoding = content_type.split("charset=")[-1].split(";")[0].strip()
                else:
                    encoding = "utf-8"
                return raw.decode(encoding, errors="ignore")
        except (error.HTTPError, error.URLError, TimeoutError, ValueError):
            return None

    @staticmethod
    def _xml_text(node: ET.Element, tag_name: str) -> str:
        child = node.find(tag_name)
        if child is None or child.text is None:
            return ""
        return child.text.strip()

    @staticmethod
    def _clean_text(value: str) -> str:
        no_tags = re.sub(r"<[^>]+>", " ", value)
        return re.sub(r"\s+", " ", no_tags).strip()


def to_json_report(report: IntelligenceReport) -> str:
    return json.dumps(report.to_dict(), indent=2, ensure_ascii=True)
