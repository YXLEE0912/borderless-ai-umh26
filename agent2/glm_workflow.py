from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

from .glm_core import GLMArchitectCore


Stage = str


@dataclass(slots=True)
class WorkflowEvent:
    kind: str
    detail: dict[str, Any]


@dataclass(slots=True)
class WorkflowState:
    case_id: str = field(default_factory=lambda: f"case-{uuid.uuid4().hex[:10]}")
    stage: Stage = "entity_verification"
    facts: dict[str, Any] = field(default_factory=dict)
    missing_fields: list[str] = field(default_factory=list)
    ambiguity_flags: list[str] = field(default_factory=list)
    pending_actions: list[dict[str, Any]] = field(default_factory=list)
    failures: list[dict[str, Any]] = field(default_factory=list)
    history: list[WorkflowEvent] = field(default_factory=list)

    def snapshot(self) -> dict[str, Any]:
        return {
            "case_id": self.case_id,
            "stage": self.stage,
            "facts": self.facts,
            "missing_fields": self.missing_fields,
            "ambiguity_flags": self.ambiguity_flags,
            "pending_actions": self.pending_actions,
            "failures": self.failures,
            "history": [{"kind": h.kind, "detail": h.detail} for h in self.history],
        }


@dataclass(slots=True)
class WorkflowOutput:
    ok: bool
    message: str
    state: dict[str, Any]
    actions: list[dict[str, Any]]
    checklist: list[dict[str, Any]]


ToolFn = Callable[[dict[str, Any], WorkflowState], dict[str, Any]]


class ToolRouter:
    """Simple tool-or-API router for dynamic orchestration."""

    def __init__(self) -> None:
        self._tools: dict[str, ToolFn] = {
            "verify_entity": self._verify_entity,
            "classify_hs": self._classify_hs,
            "check_permits": self._check_permits,
        }

    def available_tools(self) -> list[str]:
        return sorted(self._tools.keys())

    def call(self, tool_name: str, payload: dict[str, Any], state: WorkflowState) -> dict[str, Any]:
        if tool_name not in self._tools:
            return {"ok": False, "error": f"Unknown tool: {tool_name}"}
        return self._tools[tool_name](payload, state)

    def _verify_entity(self, payload: dict[str, Any], _state: WorkflowState) -> dict[str, Any]:
        reg_no = str(payload.get("registration_no", "")).strip()
        if not reg_no:
            return {"ok": False, "error": "registration_no is required"}
        if len(reg_no) < 6:
            return {"ok": False, "error": "registration_no looks invalid"}
        return {"ok": True, "verified": True, "entity_status": "active"}

    def _classify_hs(self, payload: dict[str, Any], _state: WorkflowState) -> dict[str, Any]:
        product = str(payload.get("product_description", "")).lower()
        if "tea" in product:
            return {"ok": True, "hs_code": "0902.30.10", "confidence": 0.82}
        if "electronics" in product or "adapter" in product:
            return {"ok": True, "hs_code": "8504.40.90", "confidence": 0.74}
        return {"ok": False, "error": "Unable to classify product confidently"}

    def _check_permits(self, payload: dict[str, Any], _state: WorkflowState) -> dict[str, Any]:
        hs_code = str(payload.get("hs_code", ""))
        destination = str(payload.get("destination_country", "")).upper()

        needs_sirim = hs_code.startswith("85")
        needs_halal = hs_code.startswith(("02", "03", "04", "09", "16", "17", "18", "19", "20", "21"))
        needs_coo = destination in {"ID", "TH", "VN", "SG", "PH", "BN", "KH", "LA", "MM"}

        return {
            "ok": True,
            "needs_sirim": needs_sirim,
            "needs_halal": needs_halal,
            "needs_coo": needs_coo,
        }


