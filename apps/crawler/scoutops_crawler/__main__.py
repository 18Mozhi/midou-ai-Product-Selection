import argparse
import json
import os
import re
import signal
import threading
from datetime import datetime, timezone
from pathlib import Path
from .config import load_config
from .main_loop import run_loop, run_once as run_main_loop_once

ENV_KEY = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
SENSITIVE_LOG_KEY = re.compile(
    r"(?:password|secret|token|cookie|authorization|api[_-]?key|private[_-]?key|credential|master[_-]?key)",
    re.IGNORECASE,
)
SENSITIVE_LOG_VALUE = re.compile(
    r"(?i)\b(password|secret|token|cookie|authorization|api[_-]?key|private[_-]?key|credential|master[_-]?key)"
    r"(\s*[=:]\s*)([^\s,;]+)"
)


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

def redact_log_value(value, key: str = ""):
    """Remove credential material before a crawler event reaches BaoTa logs."""
    if key and SENSITIVE_LOG_KEY.search(key):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {name: redact_log_value(item, str(name)) for name, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact_log_value(item) for item in value]
    if isinstance(value, str):
        return SENSITIVE_LOG_VALUE.sub(r"\1\2[REDACTED]", value)
    return value


def event(config, status: str, **fields) -> None:
    safe_fields = redact_log_value(fields)
    print(
        json.dumps(
            {
                "service": "product-scout-crawler",
                "status": status,
                "crawler_id": config.crawler_id,
                "config_fingerprint": config.fingerprint,
                "observed_at": datetime.now(timezone.utc).isoformat(),
                **safe_fields,
            },
            ensure_ascii=False,
        ),
        flush=True,
    )


def run_once(config, stopped: threading.Event) -> bool:
    """Preserve the production one-cycle entrypoint while main-loop logic stays isolated."""
    return run_main_loop_once(config, stopped, event)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--env-file")
    args = parser.parse_args()
    load_env_file(args.env_file)
    config = load_config()
    stopped = threading.Event()

    def stop(_signum, _frame):
        stopped.set()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    run_loop(config, stopped, args.once, event)


if __name__ == "__main__":
    main()
