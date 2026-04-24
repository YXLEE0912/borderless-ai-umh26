from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Borderless AI API"
    api_prefix: str = "/api/v1"

    z_ai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("UMH_3_API_KEY", "Z_AI_API_KEY", "A_AI_API_KEY", "AI_API_KEY"),
    )
    z_ai_base_url: str = "https://api.ilmu.ai/v1"
    z_ai_model: str = "ilmu-glm-5.1"
    z_ai_timeout_seconds: float = 90.0
    z_ai_max_retries: int = 2

    gemini_api_key: str | None = None
    gemini_api_key_backup: str | None = None
    gemini_vision_model: str = "gemini-2.5-flash"

    umh_3_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("UMH_3_API_KEY"),
    )


    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_storage_bucket: str = "scan-assets"
    supabase_scans_table: str = "scans"
    supabase_rulesets_table: str = "regulatory_rulesets"
    supabase_rules_table: str = "regulatory_rules"
    supabase_destination_policies_table: str = "destination_policies"
    supabase_document_profiles_table: str = "document_profiles"
    supabase_rule_execution_log_table: str = "rule_execution_log"
    supabase_scan_chat_messages_table: str = "scan_chat_messages"

    rules_cache_ttl_seconds: int = 60

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ]
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()