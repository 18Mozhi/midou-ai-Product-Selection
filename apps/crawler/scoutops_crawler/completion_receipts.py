import hashlib
import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import CrawlerConfig
from .lease_client import CrawlerLease
from .runtime_transport import CrawlerRuntimeTransport, RuntimeClientError


class CompletionReceiptClient:
    """Writes terminal results and replays durable completion receipts in creation order."""

    def __init__(self, config: CrawlerConfig, transport: CrawlerRuntimeTransport):
        self.config = config
        self.transport = transport

    def complete(self, lease: CrawlerLease, result: dict[str, Any]) -> None:
        path = f"/api/v1/internal/crawler-runtime/jobs/{lease.job_id}/complete"
        body = {
            "run_id": lease.run_id,
            "profile_id": lease.profile_id,
            "lease_token": lease.lease_token,
            "status": self.terminal_status(str(result.get("status", "dependency_failed"))),
            "page_count": int(result.get("page_count", 0)),
            "item_count": int(result.get("item_count", 0)),
            "detail_count": int(result.get("detail_count", 0)),
            "duration_ms": int(result.get("duration_ms", 0)),
            "error_code": result.get("error_code"),
            "result": result,
        }
        try:
            self.transport.post(
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
        pending_files = sorted(root.glob("*.json"), key=self._pending_sort_key)[:limit]
        for path in pending_files:
            try:
                pending = json.loads(path.read_text(encoding="utf-8"))
                self.transport.post(
                    str(pending["path"]),
                    dict(pending["body"]),
                    str(pending["request_id"]),
                    str(pending["trace_id"]),
                    idempotency_key=str(pending["idempotency_key"]),
                    max_attempts=1,
                )
                path.unlink()
                completed += 1
            except RuntimeClientError as error:
                self._record_failure(path, error.code, isolate=not error.retryable)
                failed += 1
            except (OSError, ValueError, KeyError, TypeError):
                self._quarantine(path)
                failed += 1
        return (completed, failed)

    def status(self) -> dict[str, Any]:
        """Return sanitized capacity facts; retention expiry only warns and never deletes receipts."""
        root = Path(self.config.completion_spool_root)
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        pending = list(root.glob("*.json"))
        quarantined = list((root / "quarantine").glob("*.json")) if (root / "quarantine").exists() else []
        oldest_pending_at = self._pending_sort_key(min(pending, key=self._pending_sort_key))[0] if pending else None
        return {
            "pending_count": len(pending),
            "pending_bytes": sum(self._file_size(path) for path in pending),
            "quarantined_count": len(quarantined),
            "quarantined_bytes": sum(self._file_size(path) for path in quarantined),
            "oldest_pending_at": oldest_pending_at,
            "retention_days": self.config.completion_spool_retention_days,
            "max_bytes": self.config.completion_spool_max_bytes,
            "minimum_free_disk_mb": self.config.completion_spool_minimum_free_disk_mb,
            "free_disk_mb": shutil.disk_usage(root).free // (1024 * 1024),
        }

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
            "created_at": datetime.now(timezone.utc).isoformat(),
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
    def _pending_sort_key(path: Path) -> tuple[str, str]:
        try:
            pending = json.loads(path.read_text(encoding="utf-8"))
            created_at = str(pending.get("created_at") or "")
            if created_at:
                return (created_at, path.name)
        except (OSError, ValueError, TypeError):
            pass
        try:
            modified_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
        except OSError:
            modified_at = datetime.fromtimestamp(0, timezone.utc).isoformat()
        return (modified_at, path.name)

    @staticmethod
    def _file_size(path: Path) -> int:
        try:
            return path.stat().st_size
        except OSError:
            return 0

    def _record_failure(self, path: Path, error_code: str, isolate: bool) -> None:
        try:
            pending = json.loads(path.read_text(encoding="utf-8"))
            pending["failure_count"] = int(pending.get("failure_count", 0)) + 1
            pending["last_error_code"] = error_code
            pending["last_failed_at"] = datetime.now(timezone.utc).isoformat()
            temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
            temporary.write_text(
                json.dumps(pending, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            os.replace(temporary, path)
            if isolate and pending["failure_count"] >= 2:
                self._quarantine(path)
        except (OSError, ValueError, TypeError):
            self._quarantine(path)

    def _quarantine(self, path: Path) -> None:
        try:
            root = Path(self.config.completion_spool_root) / "quarantine"
            root.mkdir(parents=True, exist_ok=True, mode=0o700)
            target = root / path.name
            if target.exists():
                target = root / f"{path.stem}.{uuid.uuid4().hex}{path.suffix}"
            os.replace(path, target)
        except OSError:
            return

    @staticmethod
    def terminal_status(status: str) -> str:
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
