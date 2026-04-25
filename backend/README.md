<<<<<<< HEAD
# Backend Starter

This folder contains the first FastAPI backend slice for the Product Scanner.

## What is wired now

- `GET /api/v1/health`
- `POST /api/v1/scans`
- `POST /api/v1/documents/generate`
- `POST /api/v1/costs/quote`
- `GET /api/v1/scans/{scan_id}`
- `GET /api/v1/scans/{scan_id}/chat`
- `POST /api/v1/scans/{scan_id}/follow-up`
- Supabase Postgres table for scan records
- Optional Supabase client for storage
- Z.ai adapter with a fallback rule-based scanner when no API key is set
- Rules engine that applies Malaysia 3-layer export checks and sea logistics checklist
- HS-code policy matching that can add rule hits, permits, and agencies based on HS prefixes
- HS confidence gate: when HS confidence is below threshold (default 0.65), result is forced to `review` for manual verification
- Strict HS mode (default enabled): when HS policy matches with enough confidence, keyword layers are treated as secondary warnings
- Decision trace in response: `result.decision_steps` explains each major decision step and status transition
- Agent 2 document generator and Agent 3 landed-cost calculator can now be chained from the frontend

## Rules to store

Store these rule groups in the app and keep versions with source links:

1. Malaysia Layer 1 absolute prohibitions (hard block)
2. Malaysia Layer 2 controlled goods requiring export licence
3. Malaysia Layer 3 conditional categories (animal, plant, food, wildlife)
4. Destination-country import restrictions (China only for this phase)
5. Document templates by flow (default export docs and sea-shipping docs)
6. SSM validation rules and required merchant profile fields

Current starter catalog is in `app/rules/malaysia_export_rules.json`.

## Where to store rules

1. Source of truth for development: JSON in repo (`app/rules/malaysia_export_rules.json`) for easy version control and review.
2. Runtime managed rules: Supabase table (recommended next step) so admin users can update rules without deploy.
3. Scan outputs: Supabase `scans` table (already used) so each decision stores rule hits and reasoning.

## Enterprise Rules Storage

Use Supabase Postgres as the production rule registry:

1. Run SQL migration in `sql/001_rules_schema.sql`.
2. Run seed data in `sql/002_seed_rules_china.sql`.
3. Run hardening migration in `sql/003_operational_hardening.sql`.
4. Run link registry seed in `sql/004_seed_source_registry_china.sql`.
5. Publish rule versions in `regulatory_rulesets` with `status=published`.
6. Store each deterministic rule in `regulatory_rules` with `layer` = `layer1|layer2|layer3`.
7. Store country import overlays in `destination_policies`.
8. Store document and sea-flow templates in `document_profiles`.
9. Runtime loads the latest published ruleset and caches for `RULES_CACHE_TTL_SECONDS`.

## SQL Run Order

1. `sql/001_rules_schema.sql`
2. `sql/002_seed_rules_china.sql`
3. `sql/003_operational_hardening.sql`
4. `sql/004_seed_source_registry_china.sql`
5. `sql/005_governance_audit.sql`
6. `sql/006_scan_chat_history.sql`

Fallback behavior: if DB rules are unavailable, engine falls back to `app/rules/malaysia_export_rules.json`.

Audit behavior: each `POST /api/v1/scans` call writes a row to `rule_execution_log` with timing, rule hits, and request/response snapshots.

## How to handle rules in runtime

1. Parse product and merchant inputs.
2. Get AI result (or fallback).
3. Apply deterministic rules engine to enforce legal guardrails.
4. Apply HS-code policy overlays from the active ruleset when HS candidates have enough confidence.
5. Merge required documents, permits, agencies, and logistics checklist.
6. Persist final decision with `rule_hits`, extraction notes, and `hs_code_reasoning`.

## Local setup

1. Copy `.env.example` to `.env` and fill in your API keys and Supabase values.
2. Create and activate a virtual environment.
3. Install dependencies from `requirements.txt`.
4. Run the FastAPI app with Uvicorn.

