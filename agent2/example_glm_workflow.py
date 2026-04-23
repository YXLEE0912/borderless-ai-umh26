from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from agent2.glm_core import GLMCoreResult
from agent2.glm_workflow import GLMWorkflowEngine, to_json_output


@dataclass(slots=True)
class MockGLMCore:
    """Deterministic stand-in to demonstrate GLM-driven coordination behavior."""

    def run_json(self, user_message: str, context: dict[str, Any] | None = None) -> GLMCoreResult:
        ctx = context or {}

        if "Extract normalized export-workflow facts" in user_message:
            raw = str(ctx.get("raw_input", "")).lower()
            facts: dict[str, Any] = {}
            missing_fields = ["registration_no", "destination_country"]
            ambiguities: list[str] = []
            inferred_stage = "entity_verification"

            if "ssm" in raw and "2023" in raw:
                facts["registration_no"] = "202301045678"
                if "registration_no" in missing_fields:
                    missing_fields.remove("registration_no")

            if "indonesia" in raw or " jakarta" in raw:
                facts["destination_country"] = "ID"
                if "destination_country" in missing_fields:
                    missing_fields.remove("destination_country")

            if "tea" in raw:
                facts["product_description"] = "black tea in retail packs"
                inferred_stage = "classification"

            if "maybe" in raw or "not sure" in raw:
                ambiguities.append("destination uncertainty")

            return GLMCoreResult(
                ok=True,
                text="mock-extraction",
                data={
                    "facts": facts,
                    "missing_fields": missing_fields,
                    "ambiguities": ambiguities,
                    "inferred_stage": inferred_stage,
                },
            )

        if "You are the workflow coordinator" in user_message:
            state = ctx.get("state", {})
            facts = state.get("facts", {})
            missing_fields = state.get("missing_fields", [])
            failures = state.get("failures", [])
            actions: list[dict[str, Any]] = []
            checklist: list[dict[str, Any]] = []

            if failures:
                actions.append(
                    {
                        "type": "ask_user",
                        "reason": "recover from failed external interaction",
                        "question": "Please confirm missing fields or retry payload.",
                    }
                )
                checklist.append(
                    {
                        "task": "Resolve latest failure before advancing",
                        "owner": "exporter",
                        "priority": "high",
                        "status": "pending",
                    }
                )
                return GLMCoreResult(
                    ok=True,
                    text="mock-plan-failure-recovery",
                    data={
                        "assistant_message": "Detected process failure. Recovery question prepared.",
                        "stage": state.get("stage", "entity_verification"),
                        "actions": actions,
                        "checklist": checklist,
                    },
                )

            if "registration_no" in missing_fields:
                actions.append(
                    {
                        "type": "ask_user",
                        "reason": "cannot verify entity without registration number",
                        "question": "Please share SSM or BRN registration number.",
                    }
                )
                checklist.append(
                    {
                        "task": "Collect registration number",
                        "owner": "exporter",
                        "priority": "high",
                        "status": "pending",
                    }
                )
            else:
                actions.append(
                    {
                        "type": "call_tool",
                        "reason": "verify entity status",
                        "tool_name": "verify_entity",
                        "tool_payload": {"registration_no": facts.get("registration_no")},
                    }
                )

            if "product_description" in facts and "hs_code" not in facts:
                actions.append(
                    {
                        "type": "call_tool",
                        "reason": "classify product for downstream permit logic",
                        "tool_name": "classify_hs",
                        "tool_payload": {"product_description": facts.get("product_description")},
                    }
                )

            if "destination_country" in facts:
                actions.append(
                    {
                        "type": "call_tool",
                        "reason": "derive permit dependencies",
                        "tool_name": "check_permits",
                        "tool_payload": {
                            "hs_code": facts.get("hs_code", "0902.30.10"),
                            "destination_country": facts.get("destination_country"),
                        },
                    }
                )

            actions.append({"type": "advance_stage", "reason": "move forward", "stage": "permit_review"})
            checklist.extend(
                [
                    {
                        "task": "Validate entity and consignee profile",
                        "owner": "architect-ai",
                        "priority": "high",
                        "status": "in-progress",
                    },
                    {
                        "task": "Confirm permit set and document gating",
                        "owner": "architect-ai",
                        "priority": "high",
                        "status": "pending",
                    },
                ]
            )

            return GLMCoreResult(
                ok=True,
                text="mock-plan",
                data={
                    "assistant_message": "Plan generated from current state with dynamic tool orchestration.",
                    "stage": "permit_review",
                    "actions": actions,
                    "checklist": checklist,
                },
            )

        return GLMCoreResult(ok=False, text="unsupported mock prompt", data=None)


@dataclass(slots=True)
class NoGLMCore:
    """Simulates removing GLM from the architecture."""

    def run_json(self, user_message: str, context: dict[str, Any] | None = None) -> GLMCoreResult:
        return GLMCoreResult(ok=False, text="GLM component missing", data=None)


def run_demo() -> None:
    print("=== WITH GLM CORE (mocked) ===")
    engine = GLMWorkflowEngine(glm=MockGLMCore())

    mixed_message = (
        "Hi boss, I got SSM 202301045678. Want export black tea to Indonesia, "
        "buyer in Jakarta. Not sure all permit needed or not."
    )
    out1 = engine.process_unstructured_input(mixed_message, source_type="message")
    print(to_json_output(out1))

    unstructured_form_blob = (
        "Form dump: product=Black Tea 250g x 100 cartons; destination=Indonesia; "
        "incoterm=FOB; notes=maybe halal needed"
    )
    out2 = engine.process_unstructured_input(unstructured_form_blob, source_type="form")
    print(to_json_output(out2))

    print("=== WITHOUT GLM CORE ===")
    broken = GLMWorkflowEngine(glm=NoGLMCore())
    out3 = broken.process_unstructured_input("SSM 202301045678 export tea", source_type="message")
    print(to_json_output(out3))


if __name__ == "__main__":
    run_demo()
