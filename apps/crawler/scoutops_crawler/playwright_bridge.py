import json
import subprocess
from dataclasses import dataclass
from typing import Any

from .config import CrawlerConfig


class PlaywrightBridgeError(RuntimeError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class PlaywrightBridge:
    config: CrawlerConfig

    def run(self, request: dict[str, Any]) -> dict[str, Any]:
        if not request.get("request_id") or not request.get("trace_id"):
            raise PlaywrightBridgeError("crawler_correlation_missing")
        payload = dict(request)
        payload["temp_root"] = self.config.credential_temp_root
        try:
            completed = subprocess.run(
                [self.config.playwright_node_binary, self.config.playwright_runner_path],
                input=json.dumps(payload, ensure_ascii=False),
                text=True,
                capture_output=True,
                timeout=self.config.playwright_run_timeout_seconds,
                check=False,
                shell=False,
            )
        except subprocess.TimeoutExpired as error:
            raise PlaywrightBridgeError("crawler_runner_timeout") from error
        except OSError as error:
            raise PlaywrightBridgeError("crawler_runner_unavailable") from error
        try:
            result = json.loads(completed.stdout)
        except (json.JSONDecodeError, TypeError) as error:
            raise PlaywrightBridgeError("crawler_runner_invalid_output") from error
        if completed.returncode != 0 or not isinstance(result, dict):
            raise PlaywrightBridgeError(str(result.get("code", "crawler_runner_failed")))
        if result.get("request_id") != request["request_id"] or result.get("trace_id") != request["trace_id"]:
            raise PlaywrightBridgeError("crawler_correlation_mismatch")
        return result
