import json
import re
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Any

from .config import CrawlerConfig


class PlaywrightBridgeError(RuntimeError):
    def __init__(self, code: str, stderr_diagnostic: str | None = None):
        self.code = code
        self.stderr_diagnostic = stderr_diagnostic
        super().__init__(code)


SENSITIVE_STDERR = re.compile(
    r"(?i)(password|secret|token|cookie|authorization|api[_-]?key|private[_-]?key|credential)"
    r"(\s*[=:]\s*)([^\s,;]+)"
)
BEARER_STDERR = re.compile(r"(?i)\bBearer\s+[^\s,;]+")


def sanitize_stderr(value: str | None) -> str | None:
    if not value:
        return None
    diagnostic = SENSITIVE_STDERR.sub(r"\1\2[REDACTED]", value)
    diagnostic = BEARER_STDERR.sub("Bearer [REDACTED]", diagnostic)
    diagnostic = " ".join(diagnostic.replace("\x00", "").split())
    return diagnostic[:4000] or None


@dataclass(frozen=True)
class PlaywrightBridge:
    config: CrawlerConfig

    def run(
        self,
        request: dict[str, Any],
        cancelled: threading.Event | None = None,
    ) -> dict[str, Any]:
        if not request.get("request_id") or not request.get("trace_id"):
            raise PlaywrightBridgeError("crawler_correlation_missing")
        payload = dict(request)
        payload["temp_root"] = self.config.credential_temp_root
        try:
            process = subprocess.Popen(
                [self.config.playwright_node_binary, self.config.playwright_runner_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=False,
            )
        except OSError as error:
            raise PlaywrightBridgeError("crawler_runner_unavailable") from error
        deadline = time.monotonic() + self.config.playwright_run_timeout_seconds
        input_text: str | None = json.dumps(payload, ensure_ascii=False)
        while True:
            try:
                stdout, stderr = process.communicate(input=input_text, timeout=0.25)
                break
            except subprocess.TimeoutExpired:
                input_text = None
                if cancelled is not None and cancelled.is_set():
                    stderr = self._terminate(process)
                    raise PlaywrightBridgeError("crawler_heartbeat_failed", sanitize_stderr(stderr))
                if time.monotonic() >= deadline:
                    stderr = self._terminate(process)
                    raise PlaywrightBridgeError("crawler_runner_timeout", sanitize_stderr(stderr))
        diagnostic = sanitize_stderr(stderr)
        try:
            result = json.loads(stdout)
        except (json.JSONDecodeError, TypeError) as error:
            raise PlaywrightBridgeError("crawler_runner_invalid_output", diagnostic) from error
        if process.returncode != 0 or not isinstance(result, dict):
            code = str(result.get("code", "crawler_runner_failed")) if isinstance(result, dict) else "crawler_runner_failed"
            raise PlaywrightBridgeError(code, diagnostic)
        if result.get("request_id") != request["request_id"] or result.get("trace_id") != request["trace_id"]:
            raise PlaywrightBridgeError("crawler_correlation_mismatch", diagnostic)
        if diagnostic:
            result["stderr_diagnostic"] = diagnostic
        return result

    @staticmethod
    def _terminate(process: subprocess.Popen[str]) -> str:
        process.terminate()
        try:
            _, stderr = process.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()
            _, stderr = process.communicate()
        return stderr
