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

Set your GLM API key:

```powershell
$env:GLM_API_KEY="your_real_key_here"
```

## Files

- `glm_core.py`: GLM model interface (text + JSON mode)
- `glm_workflow.py`: Stateful workflow engine coordinated by GLM
- `config.py`: Config (GLM keys from env vars)

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

