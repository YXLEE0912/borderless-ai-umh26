# Architect AI (Python) - GLM Workflow Engine

Stateful, adaptive workflow engine for Malaysia export compliance. **GLM is the core coordinator** — parses unstructured inputs, plans multi-step actions, orchestrates tools, and generates structured outputs.

## Quick start

```python
from agent2.glm_core import GLMArchitectCore
from agent2.glm_workflow import GLMWorkflowEngine

core = GLMArchitectCore(language_mode="manglish", persona_mode="expert")
engine = GLMWorkflowEngine(glm=core)

result = engine.process_unstructured_input(
    "SSM 202301045678, export black tea to Indonesia, not sure permits",
    source_type="message",
)
print(result.message)
print(result.state)
```

## Frontend connection (Assistant page)

The frontend can call the Python workflow backend when enabled.

1. Start backend API:

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

2. In root `.env`, set:

```bash
VITE_USE_AGENT2_BACKEND=true
VITE_AGENT2_API_BASE_URL=http://127.0.0.1:8000
VITE_AGENT2_POLICY_TOPIC=K2 Forms
```

3. Run frontend (`npm run dev` or your usual command). Assistant messages will call `/api/agent2/process`.

Set your GLM API key:

```powershell
$env:GLM_API_KEY="your_real_key_here"
```

## Files

- `glm_core.py`: GLM model interface (text + JSON mode)
- `glm_workflow.py`: Stateful workflow engine coordinated by GLM
- `config.py`: Config (GLM keys from env vars)
- `live_agent_intelligence.py`: Research and retrieval agent for live policy context
- `policy_sources_websites.py`: Official website source list
- `policy_sources_news.py`: News feed source list

## Live Agent Intelligence

Use `LiveAgentIntelligence` to fetch current policy signals and inject them into planning context:

```python
from agent2.glm_core import GLMArchitectCore
from agent2.glm_workflow import GLMWorkflowEngine
from agent2.live_agent_intelligence import LiveAgentIntelligence

core = GLMArchitectCore(language_mode="manglish", persona_mode="expert")
researcher = LiveAgentIntelligence(glm=core)
engine = GLMWorkflowEngine(glm=core, policy_researcher=researcher)

result = engine.process_unstructured_input(
    "Need to submit K2 for tea export to Indonesia",
    source_type="message",
    source_meta={"policy_topic": "K2 Forms"},
)
```

## How GLM is the winning core

✅ **Unstructured input understanding** — GLM extracts facts from messy messages/forms/docs  
✅ **Multi-step reasoning** — GLM plans stage-aware actions with dependencies  
✅ **Dynamic orchestration** — GLM decides tool calls, user questions, stage advances, retries  
✅ **Structured outputs** — Returns `WorkflowOutput` JSON: `state`, `actions`, `checklist`  
✅ **Stateful/adaptive** — Persists facts, missing fields, ambiguities, failures, history  
✅ **Failure handling** — GLM proposes recovery paths and minimal-info prompts  
✅ **Proof of dependency** — Remove GLM -> coordination fails because reasoning/orchestration cannot proceed

## Config

GLM keys (from environment):
- `GLM_API_KEY` (default: `xxx`)
- `GLM_BASE_URL` (default: `https://open.bigmodel.cn/api/paas/v4`)
- `GLM_MODEL` (default: `glm-4`)

Or use Ilmu Anthropic proxy:
- `ANTHROPIC_BASE_URL`: `https://api.ilmu.ai/anthropic`
- `ANTHROPIC_AUTH_TOKEN`: Your Ilmu API key
- `ANTHROPIC_MODEL`: Your model key

## Language modes

- `manglish` — Friendly mixed English/Malay
- `en` — Professional English
- `bm` — Formal Bahasa Melayu

## Personas

- `expert` — Compliance-first, formal
- `casual` — Friendly consultant tone

