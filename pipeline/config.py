"""Configuration — loads from keys.json then falls back to env vars.

Uses Pydantic BaseSettings for typed validation. Validation is lazy:
the singleton is created on first access via `settings()`, not at import time,
so tests that never touch real config still work.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings

_KEYS_PATH = Path(__file__).parent.parent / "keys.json"


def _load_keys_json() -> dict[str, Any]:
    """Load keys.json if it exists, else return empty dict."""
    if _KEYS_PATH.exists():
        return json.loads(_KEYS_PATH.read_text())
    return {}


class Config(BaseSettings):
    """All configuration fields used across the pipeline.

    Resolution order: keys.json value → environment variable (UPPER_CASE) → default.
    """

    # Azure OpenAI
    reducto_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_planner_deployment: str = "gpt-4o"
    azure_openai_htmlgen_deployment: str = "gpt-4o"

    # Azure TTS
    azure_tts_key: str = ""
    azure_tts_region: str = "eastus"

    # Rendering
    render_mode: str = "remotion"
    render_concurrency: int = 4
    assembly_concurrency: int = 4

    # Azure Blob Storage (optional)
    azure_storage_connection_string: str = ""
    azure_storage_container: str = "videos"

    model_config = {"env_prefix": "", "extra": "ignore"}

    def __init__(self, **kwargs: Any):
        # Merge keys.json values as defaults under env vars
        keys = _load_keys_json()
        merged = {**keys, **kwargs}
        super().__init__(**merged)


@lru_cache(maxsize=1)
def settings() -> Config:
    """Lazy singleton — created on first call, cached thereafter."""
    return Config()


# ── Backward compatibility ──────────────────────────────────────────────────
# All existing code uses `config.get("key_name")`. This keeps working.

def get(key: str) -> str:
    """Get a config value by name. Raises ValueError if empty."""
    val = getattr(settings(), key, "") or os.environ.get(key.upper(), "")
    if not val:
        raise ValueError(f"Missing config key: {key} (not in keys.json or env)")
    return val
