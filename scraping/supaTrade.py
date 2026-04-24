import os
import json
import requests
import time
import warnings
from datetime import datetime, timedelta
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from google import genai
from supabase import create_client, Client

# Suppress SSL warnings
warnings.filterwarnings('ignore', message='Unverified HTTPS request')
import urllib3
urllib3.disable_warnings()

load_dotenv()

# ============================================
# MALAYSIAN TRADE POLICY EXPERT (WITH SUPABASE)
# ============================================

class supaTrade:
    """Reads multiple Malaysian trade/customs websites and combines knowledge with Supabase caching."""

    DEFAULT_URLS = [
        "https://ezhs.customs.gov.my/public-prob-export",
        "https://fta.miti.gov.my/index.php/pages/view/rcep", 
        "https://www.customs.gov.my/en/business/import-export/export/export-procedure",
        "https://lom.agc.gov.my/act-view.php?type=pua&no=P.U.%20%28A%29%20122/2023",
        "https://www.wcotradetools.org/en/harmonized-system",
    ]

    def __init__(self, use_supabase: bool = True):
        # Load API keys
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
        
        if not self.api_key:
            raise ValueError("❌ GEMINI_API_KEY not found in .env")
        
        self.client = genai.Client(api_key=self.api_key)
        self.all_content = {}
        self.chat = None
        self.use_supabase = use_supabase
        self.supabase = None
        
        # Initialize Supabase if enabled
        if self.use_supabase:
            self._init_supabase()
        
        print(f"🤖 Model: {self.model_name}")
        if self.use_supabase:
            print("💾 Supabase: Connected")

    def _init_supabase(self):
        """Initialize Supabase client and create tables if needed."""
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            print("⚠️  Supabase credentials missing - using in-memory mode")
            self.use_supabase = False
            return
        
        try:
            self.supabase = create_client(supabase_url, supabase_key)
            print("✅ Supabase initialized")
        except Exception as e:
            print(f"❌ Supabase init failed: {e}")
            self.use_supabase = False

    def scrape_url(self, url: str) -> str:
        """Scrape a single URL with caching check."""
        
        # Check cache first
        if self.supabase:
            cached = self._get_cached_content(url)
            if cached:
                print(f"   📦 Using cached ({len(cached)} chars)")
                return cached
        
        # Scrape fresh
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-MY,en;q=0.9,ms;q=0.8",
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=30, verify=False)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove junk
            for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript']):
                tag.decompose()
            
            # Try multiple content selectors
            main = (
                soup.find('main') or 
                soup.find('article') or 
                soup.find('div', class_='content') or 
                soup.find('div', id='content') or
                soup.find('body')
            )
            
            text = main.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in text.split('\n') if line.strip() and len(line.strip()) > 20]
            text = '\n'.join(lines)
            
            # Keep first 12000 chars per site
            if len(text) > 12000:
                text = text[:12000]
            
            # Cache in Supabase
            if self.supabase and text:
                self._cache_content(url, text)
            
            return text
            
        except Exception as e:
            print(f"   ❌ Scrape error: {e}")
            return ""

    def _get_cached_content(self, url: str) -> str:
        """Get cached content from Supabase if fresh enough."""
        try:
            result = self.supabase.table('scraped_content')\
                .select('content, scraped_at')\
                .eq('url', url)\
                .order('scraped_at', desc=True)\
                .limit(1)\
                .execute()
            
            if result.data:
                cached = result.data[0]
                scraped_at = datetime.fromisoformat(cached['scraped_at'])
                age = datetime.utcnow() - scraped_at
                
                # Use cache if less than 6 hours old
                if age < timedelta(hours=6):
                    return cached['content']
                else:
                    print(f"   ⚠️  Cache expired ({age.total_seconds()/3600:.1f}h old)")
        except Exception as e:
            print(f"   ⚠️  Cache check failed: {e}")
        
        return ""

    def _cache_content(self, url: str, content: str):
        """Store scraped content in Supabase."""
        try:
            # Check for changes
            previous = self.supabase.table('scraped_content')\
                .select('content')\
                .eq('url', url)\
                .order('scraped_at', desc=True)\
                .limit(1)\
                .execute()
            
            has_changed = True
            if previous.data:
                prev_content = previous.data[0]['content']
                if prev_content == content:
                    has_changed = False
            
            # Insert new record
            self.supabase.table('scraped_content').insert({
                'url': url,
                'content': content,
                'scraped_at': datetime.utcnow().isoformat(),
                'content_length': len(content),
                'has_changed': has_changed
            }).execute()
            
            # Log to history if changed
            if has_changed:
                self.supabase.table('scrape_history').insert({
                    'url': url,
                    'event': 'content_updated',
                    'content_length': len(content),
                    'scraped_at': datetime.utcnow().isoformat()
                }).execute()
                print(f"   📝 Content changed - logged to history")
            
        except Exception as e:
            print(f"   ⚠️  Cache save failed: {e}")

    def get_scrape_stats(self) -> dict:
        """Get statistics about scraped content."""
        if not self.supabase:
            return {"error": "Supabase not connected"}
        
        try:
            # Count total scrapes
            total = self.supabase.table('scraped_content')\
                .select('id', count='exact')\
                .execute()
            
            # Count unique URLs
            unique = self.supabase.table('scraped_content')\
                .select('url')\
                .execute()
            
            unique_urls = len(set(item['url'] for item in unique.data))
            
            # Get latest scrape time
            latest = self.supabase.table('scraped_content')\
                .select('scraped_at')\
                .order('scraped_at', desc=True)\
                .limit(1)\
                .execute()
            
            return {
                "total_records": total.count if hasattr(total, 'count') else len(total.data),
                "unique_urls": unique_urls,
                "latest_scrape": latest.data[0]['scraped_at'] if latest.data else None
            }
        except Exception as e:
            return {"error": str(e)}

    def _call_gemini_with_retry(self, prompt: str, max_retries: int = 5) -> str:
        """Call Gemini API with retry logic for 503 errors."""
        for attempt in range(max_retries):
            try:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt
                )
                return response.text
            except Exception as e:
                error_str = str(e)
                if "503" in error_str or "UNAVAILABLE" in error_str or "429" in error_str:
                    wait = (attempt + 1) * 10
                    print(f"   ⏳ Server busy. Retrying in {wait}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(wait)
                else:
                    raise e
        
        raise Exception("❌ All retries failed. Try again later.")

    def learn_all(self, urls: list = None, force_refresh: bool = False):
        """Scrape ALL websites and feed to Gemini."""
        if urls is None:
            urls = self.DEFAULT_URLS
        
        print("\n" + "="*60)
        print("🇲🇾 SCRAPING ALL MALAYSIAN TRADE POLICY WEBSITES")
        if self.use_supabase and not force_refresh:
            print("💾 Using Supabase cache (use force_refresh=True to bypass)")
        print("="*60)
        
        source_labels = {
            0: "Customs eZ-HS Portal (Tariff Codes)",
            1: "MITI RCEP FTA (Trade Agreement)", 
            2: "Customs Export Procedure (Step-by-Step)",
            3: "Federal Legislation P.U.(A)122/2023",
            4: "WCO Harmonized System (HS Codes)",
        }
        
        all_text_parts = []
        scraped_count = 0
        failed_sites = []
        cached_count = 0
        
        for i, url in enumerate(urls):
            label = source_labels.get(i, f"Source {i+1}")
            print(f"\n📖 [{i+1}/{len(urls)}] {label}")
            
            # Check if we're using cache
            if not force_refresh and self.supabase:
                cached = self._get_cached_content(url)
                if cached:
                    text = cached
                    cached_count += 1
                else:
                    text = self.scrape_url(url)
            else:
                text = self.scrape_url(url)
            
            if text and len(text) > 100:
                self.all_content[url] = text
                all_text_parts.append(f"=== SOURCE {i+1}: {label} ===\nURL: {url}\n\n{text}")
                scraped_count += 1
                print(f"   ✅ {'Cached' if (not force_refresh and self.supabase) else 'Scraped'} {len(text)} characters")
            else:
                failed_sites.append((i+1, label, url))
                print(f"   ❌ Insufficient content ({len(text)} chars)")
        
        print(f"\n📊 Results: {scraped_count}/{len(urls)} loaded ({cached_count} from cache)")
        
        if failed_sites:
            print("⚠️  Failed sites:")
            for num, label, url in failed_sites:
                print(f"   {num}. {label}: {url}")
        
        if scraped_count == 0:
            print("❌ No websites could be loaded!")
            return False
        
        # Save learning session to Supabase
        if self.supabase:
            self._save_learning_session(scraped_count, cached_count)
        
        # Combine all content
        combined_text = "\n\n" + "="*40 + "\n\n".join(all_text_parts)
        print(f"📦 Total combined: {len(combined_text)} characters")
        
        # Feed to Gemini with retry
        print("\n🧠 Teaching Gemini ALL policies...")
        
        prompt = f"""You are a Malaysian Trade & Customs Expert for SMEs. 

I am giving you documents from {scraped_count} Malaysian government websites:

{combined_text[:80000]}

IMPORTANT: You have now read ALL {scraped_count} documents. 
Remember them all. Answer questions based on these documents.
Cite which source your answer comes from.

Reply with: 'OK. I have read ALL {scraped_count} documents. I can answer questions about Malaysian trade policies.'"""

        response_text = self._call_gemini_with_retry(prompt)
        print(f"✅ {response_text[:200]}...")
        
        # Create chat session
        self.chat = self.client.chats.create(
            model=self.model_name,
            config={
                "system_instruction": f"You are a Malaysian Trade & Customs Expert. You have read {scraped_count} official documents. Answer based on them. Cite sources."
            }
        )
        
        # Prime the chat
        self.chat.send_message(f"Remember these documents:\n\n{combined_text[:50000]}")
        
        print(f"\n✅ ALL {scraped_count} websites loaded!")
        print("   Ready for questions.")
        return True

    def _save_learning_session(self, total: int, cached: int):
        """Log learning session to Supabase."""
        try:
            self.supabase.table('scrape_history').insert({
                'url': 'learning_session',
                'event': 'session_created',
                'content_length': total,
                'scraped_at': datetime.utcnow().isoformat(),
                'metadata': json.dumps({
                    'total_sources': total,
                    'from_cache': cached,
                    'model': self.model_name
                })
            }).execute()
        except Exception:
            pass

    def ask(self, question: str) -> str:
        """Ask a question and log to Supabase."""
        if not self.chat:
            return "⚠️ Load policies first with learn_all()"
        
        prompt = f"""Based on ALL {len(self.all_content)} Malaysian trade documents I gave you, answer:

{question}

Cite source. If not found, say so."""

        try:
            response = self.chat.send_message(prompt)
            answer = response.text
            
            # Log Q&A to Supabase
            if self.supabase:
                self._log_qa(question, answer)
            
            return answer
        except Exception as e:
            error_str = str(e)
            if "503" in error_str or "UNAVAILABLE" in error_str:
                print("⏳ Server busy, retrying once...")
                time.sleep(10)
                try:
                    response = self.chat.send_message(prompt)
                    return response.text
                except:
                    return "❌ Gemini is overloaded right now. Please try again in 1-2 minutes."
            return f"❌ Error: {e}"

    def _log_qa(self, question: str, answer: str):
        """Log Q&A to Supabase."""
        try:
            self.supabase.table('qa_history').insert({
                'question': question,
                'answer': answer[:500],
                'asked_at': datetime.utcnow().isoformat(),
                'sources_used': len(self.all_content)
            }).execute()
        except Exception:
            pass

    def show_sources(self):
        """Show all loaded sources."""
        print("\n" + "="*60)
        print(f"📚 LOADED {len(self.all_content)} SOURCES:")
        print("="*60)
        
        # Show Supabase stats if available
        if self.supabase:
            stats = self.get_scrape_stats()
            if 'error' not in stats:
                print(f"💾 Database: {stats['unique_urls']} unique URLs, {stats['total_records']} records")
                if stats['latest_scrape']:
                    print(f"🕒 Latest: {stats['latest_scrape']}")
        
        labels = {
            "ezhs.customs.gov.my": "1. Customs eZ-HS Portal",
            "fta.miti.gov.my": "2. MITI RCEP FTA",
            "www.customs.gov.my": "3. Customs Export Procedure",
            "lom.agc.gov.my": "4. Federal Legislation",
            "wcotradetools.org": "5. WCO Harmonized System",
        }
        for url in self.all_content.keys():
            for key, label in labels.items():
                if key in url:
                    print(f"   ✅ {label} ({len(self.all_content[url])} chars)")
                    break

    def chat_mode(self):
        """Interactive Q&A."""
        if not self.chat:
            print("⚠️ Load policies first!")
            return
        
        self.show_sources()
        
        print("\n" + "="*60)
        print("🇲🇾 MALAYSIAN TRADE EXPERT - ASK ANYTHING")
        print("="*60)
        print("   'exit' | 'sources' | 'summary' | 'stats'")
        print("="*60)
        
        while True:
            question = input("\n❓ You: ").strip()
            
            if question.lower() == 'exit':
                print("👋 Goodbye!")
                break
            elif question.lower() == 'sources':
                self.show_sources()
                continue
            elif question.lower() == 'stats':
                if self.supabase:
                    stats = self.get_scrape_stats()
                    print(json.dumps(stats, indent=2))
                else:
                    print("❌ Supabase not connected")
                continue
            elif question.lower() == 'summary':
                question = "Give a comprehensive summary of ALL documents covering key points from each source."
            
            print("\n🤖 Expert: ", end="", flush=True)
            answer = self.ask(question)
            print(answer)


if __name__ == "__main__":
    # Initialize with Supabase
    expert = supaTrade(use_supabase=True)
    
    # Learn with caching (uses stored data if fresh)
    if expert.learn_all():
        expert.chat_mode()