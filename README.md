# 🌏 Borderless AI 

**Borderless AI** is a modular, agentic workflow system designed to navigate the complexities of cross-border trade. By leveraging AI to bridge language gaps and regulatory hurdles, we provide a seamless path for SMEs to scale from local markets to global stages.

---

## 🚀 The Three-Phase Framework
Our system is built on **Modular Decoupling**, allowing users to follow a complete "Guided Journey" or use specific modules as standalone microservices.

### 1. Product Admission Scanner ("Can I sell this?")
* **Focus:** Instant feasibility check for specific goods.
* **Core Tech:** Manglish-Powered AI Vision & Reasoning.
* **Functionality:** Supports multi-modal input (Image + Text). It identifies legal export/import status and flags necessary local registrations (e.g., SSM).
* **Interconnectivity:** Passes parameters (category, name) directly to Phase 2.

### 2. Compliance Architect ("How do I prepare?")
* **Focus:** Strategic business planning and document roadmap.
* **Core Tech:** Trade Dependency Graph & Agentic Reasoning.
* **Functionality:** Generates a step-by-step compliance roadmap. Maps dependencies (e.g., "Document B is required before applying for Permit A") to guide startups through paperwork.

### 3. Logistics & Tax Execution ("How much will it cost?")
* **Focus:** Tactical execution and fulfillment.
* **Core Tech:** Living Artifact Payload.
* **Functionality:** Accepts document uploads to calculate precise Shipping Fees and Customs Taxes. Provides direct redirection to 3PL platforms for immediate booking.

---

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

