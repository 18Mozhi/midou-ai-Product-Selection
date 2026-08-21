import json
import hashlib
import os
import random
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import CrawlerConfig


class RuntimeClientError(RuntimeError):
    def __init__(self, code: str, retryable: bool = True):
        self.code = code
        self.retryable = retryable
        super().__init__(code)


@dataclass(frozen=True)
class CrawlerLease:
    job_id: str
    run_id: str
    profile_id: str
    lease_token: str
    request_id: str
    trace_id: str
    execution_request: dict[str, Any]
    credential: dict[str, Any]
    locale: str
    timezone: str


class CrawlerRuntimeClient:
    def __init__(self, config: CrawlerConfig, sleeper=time.sleep, random_source=random.random):
        self.config = config
        self._sleep = sleeper
        self._random = random_source

    def acquire(self) -> CrawlerLease | None:
        if not self.config.service_token:
            return None
        request_id = f"crawler-acquire-{uuid.uuid4()}"
        data = self._post(
            "/api/v1/internal/crawler-runtime/jobs/acquire",
            {
                "lease_owner": self.config.crawler_id,
                "lease_seconds": self.config.lease_seconds,
            },
            request_id,
            request_id,
            empty_is_none=True,
        )
        if data is None:
            return None
        assignment = data["data"]
        run = assignment["run"]
        job = assignment["job"]
        profile = assignment["profile"]
        token = assignment.get("lease_token")
        if not token:
            return None
        return CrawlerLease(str(job["id"]), str(run["id"]), str(profile["id"]), str(token), str(run["request_id"]), str(run["trace_id"]), dict(job["execution_request"]), dict(assignment["credential"]), str(profile["locale"]), str(profile["timezone"]))

    def heartbeat(self, lease: CrawlerLease) -> None:
        self._post(
            f"/api/v1/internal/crawler-runtime/jobs/{lease.job_id}/heartbeat",
            {"run_id": lease.run_id, "profile_id": lease.profile_id, "lease_token": lease.lease_token, "lease_seconds": self.config.lease_seconds},
            lease.request_id,
            lease.trace_id,
            max_attempts=1,
        )

    def complete(self, lease: CrawlerLease, result: dict[str, Any]) -> None:
        path = f"/api/v1/internal/crawler-runtime/jobs/{lease.job_id}/complete"
        body = {
                "run_id": lease.run_id,
                "profile_id": lease.profile_id,
                "lease_token": lease.lease_token,
                "status": self._terminal_status(str(result.get("status", "dependency_failed"))),
                "page_count": int(result.get("page_count", 0)),
                "item_count": int(result.get("item_count", 0)),
                "detail_count": int(result.get("detail_count", 0)),
                "duration_ms": int(result.get("duration_ms", 0)),
                "error_code": result.get("error_code"),
                "result": result,
            }
        try:
            self._post(
                path,
                body,
                lease.request_id,
                lease.trace_id,
                idempotency_key=f"crawler-complete:{lease.run_id}",
            )
        except RuntimeClientError:
            self._save_pending(path, body, lease.request_id, lease.trace_id)
            raise

    def flush_pending(self, limit: int = 10) -> tuple[int, int]:
        root = Path(self.config.completion_spool_root)
        if not root.exists():
            return (0, 0)
        completed = 0
        failed = 0
        for path in sorted(root.glob("*.json"))[:limit]:
            try:
                pending = json.loads(path.read_text(encoding="utf-8"))
                self._post(
                    str(pending["path"]),
                    dict(pending["body"]),
                    str(pending["request_id"]),
                    str(pending["trace_id"]),
                    idempotency_key=str(pending["idempotency_key"]),
                    max_attempts=1,
                )
                path.unlink()
                completed += 1
            except (OSError, ValueError, KeyError, TypeError, RuntimeClientError):
                failed += 1
        return (completed, failed)

    def _save_pending(
        self,
        path: str,
        body: dict[str, Any],
        request_id: str,
        trace_id: str,
    ) -> None:
        root = Path(self.config.completion_spool_root)
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        digest = hashlib.sha256(f"{path}\0{body.get('run_id', '')}".encode()).hexdigest()
        target = root / f"{digest}.json"
        temporary = root / f".{digest}.{uuid.uuid4().hex}.tmp"
        record = {
            "schema_version": 1,
            "path": path,
            "body": body,
            "request_id": request_id,
            "trace_id": trace_id,
            "idempotency_key": f"crawler-complete:{body.get('run_id', '')}",
        }
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        descriptor = os.open(temporary, flags, 0o600)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                json.dump(record, output, ensure_ascii=False, separators=(",", ":"))
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, target)
        finally:
            if temporary.exists():
                temporary.unlink()

    @staticmethod
    def _terminal_status(status: str) -> str:
        return {
            "succeeded": "succeeded",
            "succeeded_empty": "succeeded_empty",
            "blocked_login": "blocked",
            "blocked_captcha": "blocked",
            "blocked_robots": "blocked",
            "parser_changed": "blocked",
            "timeout": "timed_out",
            "rate_limited": "failed",
            "dependency_failed": "failed",
        }.get(status, "failed")

    def _post(self, path: str, body: dict[str, Any], request_id: str, trace_id: str, idempotency_key: str | None = None, empty_is_none: bool = False, max_attempts: int = 4) -> dict[str, Any] | None:
        headers = {
            "authorization": f"Bearer {self.config.service_token}",
            "content-type": "application/json",
            "x-request-id": request_id,
            "x-trace-id": trace_id,
        }
        if idempotency_key:
            headers["idempotency-key"] = idempotency_key
        for attempt in range(max_attempts):
            request = urllib.request.Request(
                f"{self.config.api_base_url}{path}",
                data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=15) as response:
                    if empty_is_none and response.status == 204:
                        return None
                    return json.load(response)
            except urllib.error.HTTPError as error:
                try:
                    payload = json.load(error)
                    code = str(payload.get("code") or payload.get("error", {}).get("code") or f"crawler_api_http_{error.code}")
                except (json.JSONDecodeError, AttributeError):
                    code = f"crawler_api_http_{error.code}"
                failure = RuntimeClientError(code, error.code >= 500)
            except (urllib.error.URLError, TimeoutError) as error:
                failure = RuntimeClientError("crawler_api_unavailable")
            if not failure.retryable or attempt + 1 >= max_attempts:
                raise failure
            base = min(2.0, 0.25 * (2**attempt))
            self._sleep(base * (0.5 + self._random()))
        raise RuntimeClientError("crawler_api_unavailable")
