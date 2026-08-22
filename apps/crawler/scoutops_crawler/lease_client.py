import uuid
from dataclasses import dataclass
from typing import Any

from .config import CrawlerConfig
from .runtime_transport import CrawlerRuntimeTransport


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


class CrawlerLeaseClient:
    """Claims browser jobs and maintains their short-lived lease."""

    def __init__(self, config: CrawlerConfig, transport: CrawlerRuntimeTransport):
        self.config = config
        self.transport = transport

    def acquire(self) -> CrawlerLease | None:
        if not self.config.service_token:
            return None
        request_id = f"crawler-acquire-{uuid.uuid4()}"
        data = self.transport.post(
            "/api/v1/internal/crawler-runtime/jobs/acquire",
            {
                "lease_owner": self.config.crawler_id,
                "lease_seconds": self.config.lease_seconds,
                "completion_spool": self.transport.receipt_status(),
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
        return CrawlerLease(
            str(job["id"]),
            str(run["id"]),
            str(profile["id"]),
            str(token),
            str(run["request_id"]),
            str(run["trace_id"]),
            dict(job["execution_request"]),
            dict(assignment["credential"]),
            str(profile["locale"]),
            str(profile["timezone"]),
        )

    def heartbeat(self, lease: CrawlerLease) -> None:
        self.transport.post(
            f"/api/v1/internal/crawler-runtime/jobs/{lease.job_id}/heartbeat",
            {
                "run_id": lease.run_id,
                "profile_id": lease.profile_id,
                "lease_token": lease.lease_token,
                "lease_seconds": self.config.lease_seconds,
            },
            lease.request_id,
            lease.trace_id,
            max_attempts=1,
        )
