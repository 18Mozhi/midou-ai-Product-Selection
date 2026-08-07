import json
import os
from datetime import datetime, timezone


def main() -> None:
    heartbeat = {
        "service": "product-scout-crawler",
        "status": "idle",
        "crawler_id": os.getenv("CRAWLER_ID", "crawler-local"),
        "observed_at": datetime.now(timezone.utc).isoformat(),
    }
    print(json.dumps(heartbeat, ensure_ascii=False))


if __name__ == "__main__":
    main()
