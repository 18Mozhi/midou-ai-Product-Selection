import argparse
import json
import signal
import threading
from datetime import datetime, timezone
from .config import load_config

def heartbeat(config, status="idle") -> None:
    print(json.dumps({"service":"product-scout-crawler","status":status,"crawler_id":config.crawler_id,"config_fingerprint":config.fingerprint,"observed_at":datetime.now(timezone.utc).isoformat()}, ensure_ascii=False), flush=True)

def main() -> None:
    parser=argparse.ArgumentParser();parser.add_argument("--once",action="store_true");args=parser.parse_args();config=load_config();heartbeat(config)
    if args.once:return
    stopped=threading.Event()
    def stop(_signum,_frame):stopped.set()
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    while not stopped.wait(config.heartbeat_seconds):heartbeat(config)
    heartbeat(config,"stopped")

if __name__ == "__main__":main()
