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
