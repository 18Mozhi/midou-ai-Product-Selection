import json
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Any

from .config import CrawlerConfig


class RuntimeClientError(RuntimeError):
    def __init__(self, code: str, retryable: bool = True):
        self.code = code
        self.retryable = retryable
        super().__init__(code)


@dataclass(frozen=True)
class CrawlerLease:
    run_id: str
    profile_id: str
    lease_token: str
    request_id: str
    trace_id: str


class CrawlerRuntimeClient:
    def __init__(self, config: CrawlerConfig):
        self.config = config

    def acquire(self) -> CrawlerLease | None:
        if not all((self.config.service_token, self.config.organization_id, self.config.workspace_id, self.config.profile_id)):
            return None
        request_id = f"crawler-acquire-{uuid.uuid4()}"
        data = self._post(
            "/api/v1/internal/crawler-runtime/acquire",
            {
                "organization_id": self.config.organization_id,
                "workspace_id": self.config.workspace_id,
                "profile_id": self.config.profile_id,
                "lease_owner": self.config.crawler_id,
                "lease_seconds": self.config.lease_seconds,
            },
            request_id,
            request_id,
            idempotency_key=str(uuid.uuid4()),
            conflict_is_empty=True,
        )
        if data is None:
            return None
        run = data["data"]["run"]
        token = data["data"].get("lease_token")
        if not token:
            return None
        return CrawlerLease(str(run["id"]), self.config.profile_id, str(token), str(run["request_id"]), str(run["trace_id"]))

    def heartbeat(self, lease: CrawlerLease) -> None:
        self._post(
            f"/api/v1/internal/crawler-runtime/{lease.run_id}/heartbeat",
            {"profile_id": lease.profile_id, "lease_token": lease.lease_token, "lease_seconds": self.config.lease_seconds},
            lease.request_id,
            lease.trace_id,
        )

    def complete(self, lease: CrawlerLease, result: dict[str, Any]) -> None:
        self._post(
            f"/api/v1/internal/crawler-runtime/{lease.run_id}/complete",
            {
                "profile_id": lease.profile_id,
                "lease_token": lease.lease_token,
                "status": self._terminal_status(str(result.get("status", "dependency_failed"))),
                "page_count": int(result.get("page_count", 0)),
                "item_count": int(result.get("item_count", 0)),
                "detail_count": int(result.get("detail_count", 0)),
                "duration_ms": int(result.get("duration_ms", 0)),
                "error_code": result.get("error_code"),
            },
            lease.request_id,
            lease.trace_id,
        )

    @staticmethod
    def _terminal_status(status: str) -> str:
        return {
            "succeeded": "succeeded",
            "succeeded_empty": "succeeded",
            "blocked_login": "blocked",
            "blocked_captcha": "blocked",
            "blocked_robots": "blocked",
            "parser_changed": "blocked",
            "timeout": "timed_out",
            "rate_limited": "failed",
            "dependency_failed": "failed",
        }.get(status, "failed")

    def _post(self, path: str, body: dict[str, Any], request_id: str, trace_id: str, idempotency_key: str | None = None, conflict_is_empty: bool = False) -> dict[str, Any] | None:
        headers = {
            "authorization": f"Bearer {self.config.service_token}",
            "content-type": "application/json",
            "x-request-id": request_id,
            "x-trace-id": trace_id,
        }
        if idempotency_key:
            headers["idempotency-key"] = idempotency_key
        request = urllib.request.Request(
            f"{self.config.api_base_url}{path}",
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if conflict_is_empty and error.code == 409:
                return None
            try:
                payload = json.load(error)
                code = str(payload.get("code") or payload.get("error", {}).get("code") or f"crawler_api_http_{error.code}")
            except (json.JSONDecodeError, AttributeError):
                code = f"crawler_api_http_{error.code}"
            raise RuntimeClientError(code, error.code >= 500) from error
        except (urllib.error.URLError, TimeoutError) as error:
            raise RuntimeClientError("crawler_api_unavailable") from error
