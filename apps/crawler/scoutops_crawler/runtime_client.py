import random
import time
from typing import Any

from .completion_receipts import CompletionReceiptClient
from .config import CrawlerConfig
from .lease_client import CrawlerLease, CrawlerLeaseClient
from .runtime_transport import CrawlerRuntimeTransport, RuntimeClientError


class CrawlerRuntimeClient:
    """Compatibility facade over transport, lease and completion receipt modules."""

    def __init__(self, config: CrawlerConfig, sleeper=time.sleep, random_source=random.random):
        self.config = config
        self._transport = CrawlerRuntimeTransport(config, sleeper, random_source)
        self._leases = CrawlerLeaseClient(config, self)
        self._receipts = CompletionReceiptClient(config, self)

    def acquire(self) -> CrawlerLease | None:
        return self._leases.acquire()

    def heartbeat(self, lease: CrawlerLease) -> None:
        self._leases.heartbeat(lease)

    def complete(self, lease: CrawlerLease, result: dict[str, Any]) -> None:
        self._receipts.complete(lease, result)

    def flush_pending(self, limit: int = 10) -> tuple[int, int]:
        return self._receipts.flush_pending(limit)

    def receipt_status(self) -> dict[str, Any]:
        return self._receipts.status()

    def post(
        self,
        path: str,
        body: dict[str, Any],
        request_id: str,
        trace_id: str,
        idempotency_key: str | None = None,
        empty_is_none: bool = False,
        max_attempts: int = 4,
    ) -> dict[str, Any] | None:
        return self._post(
            path,
            body,
            request_id,
            trace_id,
            idempotency_key,
            empty_is_none,
            max_attempts,
        )

    def _post(
        self,
        path: str,
        body: dict[str, Any],
        request_id: str,
        trace_id: str,
        idempotency_key: str | None = None,
        empty_is_none: bool = False,
        max_attempts: int = 4,
    ) -> dict[str, Any] | None:
        return self._transport.post(
            path,
            body,
            request_id,
            trace_id,
            idempotency_key,
            empty_is_none,
            max_attempts,
        )

    @staticmethod
    def _terminal_status(status: str) -> str:
        return CompletionReceiptClient.terminal_status(status)
