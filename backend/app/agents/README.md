# Agent Layout

This backend is split into three clear stages:

1. Agent 1 - Product scanner: implemented in `app/services/scanner.py` and exposed through `POST /api/v1/scans`
2. Agent 2 - Document generator: implemented in `app/agents/agent2/document_agent.py` and exposed through `POST /api/v1/documents/generate`
3. Agent 3 - Cost calculator: implemented in `app/agents/agent3/cost_agent.py` and exposed through `POST /api/v1/costs/quote`

The three routes can be chained in order, but each one also works independently.