Agent 3 reads `UMH_3_API_KEY` for the shared Z.ai-backed cost and document flow.
If you prefer the older names, the Z.ai-backed services also accept `Z_AI_API_KEY`, `A_AI_API_KEY`, or `AI_API_KEY`.

### Install

From the `backend` directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If you already have a virtual environment, just activate it and install the requirements.

### Run

Start the backend locally with:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://127.0.0.1:8000`.

### Optional checks

Run the app without auto-reload for a production-style local run:

```bash
uvicorn app.main:app --port 8000
```

If you need to verify the health endpoint after startup, open:

```bash
curl http://127.0.0.1:8000/api/v1/health
```

## Scan request

Send `multipart/form-data` to `POST /api/v1/scans` with:

- optional `product_prompt`
- optional `destination_country`
- optional `product_image`

At least one of `product_prompt` or `product_image` is required.

## Follow-up chat

- `POST /api/v1/scans/{scan_id}/follow-up` accepts JSON:
	- `message` required
	- optional `destination_country`
- Backend stores both user and assistant messages in `scan_chat_messages`.
- `GET /api/v1/scans/{scan_id}/chat` returns chronological chat history.

## Speech To Text

Use `POST /api/v1/audio/transcribe` for the mic feature.

Request fields:

- `audio_file` required, multipart upload from the browser mic recorder
- `language` optional, for example `en` or `zh`

If `STT_API_KEY` and `STT_BASE_URL` are not set, the backend falls back to `Z_AI_API_KEY` and `Z_AI_BASE_URL`.
=======
# Borderless AI Trade Platform — Backend

## Quick Start

```bash
# 1. Install
pip install -r requirements.txt

# 2. Set your API key in main.py
#    GLM_API_KEY = "sk-...your-real-key..."

# 3. Run
uvicorn main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs

---

## Connecting your Frontend

### Option A — Environment Variable (Next.js / Vite)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Option B — Direct in `frontend_api_client.js`
```js
const BASE_URL = 'http://localhost:8000'
```

### Copy the client
```bash
cp frontend_api_client.js your-frontend/src/lib/api.js
```

### Usage in React
```jsx
import api from './lib/api'

// On mount — create session
const { session_id } = await api.createSession()

// Step 1 — verify entity
await api.verifyEntity(session_id, {
  company_name: 'Acme Sdn Bhd',
  registration_number: '202301012345',
  director_nric: '800101-14-1234',
})

// Chat with Architect AI
const { response } = await api.chat(session_id, 'What documents do I need?')

// Streaming chat
const cancel = api.chatStream(
  session_id,
  'Walk me through step 1',
  (chunk) => setReply(prev => prev + chunk),   // onChunk
  ()      => setLoading(false),                 // onDone
)

// Landed cost widget
const lc = await api.getLandedCost(session_id)
// { fob_myr: 4720, freight_myr: 330, estimated_duty_myr: 252, total_landed_cost_myr: 5302 }
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET  | /health | Ping |
| POST | /sessions | Create export session |
| GET  | /sessions/{id} | Get session state |
| POST | /entity/verify | Step 1 — SSM/BRN check |
| POST | /entity/upload-ssm | Upload SSM certificate |
| POST | /consignee/add | Step 2 — Buyer details |
| POST | /classification/hs-code | Step 3 — HS code lookup |
| POST | /permits/check | Step 4 — SIRIM/Halal/MITI |
| POST | /digital-access/setup | Step 5 — MyDagangNet |
| POST | /valuation/calculate | Step 6 — FOB/CIF/Duty |
| POST | /logistics/setup | Step 7 — Vessel/Port/Weight |
| POST | /trade-docs/generate | Step 8 — Docs generation |
| POST | /customs/submit-k2 | Step 9 — K2 declaration |
| POST | /chat | Architect AI chat |
| GET  | /checklist/{id} | Checklist progress |
| GET  | /documents/status/{id} | Doc pack status |
| GET  | /landed-cost/{id} | Live landed cost |

## CORS

Already configured with `allow_origins=["*"]`.
Tighten in production:
```python
allow_origins=["https://yourdomain.com"]
```
>>>>>>> architect-ai
