import os
import requests
import time
import warnings
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from google import genai

# Suppress SSL warnings
warnings.filterwarnings('ignore', message='Unverified HTTPS request')
import urllib3
urllib3.disable_warnings()

load_dotenv()

# ============================================
# MALAYSIAN TRADE POLICY EXPERT (MULTI-SOURCE)
# ============================================

class MalaysianTradeExpert:
    """Reads multiple Malaysian trade/customs websites and combines knowledge."""

    DEFAULT_URLS = [
        "https://ezhs.customs.gov.my/public-prob-export",
        "https://fta.miti.gov.my/index.php/pages/view/rcep", 
        "https://www.customs.gov.my/en/business/import-export/export/export-procedure",
        "https://lom.agc.gov.my/act-view.php?type=pua&no=P.U.%20%28A%29%20122/2023",
        "https://www.wcotradetools.org/en/harmonized-system",
    ]

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
        
        if not self.api_key:
            raise ValueError("❌ GEMINI_API_KEY not found in .env")
        
        self.client = genai.Client(api_key=self.api_key)
        self.all_content = {}
        self.chat = None
        
        print(f"🤖 Model: {self.model_name}")

    def scrape_url(self, url: str) -> str:
        """Scrape a single URL."""
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
            
            return text
            
        except Exception as e:
            return ""

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

    def learn_all(self, urls: list = None):
        """Scrape ALL websites and feed to Gemini."""
        if urls is None:
            urls = self.DEFAULT_URLS
        
        print("\n" + "="*60)
        print("🇲🇾 SCRAPING ALL MALAYSIAN TRADE POLICY WEBSITES")
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
        
        for i, url in enumerate(urls):
            label = source_labels.get(i, f"Source {i+1}")
            print(f"\n📖 [{i+1}/{len(urls)}] {label}")
            
            text = self.scrape_url(url)
            
            if text and len(text) > 100:  # At least 100 chars = meaningful content
                self.all_content[url] = text
                all_text_parts.append(f"=== SOURCE {i+1}: {label} ===\nURL: {url}\n\n{text}")
                scraped_count += 1
                print(f"   ✅ Scraped {len(text)} characters")
            else:
                failed_sites.append((i+1, label, url))
                print(f"   ❌ Insufficient content ({len(text)} chars)")
        
        print(f"\n📊 Successfully scraped: {scraped_count}/{len(urls)}")
        
        if failed_sites:
            print("⚠️  Failed sites (may need manual reading):")
            for num, label, url in failed_sites:
                print(f"   {num}. {label}: {url}")
        
        if scraped_count == 0:
            print("❌ No websites could be scraped!")
            return False
        
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

    def ask(self, question: str) -> str:
        """Ask a question."""
        if not self.chat:
            return "⚠️ Load policies first with learn_all()"
        
        prompt = f"""Based on ALL {len(self.all_content)} Malaysian trade documents I gave you, answer:

{question}

Cite source. If not found, say so."""

        try:
            response = self.chat.send_message(prompt)
            return response.text
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

    def show_sources(self):
        """Show all loaded sources."""
        print("\n" + "="*60)
        print(f"📚 LOADED {len(self.all_content)} SOURCES:")
        print("="*60)
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
        print("   'exit' | 'sources' | 'summary'")
        print("="*60)
        
        while True:
            question = input("\n❓ You: ").strip()
            
            if question.lower() == 'exit':
                print("👋 Goodbye!")
                break
            elif question.lower() == 'sources':
                self.show_sources()
                continue
            elif question.lower() == 'summary':
                question = "Give a comprehensive summary of ALL documents covering key points from each source."
            
            print("\n🤖 Expert: ", end="", flush=True)
            answer = self.ask(question)
            print(answer)


if __name__ == "__main__":
    expert = MalaysianTradeExpert()
    
    if expert.learn_all():
        expert.chat_mode()