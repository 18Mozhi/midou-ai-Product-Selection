import argparse
import json
import os
import re
import signal
import threading
from datetime import datetime, timezone
from pathlib import Path
from .config import load_config
from .playwright_bridge import PlaywrightBridge, PlaywrightBridgeError
from .runtime_client import CrawlerRuntimeClient, RuntimeClientError

ENV_KEY = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def load_env_file(path: str | None) -> None:
    """Load a restricted KEY=VALUE file without invoking a shell."""
    if not path:
        return
    env_path = Path(path).resolve(strict=True)
    if not env_path.is_file():
        raise ValueError(f"environment file is not a regular file: {env_path}")
    for line_number, raw_line in enumerate(env_path.read_text(encoding="utf-8-sig").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"invalid environment entry at line {line_number}")
        key, value = line.split("=", 1)
        key = key.strip()
        if not ENV_KEY.fullmatch(key):
            raise ValueError(f"invalid environment key at line {line_number}")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        if "\x00" in value:
            raise ValueError(f"invalid environment value at line {line_number}")
        os.environ.setdefault(key, value)

def event(config, status: str, **fields) -> None:
    print(json.dumps({"service":"product-scout-crawler","status":status,"crawler_id":config.crawler_id,"config_fingerprint":config.fingerprint,"observed_at":datetime.now(timezone.utc).isoformat(), **fields}, ensure_ascii=False), flush=True)


def run_once(config, stopped: threading.Event) -> bool:
    client = CrawlerRuntimeClient(config)
    lease = client.acquire()
    if lease is None:
        return False
    event(config, "running", run_id=lease.run_id, request_id=lease.request_id, trace_id=lease.trace_id)
    heartbeat_stopped = threading.Event()

    def maintain_lease() -> None:
        interval = min(config.heartbeat_seconds, max(5, config.lease_seconds // 3))
        while not heartbeat_stopped.wait(interval) and not stopped.is_set():
            client.heartbeat(lease)

    thread = threading.Thread(target=maintain_lease, name="crawler-lease-heartbeat", daemon=True)
    thread.start()
    try:
        request = dict(lease.execution_request)
        request["request_id"] = lease.request_id
        request["trace_id"] = lease.trace_id
        request["credential"] = lease.credential
        request["master_key"] = config.credentials_master_key
        request["locale"] = lease.locale
        request["timezone"] = lease.timezone
        result = PlaywrightBridge(config).run(request)
    except (OSError, json.JSONDecodeError, PlaywrightBridgeError) as error:
        code = getattr(error, "code", "crawler_execution_request_invalid")
        result = {"status": "dependency_failed", "page_count": 0, "item_count": 0, "detail_count": 0, "duration_ms": 0, "error_code": code}
    finally:
        heartbeat_stopped.set()
        thread.join(timeout=2)
    client.complete(lease, result)
    event(config, "completed", run_id=lease.run_id, result_status=result.get("status"), error_code=result.get("error_code"), request_id=lease.request_id, trace_id=lease.trace_id)
    return True

def main() -> None:
    parser=argparse.ArgumentParser();parser.add_argument("--once",action="store_true");parser.add_argument("--env-file");args=parser.parse_args();load_env_file(args.env_file);config=load_config()
    stopped=threading.Event()
    def stop(_signum,_frame):stopped.set()
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    while not stopped.is_set():
        try:
            processed = run_once(config, stopped)
        except RuntimeClientError as error:
            event(config, "api_error", error_code=error.code)
            processed = False
        if args.once:
            break
        if not processed:
            stopped.wait(config.heartbeat_seconds)
    event(config,"stopped")

if __name__ == "__main__":main()
