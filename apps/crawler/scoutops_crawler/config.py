import hashlib
import json
import os
import re
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
    heartbeat_seconds: int
    credential_temp_root: str
    credentials_master_key_version: str


def load_config(env: dict[str, str] | None = None) -> CrawlerConfig:
    values = os.environ if env is None else env
    production = values.get("NODE_ENV", "development") == "production"
    master_key = values.get("CREDENTIALS_MASTER_KEY", "").strip()
    if production and len(master_key) < 32:
        raise ConfigError("CREDENTIALS_MASTER_KEY", "must contain at least 32 characters in production")
    crawler_id = values.get("CRAWLER_ID", "crawler-local").strip() or "crawler-local"
    evidence_root = values.get("EVIDENCE_ROOT", "./runtime/evidence").strip()
    credential_temp_root = values.get("CREDENTIAL_TEMP_ROOT", "./runtime/credential-tmp").strip()
    master_key_version = values.get("CREDENTIALS_MASTER_KEY_VERSION", "v1").strip()
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,80}", master_key_version):
        raise ConfigError(
            "CREDENTIALS_MASTER_KEY_VERSION",
            "must contain only letters, numbers, dot, underscore or hyphen",
        )
    try:
        heartbeat_seconds = int(values.get("CRAWLER_HEARTBEAT_SECONDS", "30"))
    except ValueError as error:
        raise ConfigError("CRAWLER_HEARTBEAT_SECONDS", "must be an integer from 5 to 60") from error
    if heartbeat_seconds < 5 or heartbeat_seconds > 60:
        raise ConfigError("CRAWLER_HEARTBEAT_SECONDS", "must be an integer from 5 to 60")
    safe = {
        "crawler_id": crawler_id,
        "evidence_root": evidence_root,
        "heartbeat_seconds": heartbeat_seconds,
        "master_key_present": bool(master_key),
        "master_key_version": master_key_version,
        "credential_temp_root": credential_temp_root,
    }
    fingerprint = hashlib.sha256(json.dumps(safe, sort_keys=True).encode()).hexdigest()
    return CrawlerConfig(crawler_id, evidence_root, master_key, fingerprint, heartbeat_seconds, credential_temp_root, master_key_version)
