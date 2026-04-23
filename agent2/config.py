from dataclasses import dataclass
import os


@dataclass(slots=True)
class ArchitectConfig:
    """Runtime config for Architect AI model integrations."""

    ilmu_api_key: str = "xxx"
    ilmu_base_url: str = "https://api.ilmu.ai/v1"
    ilmu_model: str = "ilmu-1"
    glm_api_key: str = "xxx"
    glm_base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    glm_model: str = "glm-4"
    request_timeout_seconds: int = 30

    @classmethod
    def from_env(cls) -> "ArchitectConfig":
        return cls(
            ilmu_api_key=os.getenv("ILMU_API_KEY", "xxx"),
            ilmu_base_url=os.getenv("ILMU_BASE_URL", "https://api.ilmu.ai/v1"),
            ilmu_model=os.getenv("ILMU_MODEL", "ilmu-1"),
            glm_api_key=os.getenv("GLM_API_KEY", "xxx"),
            glm_base_url=os.getenv("GLM_BASE_URL", "https://open.bigmodel.cn/api/paas/v4"),
            glm_model=os.getenv("GLM_MODEL", "glm-4"),
            request_timeout_seconds=int(os.getenv("ILMU_TIMEOUT", "30")),
        )
