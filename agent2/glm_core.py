from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib import error, request

from .config import ArchitectConfig


@dataclass(slots=True)
class GLMCoreResult:
    ok: bool
    text: str
    raw: dict | None = None
    data: dict[str, Any] | list[Any] | None = None


class GLMArchitectCore:
    """Lightweight GLM-first Architect AI core (model-centric, minimal backend)."""

    def __init__(
        self,
        config: ArchitectConfig | None = None,
        language_mode: str = "manglish",
        persona_mode: str = "expert",
    ) -> None:
        self.config = config or ArchitectConfig.from_env()
        self.language_mode = language_mode
        self.persona_mode = persona_mode

    def set_language(self, mode: str) -> None:
        alias = {
            "en": "en",
            "eng": "en",
            "english": "en",
            "manglish": "manglish",
            "mix": "manglish",
            "bm": "bm",
            "malay": "bm",
            "bahasa": "bm",
        }
        self.language_mode = alias.get(mode.lower().strip(), self.language_mode)

    def set_persona(self, mode: str) -> None:
        alias = {
            "expert": "expert",
            "formal": "expert",
            "casual": "casual",
            "friendly": "casual",
        }
        self.persona_mode = alias.get(mode.lower().strip(), self.persona_mode)

    def run(self, user_message: str, context: dict | None = None) -> GLMCoreResult:
        payload = {
            "model": self.config.glm_model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": self._system_prompt()},
                {
                    "role": "user",
                    "content": self._compose_user_content(user_message, context or {}),
                },
            ],
        }

        try:
            raw = self._post("chat/completions", payload)
            text = raw["choices"][0]["message"]["content"]
            return GLMCoreResult(ok=True, text=text, raw=raw, data=None)
        except Exception as exc:
            return GLMCoreResult(ok=False, text=f"GLM call failed: {exc}", raw=None, data=None)

    def run_json(self, user_message: str, context: dict | None = None) -> GLMCoreResult:
        payload = {
            "model": self.config.glm_model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        self._system_prompt()
                        + " Always return valid JSON only. No markdown, no prose."
                    ),
                },
                {
                    "role": "user",
                    "content": self._compose_user_content(user_message, context or {}),
                },
            ],
        }

        try:
            raw = self._post("chat/completions", payload)
            text = raw["choices"][0]["message"]["content"]
            parsed = json.loads(text)
            return GLMCoreResult(ok=True, text=text, raw=raw, data=parsed)
        except Exception as exc:
            return GLMCoreResult(ok=False, text=f"GLM JSON call failed: {exc}", raw=None, data=None)

    def _compose_user_content(self, user_message: str, context: dict) -> str:
        if not context:
            return user_message
        return f"{user_message}\n\nContext JSON:\n{json.dumps(context, ensure_ascii=True)}"

    def _system_prompt(self) -> str:
        voice = self._voice_policy()
        return (
            "You are Export Architect AI for Malaysia export compliance. "
            "Primary objective: guide users from entity verification until K2 submission with practical commands. "
            "Keep answers concise, actionable, and command-oriented. "
            "When users ask what to do next, provide a numbered checklist. "
            "When data is missing, ask only the minimum required fields. "
            "If user asks for language switch, respect it immediately. "
            f"Voice policy: {voice}"
        )

    def _voice_policy(self) -> str:
        if self.language_mode == "manglish":
            if self.persona_mode == "casual":
                return "Speak in Manglish, friendly and chill, but still professional."
            return "Speak in Manglish, expert tone, compliance-first and clear."
        if self.language_mode == "bm":
            if self.persona_mode == "casual":
                return "Gunakan Bahasa Melayu santai tetapi tepat."
            return "Gunakan Bahasa Melayu profesional dan padat."
        if self.persona_mode == "casual":
            return "Speak in English with a friendly consultant tone."
        return "Speak in concise professional English."

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.glm_api_key}",
        }

    def _post(self, path: str, payload: dict) -> dict:
        url = f"{self.config.glm_base_url.rstrip('/')}/{path.lstrip('/')}"
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(url=url, data=data, headers=self._headers(), method="POST")
        try:
            with request.urlopen(req, timeout=self.config.request_timeout_seconds) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"GLM HTTP {exc.code}: {detail}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"GLM unreachable: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise RuntimeError("GLM response is not valid JSON") from exc
