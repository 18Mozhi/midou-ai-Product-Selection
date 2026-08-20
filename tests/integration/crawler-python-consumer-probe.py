import threading
import time

from scoutops_crawler import __main__ as crawler_main
from scoutops_crawler.config import load_config


class DeterministicPlaywrightBridge:
    """Keep the real consumer lease alive without starting a second browser process."""

    def __init__(self, _config):
        pass

    def run(self, request):
        time.sleep(5.2)
        return {
            "status": "succeeded",
            "page_count": 1,
            "item_count": 2,
            "detail_count": 0,
            "duration_ms": 5200,
            "error_code": None,
            "request_id": request["request_id"],
            "trace_id": request["trace_id"],
        }


crawler_main.PlaywrightBridge = DeterministicPlaywrightBridge
processed = crawler_main.run_once(load_config(), threading.Event())
print(f"consumer_processed={str(processed).lower()}", flush=True)
