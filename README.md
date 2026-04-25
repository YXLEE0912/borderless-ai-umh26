# 🌏 Borderless AI 

**recorded pitching video** :

**Borderless AI** is a modular, agentic workflow system designed to navigate the complexities of cross-border trade. By leveraging AI to bridge language gaps and regulatory hurdles, we provide a seamless path for SMEs to scale from local markets to global stages.

---
## 🌶️ The Story
Meet **Kak Siti**. She makes the best *Sambal Belacan* in Muar. Her fans in Singapore and Australia want to buy it, but Kak Siti is stuck. 
* *What is an HS Code?* * *Does her sambal need a permit for Singapore?* * *How much will shipping and customs tax cost?*

Usually, Kak Siti would need a consultant. With **Borderless AI**, she just needs her smartphone.

---

## 🚀 The Three-Phase Framework
We’ve built a modular, agentic workflow that guides Kak Siti from her kitchen to the world.

### 📸 Phase 1: The Product Admission Scanner
**"Boleh export sambal ni ke SG tak?"**
* **Input:** Kak Siti takes a photo of her sambal jar and asks a question in **Manglish**.
* **AI Vision & Reasoning:** Using **Z.AI GLM**, the system identifies the product, extracts ingredients, and determines the **HS Code (2103.90)**.
* **Instant Check:** It flags that while it is "Food-Grade," it requires specific labeling for Singapore.

### 📝 Phase 2: The Compliance Architect
**"What documents do I need?"**
* **Agentic Roadmap:** The AI generates a step-by-step document checklist.
* **Auto-Fill:** It uses the product data from Phase 1 to draft a **Commercial Invoice** and **Packing List** automatically.
* **Trade Graph:** It maps out dependencies (e.g., "You need the SSM registration before applying for the Export Permit").

### 🚢 Phase 3: Logistics & Tax Execution
**"How much is the total cost?"**
* **Landed Cost Calculation:** The system calculates the estimated **Customs Duties** and **SST/GST**.
* **Booking:** It provides a direct redirection to logistics platforms for immediate booking based on the weight and destination.


## 🏗 Technical Architecture



The system is architected to handle the nuances of Malaysian trade (Manglish processing) while maintaining enterprise-grade persistence.

### 🧩 System Layers
| Layer | Component | Responsibility |
| :--- | :--- | :--- |
| **Presentation** | Client UI (React/Next.js) | Scan interface, multi-modal uploads, and modular dashboard. |
| **Application** | FastAPI / Scanner Orchestrator | Gateway, logic orchestration, and rules engine execution. |
| **Intelligence** | Gemini & Z.ai/ILMU | Visual extraction and HS-style agentic reasoning. |
| **Data/External** | Supabase & Storage | Audit logs, scan history, and document persistence. |

### 🔄 Scanner Data Flow
1.  **Input:** User uploads image + Manglish prompt (e.g., *"Boleh export sambal ni ke SG?"*) to `/scans`.
2.  **Vision:** **Gemini Vision** extracts product attributes, materials, and visual hints.
3.  **Reasoning:** **Z.ai / ILMU** performs compliance classification and HS-code reasoning based on visual data.
4.  **Validation:** **Rules Engine** applies specific Malaysia export rules and destination-specific restrictions.
5.  **Output:** Result is persisted in **Supabase** and displayed with full chat/history context.

---

## 🧰 Tech Stack
* **Reasoning Engine:** Agentic Workflow for trade logic.
* **Knowledge Mapping:** Trade Dependency Graphs.
* **NLP:** Localized Manglish processing for intuitive interaction.
* **Backend:** FastAPI (Python).
* **Database & Auth:** Supabase (PostgreSQL).
* **AI Models:** Google Gemini 1.5 Pro, Z.ai / ILMU.

---

## 🛠 Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/borderless-ai.git
    cd borderless-ai
    ```

2.  **Backend Setup**
    ```bash
    cd backend
    pip install -r requirements.txt
    touch .env # Add your Gemini & Supabase API keys
    uvicorn main:app --reload
    ```

3.  **Frontend Setup**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

---

## 🌟 Why Borderless AI?
Standard trade tools are built for logistics giants. **Borderless AI** is built for the *Malaysian SME*—the entrepreneur who speaks Manglish, uses a smartphone for everything, and needs a roadmap, not just a spreadsheet. By decoupling our services, we provide a "Menu-Style" experience that grows with the business.

---

## 👥 The Team: [50_Gurliessssssss]
*Submitted for UMHackathon 2026*

---
