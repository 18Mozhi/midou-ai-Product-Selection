import hashlib
import json
import os
from dataclasses import dataclass


class ConfigError(ValueError):
    def __init__(self, key: str, message: str):
        self.key = key
        self.code = "invalid_runtime_config"
        super().__init__(f"{key}: {message}")


@dataclass(frozen=True)
class CrawlerConfig:
    crawler_id: str
    evidence_root: str
    credentials_master_key: str
    fingerprint: str


def load_config(env: dict[str, str] | None = None) -> CrawlerConfig:
    values = os.environ if env is None else env
    production = values.get("NODE_ENV", "development") == "production"
    master_key = values.get("CREDENTIALS_MASTER_KEY", "").strip()
    if production and len(master_key) < 32:
        raise ConfigError("CREDENTIALS_MASTER_KEY", "must contain at least 32 characters in production")
    crawler_id = values.get("CRAWLER_ID", "crawler-local").strip() or "crawler-local"
    evidence_root = values.get("EVIDENCE_ROOT", "./runtime/evidence").strip()
    safe = {"crawler_id": crawler_id, "evidence_root": evidence_root, "master_key_present": bool(master_key)}
    fingerprint = hashlib.sha256(json.dumps(safe, sort_keys=True).encode()).hexdigest()
    return CrawlerConfig(crawler_id, evidence_root, master_key, fingerprint)
