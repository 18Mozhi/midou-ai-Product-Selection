import threading
from collections.abc import Callable
from typing import Any

from .config import CrawlerConfig
from .execution_runner import execute_lease, heartbeat_failure_result
from .runtime_client import CrawlerRuntimeClient, RuntimeClientError

EventWriter = Callable[..., None]


def run_once(config: CrawlerConfig, stopped: threading.Event, event: EventWriter) -> bool:
    client = CrawlerRuntimeClient(config)
    flushed, pending = client.flush_pending()
    if flushed or pending:
        event(config, "completion_retry", completed=flushed, pending=pending)
    lease = client.acquire()
    if lease is None:
        return False
    event(
        config,
        "running",
        run_id=lease.run_id,
        request_id=lease.request_id,
        trace_id=lease.trace_id,
    )
    heartbeat_stopped = threading.Event()
    heartbeat_failed = threading.Event()
    heartbeat_error: list[str] = []

    def maintain_lease() -> None:
        interval = min(config.heartbeat_seconds, max(5, config.lease_seconds // 3))
        while not heartbeat_stopped.wait(interval) and not stopped.is_set():
            try:
                client.heartbeat(lease)
            except RuntimeClientError as error:
                heartbeat_error.append(error.code)
                heartbeat_failed.set()
                return

    thread = threading.Thread(target=maintain_lease, name="crawler-lease-heartbeat", daemon=True)
    thread.start()
    try:
        result = execute_lease(config, lease, heartbeat_failed)
    finally:
        heartbeat_stopped.set()
        thread.join(timeout=2)
    if heartbeat_error:
        result = heartbeat_failure_result(result, heartbeat_error[0])
    client.complete(lease, result)
    event(
        config,
        "completed",
        run_id=lease.run_id,
        result_status=result.get("status"),
        error_code=result.get("error_code"),
        request_id=lease.request_id,
        trace_id=lease.trace_id,
    )
    return True


def run_loop(
    config: CrawlerConfig,
    stopped: threading.Event,
    once: bool,
    event: EventWriter,
) -> None:
    while not stopped.is_set():
        try:
            processed = run_once(config, stopped, event)
        except RuntimeClientError as error:
            event(config, "api_error", error_code=error.code)
            processed = False
        if once:
            break
        if not processed:
            stopped.wait(config.heartbeat_seconds)
    event(config, "stopped")
