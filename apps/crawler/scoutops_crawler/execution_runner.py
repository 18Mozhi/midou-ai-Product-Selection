import json
import threading
from typing import Any

from .config import CrawlerConfig
from .lease_client import CrawlerLease
from .playwright_bridge import PlaywrightBridge, PlaywrightBridgeError


def execute_lease(
    config: CrawlerConfig,
    lease: CrawlerLease,
    heartbeat_failed: threading.Event,
) -> dict[str, Any]:
    """Build the bounded Playwright request and normalize execution failures."""
    try:
        request = dict(lease.execution_request)
        request["request_id"] = lease.request_id
        request["trace_id"] = lease.trace_id
        request["credential"] = lease.credential
        request["master_key"] = config.credentials_master_key
        request["locale"] = lease.locale
        request["timezone"] = lease.timezone
        return PlaywrightBridge(config).run(request, heartbeat_failed)
    except (OSError, json.JSONDecodeError, PlaywrightBridgeError) as error:
        code = getattr(error, "code", "crawler_execution_request_invalid")
        result: dict[str, Any] = {
            "status": "dependency_failed",
            "page_count": 0,
            "item_count": 0,
            "detail_count": 0,
            "duration_ms": 0,
            "error_code": code,
        }
        diagnostic = getattr(error, "stderr_diagnostic", None)
        if diagnostic:
            result["stderr_diagnostic"] = diagnostic
        return result


def heartbeat_failure_result(result: dict[str, Any], error_code: str) -> dict[str, Any]:
    normalized = {
        "status": "dependency_failed",
        "page_count": int(result.get("page_count", 0)),
        "item_count": int(result.get("item_count", 0)),
        "detail_count": int(result.get("detail_count", 0)),
        "duration_ms": int(result.get("duration_ms", 0)),
        "error_code": "crawler_heartbeat_failed",
        "heartbeat_error_code": error_code,
    }
    if result.get("stderr_diagnostic"):
        normalized["stderr_diagnostic"] = result["stderr_diagnostic"]
    return normalized
