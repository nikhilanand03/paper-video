"""Load configuration from keys.json (fallback to env vars)."""

from __future__ import annotations

import json
from pathlib import Path

_KEYS_PATH = Path(__file__).parent / "keys.json"
_config: dict[str, str] = {}


def _load() -> dict[str, str]:
    global _config
    if _config:
        return _config
    if _KEYS_PATH.exists():
        _config = json.loads(_KEYS_PATH.read_text())
    return _config


def get(key: str) -> str:
    """Get a config value from keys.json. Key names are lowercase with underscores."""
    import os
    cfg = _load()
    # Try keys.json first, then env var (uppercase)
    val = cfg.get(key) or os.environ.get(key.upper(), "")
    if not val:
        raise ValueError(f"Missing config key: {key} (not in keys.json or env)")
    return val
