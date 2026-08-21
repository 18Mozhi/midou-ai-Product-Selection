import hashlib
import json
import os
import re
from pathlib import Path
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
    playwright_node_binary: str
    playwright_runner_path: str
    playwright_run_timeout_seconds: int
    api_base_url: str
    service_token: str
    lease_seconds: int
    completion_spool_root: str


def load_config(env: dict[str, str] | None = None) -> CrawlerConfig:
    values = os.environ if env is None else env
    production = values.get("NODE_ENV", "development") == "production"
    master_key = values.get("CREDENTIALS_MASTER_KEY", "").strip()
    if production and len(master_key) < 32:
        raise ConfigError("CREDENTIALS_MASTER_KEY", "must contain at least 32 characters in production")
    crawler_id = values.get("CRAWLER_ID", "crawler-local").strip() or "crawler-local"
    evidence_root = values.get("EVIDENCE_ROOT", "./runtime/evidence").strip()
    credential_temp_root = values.get("CREDENTIAL_TEMP_ROOT", "./runtime/credential-tmp").strip()
    completion_spool_root = values.get(
        "CRAWLER_COMPLETION_SPOOL_ROOT", "./runtime/crawler-completions"
    ).strip()
    master_key_version = values.get("CREDENTIALS_MASTER_KEY_VERSION", "v1").strip()
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,80}", master_key_version):
        raise ConfigError(
            "CREDENTIALS_MASTER_KEY_VERSION",
            "must contain only letters, numbers, dot, underscore or hyphen",
        )
    playwright_node_binary = values.get("PLAYWRIGHT_NODE_BINARY", "node").strip()
    default_runner = Path(__file__).resolve().parents[3] / "scripts" / "run-playwright-crawler.mjs"
    playwright_runner_path = str(Path(values.get("PLAYWRIGHT_RUNNER_PATH", str(default_runner))).resolve())
    try:
        playwright_run_timeout_seconds = int(values.get("PLAYWRIGHT_RUN_TIMEOUT_SECONDS", "180"))
    except ValueError as error:
        raise ConfigError("PLAYWRIGHT_RUN_TIMEOUT_SECONDS", "must be an integer from 10 to 600") from error
    if not playwright_node_binary or playwright_run_timeout_seconds < 10 or playwright_run_timeout_seconds > 600:
        raise ConfigError("PLAYWRIGHT_RUN_TIMEOUT_SECONDS", "must be an integer from 10 to 600")
    try:
        heartbeat_seconds = int(values.get("CRAWLER_HEARTBEAT_SECONDS", "30"))
    except ValueError as error:
        raise ConfigError("CRAWLER_HEARTBEAT_SECONDS", "must be an integer from 5 to 60") from error
    if heartbeat_seconds < 5 or heartbeat_seconds > 60:
        raise ConfigError("CRAWLER_HEARTBEAT_SECONDS", "must be an integer from 5 to 60")
    api_base_url = values.get("CRAWLER_API_BASE_URL", "http://127.0.0.1:4101").strip().rstrip("/")
    service_token = values.get("CRAWLER_SERVICE_TOKEN", "").strip()
    try:
        lease_seconds = int(values.get("CRAWLER_LEASE_SECONDS", "120"))
    except ValueError as error:
        raise ConfigError("CRAWLER_LEASE_SECONDS", "must be an integer from 30 to 600") from error
    if lease_seconds < 30 or lease_seconds > 600:
        raise ConfigError("CRAWLER_LEASE_SECONDS", "must be an integer from 30 to 600")
    if production:
        if len(service_token) < 32:
            raise ConfigError("CRAWLER_SERVICE_TOKEN", "must contain at least 32 characters in production")
    safe = {
        "crawler_id": crawler_id,
        "evidence_root": evidence_root,
        "heartbeat_seconds": heartbeat_seconds,
        "master_key_present": bool(master_key),
        "master_key_version": master_key_version,
        "credential_temp_root": credential_temp_root,
        "playwright_runner_path": playwright_runner_path,
        "playwright_run_timeout_seconds": playwright_run_timeout_seconds,
        "api_base_url": api_base_url,
        "lease_seconds": lease_seconds,
        "completion_spool_root": completion_spool_root,
    }
    fingerprint = hashlib.sha256(json.dumps(safe, sort_keys=True).encode()).hexdigest()
    return CrawlerConfig(crawler_id, evidence_root, master_key, fingerprint, heartbeat_seconds, credential_temp_root, master_key_version, playwright_node_binary, playwright_runner_path, playwright_run_timeout_seconds, api_base_url, service_token, lease_seconds, completion_spool_root)