class GLMWorkflowEngine:
    """
    Stateful and adaptive workflow engine where GLM is the core coordinator.

    If GLM parsing/planning is unavailable, orchestration should fail fast because
    core coordination intelligence is intentionally model-driven.
    """

    def __init__(
        self,
        glm: GLMArchitectCore,
        tools: ToolRouter | None = None,
        state: WorkflowState | None = None,
    ) -> None:
        self.glm = glm
        self.tools = tools or ToolRouter()
        self.state = state or WorkflowState()

    def process_unstructured_input(
        self,
        raw_input: str,
        source_type: str,
        source_meta: dict[str, Any] | None = None,
    ) -> WorkflowOutput:
        source_meta = source_meta or {}

        parsed = self._glm_extract(raw_input, source_type, source_meta)
        if not parsed.get("ok"):
            return self._hard_fail("GLM extraction failed. Workflow coordination unavailable.")

        self._merge_extraction(parsed)

        plan = self._glm_plan()
        if not plan.get("ok"):
            return self._hard_fail("GLM planning failed. Workflow coordination unavailable.")

        executed_actions = self._execute_actions(plan.get("actions", []))
        checklist = self._structured_checklist(plan)

        return WorkflowOutput(
            ok=True,
            message=plan.get("assistant_message", "Workflow cycle completed."),
            state=self.state.snapshot(),
            actions=executed_actions,
            checklist=checklist,
        )

    def _glm_extract(self, raw_input: str, source_type: str, source_meta: dict[str, Any]) -> dict[str, Any]:
        prompt = (
            "Extract normalized export-workflow facts from unstructured input. "
            "Return JSON only with keys: facts (object), missing_fields (array), "
            "ambiguities (array), inferred_stage (string)."
        )
        context = {
            "source_type": source_type,
            "source_meta": source_meta,
            "raw_input": raw_input,
            "known_facts": self.state.facts,
            "current_stage": self.state.stage,
        }
        out = self.glm.run_json(prompt, context=context)
        if not out.ok:
            return {"ok": False, "error": out.text}
        if not isinstance(out.data, dict):
            return {"ok": False, "error": "GLM did not return object"}
        return {"ok": True, **out.data}

    def _glm_plan(self) -> dict[str, Any]:
        prompt = (
            "You are the workflow coordinator. Decide next actions using current state. "
            "Return JSON only with keys: assistant_message (string), stage (string), "
            "actions (array), checklist (array). "
            "Each action object: type (ask_user|call_tool|advance_stage|retry_after_failure), "
            "reason, and optional tool_name/tool_payload/question."
        )
        context = {
            "state": self.state.snapshot(),
            "available_tools": self.tools.available_tools(),
            "hard_constraints": [
                "cannot advance with critical missing_fields",
                "must call tools when confidence is low",
                "must propose recovery when failures exist",
            ],
        }
        out = self.glm.run_json(prompt, context=context)
        if not out.ok:
            return {"ok": False, "error": out.text}
        if not isinstance(out.data, dict):
            return {"ok": False, "error": "GLM did not return object"}
        return {"ok": True, **out.data}

    def _merge_extraction(self, parsed: dict[str, Any]) -> None:
        facts = parsed.get("facts", {})
        if isinstance(facts, dict):
            self.state.facts.update(facts)

        missing = parsed.get("missing_fields", [])
        self.state.missing_fields = [str(x) for x in missing] if isinstance(missing, list) else []

        ambiguities = parsed.get("ambiguities", [])
        self.state.ambiguity_flags = [str(x) for x in ambiguities] if isinstance(ambiguities, list) else []

        inferred_stage = parsed.get("inferred_stage")
        if isinstance(inferred_stage, str) and inferred_stage.strip():
            self.state.stage = inferred_stage.strip()

        self.state.history.append(
            WorkflowEvent(
                kind="extraction",
                detail={
                    "facts_keys": sorted(list(facts.keys())) if isinstance(facts, dict) else [],
                    "missing_fields": self.state.missing_fields,
                    "ambiguity_flags": self.state.ambiguity_flags,
                },
            )
        )

    def _execute_actions(self, actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        executed: list[dict[str, Any]] = []

        for action in actions[:5]:
            action_type = str(action.get("type", "")).strip()

            if action_type == "ask_user":
                executed.append(
                    {
                        "type": "ask_user",
                        "question": action.get("question", "Please provide missing data."),
                        "reason": action.get("reason", "missing information"),
                    }
                )
                continue

            if action_type == "advance_stage":
                stage = str(action.get("stage", "")).strip()
                if stage:
                    self.state.stage = stage
                executed.append({"type": "advance_stage", "stage": self.state.stage, "ok": True})
                continue

            if action_type in {"call_tool", "retry_after_failure"}:
                tool_name = str(action.get("tool_name", "")).strip()
                tool_payload = action.get("tool_payload", {})
                if not isinstance(tool_payload, dict):
                    tool_payload = {}

                result = self.tools.call(tool_name, tool_payload, self.state)
                item = {
                    "type": action_type,
                    "tool_name": tool_name,
                    "tool_payload": tool_payload,
                    "tool_result": result,
                }
                executed.append(item)

                if result.get("ok"):
                    for key, val in result.items():
                        if key != "ok":
                            self.state.facts[key] = val
                else:
                    self.state.failures.append(
                        {
                            "tool_name": tool_name,
                            "payload": tool_payload,
                            "error": result.get("error", "unknown error"),
                        }
                    )
                continue

            executed.append({"type": "noop", "reason": "unsupported action", "raw": action})

        self.state.pending_actions = actions
        self.state.history.append(WorkflowEvent(kind="execution", detail={"actions": executed}))
        return executed

    def _structured_checklist(self, plan: dict[str, Any]) -> list[dict[str, Any]]:
        checklist = plan.get("checklist", [])
        if isinstance(checklist, list):
            normalized: list[dict[str, Any]] = []
            for item in checklist:
                if isinstance(item, dict):
                    normalized.append(
                        {
                            "task": str(item.get("task", "")),
                            "owner": str(item.get("owner", "exporter")),
                            "priority": str(item.get("priority", "medium")),
                            "status": str(item.get("status", "pending")),
                        }
                    )
            return normalized
        return []

    def _hard_fail(self, msg: str) -> WorkflowOutput:
        self.state.history.append(WorkflowEvent(kind="failure", detail={"message": msg}))
        self.state.failures.append({"error": msg})
        return WorkflowOutput(
            ok=False,
            message=msg,
            state=self.state.snapshot(),
            actions=[],
            checklist=[],
        )


def to_json_output(output: WorkflowOutput) -> str:
    return json.dumps(
        {
            "ok": output.ok,
            "message": output.message,
            "state": output.state,
            "actions": output.actions,
            "checklist": output.checklist,
        },
        indent=2,
        ensure_ascii=True,
    )
