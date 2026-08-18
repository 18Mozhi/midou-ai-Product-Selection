import argparse
import json
import os
import re
import signal
import threading
from datetime import datetime, timezone
from pathlib import Path
from .config import load_config

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

def heartbeat(config, status="idle") -> None:
    print(json.dumps({"service":"product-scout-crawler","status":status,"crawler_id":config.crawler_id,"config_fingerprint":config.fingerprint,"observed_at":datetime.now(timezone.utc).isoformat()}, ensure_ascii=False), flush=True)

def main() -> None:
    parser=argparse.ArgumentParser();parser.add_argument("--once",action="store_true");parser.add_argument("--env-file");args=parser.parse_args();load_env_file(args.env_file);config=load_config();heartbeat(config)
    if args.once:return
    stopped=threading.Event()
    def stop(_signum,_frame):stopped.set()
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    while not stopped.wait(config.heartbeat_seconds):heartbeat(config)
    heartbeat(config,"stopped")

if __name__ == "__main__":main()
