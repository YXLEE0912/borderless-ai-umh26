import os
import requests
from dotenv import load_dotenv
from bs4 import BeautifulSoup
import google.generativeai as genai  # 👈 Gemini SDK

load_dotenv()

# ============================================
# MALAYSIAN CUSTOMS EXPORT POLICY READER (GEMINI)
# ============================================

class CustomsExportReader:
    """Reads Malaysian Customs export policies using Gemini AI."""

    def __init__(self):
        # Gemini config
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
        
        if not self.api_key:
            raise ValueError("❌ GEMINI_API_KEY not found in .env")
        
        # Configure Gemini
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)
        
        self.knowledge_base = ""
        self.chat = None  # Will be initialized after learning
        
        print(f"🤖 Model: {self.model_name}")
        print(f"🔑 API Key: {self.api_key[:20]}...")

    def scrape_customs(self, url: str) -> str:
        """Scrape the customs website with proper headers."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-MY,en;q=0.9,ms;q=0.8",
        }
        
        print(f"\n📖 Scraping: {url}")
        
        try:
            response = requests.get(url, headers=headers, timeout=30, verify=True)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove junk elements
            for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript']):
                tag.decompose()
            
            # Try to find main content
            main = soup.find('main') or soup.find('article') or soup.find('div', class_='content') or soup
            
            text = main.get_text(separator='\n', strip=True)
            lines = [line.strip() for line in text.split('\n') if line.strip() and len(line.strip()) > 20]
            text = '\n'.join(lines)
            
            # Keep manageable size (Gemini can handle more)
            if len(text) > 50000:
                text = text[:50000]
            
            print(f"✅ Scraped {len(text)} characters")
            return text
            
        except requests.exceptions.SSLError:
            print("⚠️ SSL Error - trying without verification...")
            import urllib3
            urllib3.disable_warnings()
            response = requests.get(url, headers=headers, timeout=30, verify=False)
            soup = BeautifulSoup(response.text, 'html.parser')
            text = soup.get_text(separator='\n', strip=True)
            return text[:50000]
        
        except Exception as e:
            print(f"❌ Error: {e}")
            return ""

    def learn(self, url: str):
        """Feed the customs website to Gemini AI."""
        content = self.scrape_customs(url)
        
        if not content:
            print("❌ No content scraped")
            return False
        
        # Step 1: Ask Gemini to read and understand the document
        system_prompt = f"""You are a Malaysian Customs Export Policy Expert. 
Read this document from the Malaysian Customs website carefully.
You will answer questions about export procedures, tariffs, regulations, 
and requirements for Malaysian SMEs based ONLY on this document.

DOCUMENT FROM CUSTOMS WEBSITE:
{content[:40000]}

Reply with: 'OK, I have read and understood the customs policy. Ready for questions.'"""

        print("\n📚 Teaching Gemini about customs policy...")
        response = self.model.generate_content(system_prompt)
        print(f"✅ {response.text}")
        
        # Step 2: Create a chat session with the knowledge
        self.knowledge_base = content
        self.chat = self.model.start_chat(history=[
            {
                "role": "user",
                "parts": [f"You are a Malaysian Customs Export Expert. I will give you a document to read.\n\nDOCUMENT:\n{content[:40000]}\n\nRemember this document."]
            },
            {
                "role": "model",
                "parts": ["OK, I have read and understood the Malaysian Customs export policy document. I will answer questions based ONLY on this document."]
            }
        ])
        
        print(f"✅ Learned customs policy! Ready for questions.")
        return True

    def ask(self, question: str) -> str:
        """Ask a question about customs/export."""
        if not self.chat:
            return "⚠️ Load a policy first with learn()"
        
        prompt = f"""Based on the Malaysian Customs document I gave you earlier, answer this question:

{question}

If the answer is not in the document, say: 'This information is not found in the customs page. Please check https://ezhs.customs.gov.my for more details.'"""

        try:
            response = self.chat.send_message(prompt)
            return response.text
        except Exception as e:
            return f"❌ Error: {e}"

    def chat_mode(self):
        """Interactive Q&A about customs policies."""
        if not self.chat:
            print("⚠️ Load a policy first!")
            return
        
        print("\n" + "="*60)
        print("🇲🇾 MALAYSIAN CUSTOMS EXPORT POLICY Q&A (GEMINI)")
        print("   Type 'exit' to quit, 'summary' for overview")
        print("   Example: 'How do I register for export?'")
        print("   Example: 'What documents are needed for K2 form?'")
        print("="*60)
        
        while True:
            question = input("\n❓ You: ").strip()
            
            if question.lower() == 'exit':
                print("👋 Goodbye!")
                break
            elif question.lower() == 'summary':
                question = "Give me a detailed summary of this customs export page in bullet points, covering all procedures, requirements, important notes, and links mentioned."
            
            print("\n🤖 Customs Expert: ", end="", flush=True)
            answer = self.ask(question)
            print(answer)


# ============================================
# RUN
# ============================================

if __name__ == "__main__":
    reader = CustomsExportReader()
    
    url = os.getenv("TARGET_URL", "https://ezhs.customs.gov.my/public-prob-export")
    
    if reader.learn(url):
        reader.chat_mode()