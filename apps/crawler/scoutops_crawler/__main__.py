import json
from datetime import datetime, timezone
from .config import load_config


def main() -> None:
    config = load_config()
    heartbeat = {
        "service": "product-scout-crawler",
        "status": "idle",
        "crawler_id": config.crawler_id,
        "config_fingerprint": config.fingerprint,
        "observed_at": datetime.now(timezone.utc).isoformat(),
    }
    print(json.dumps(heartbeat, ensure_ascii=False))


if __name__ == "__main__":
    main()
