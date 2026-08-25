import json
import random
import time
import urllib.error
import urllib.request
from typing import Any

from .config import CrawlerConfig


class RuntimeClientError(RuntimeError):
    def __init__(self, code: str, retryable: bool = True):
        self.code = code
        self.retryable = retryable
        super().__init__(code)


class CrawlerRuntimeTransport:
    """Bounded authenticated transport shared by lease and receipt clients."""

    def __init__(self, config: CrawlerConfig, sleeper=time.sleep, random_source=random.random):
        self.config = config
        self._sleep = sleeper
        self._random = random_source
        # The crawler API is an internal loopback hop. Do not inherit Windows or
        # host-level proxy settings, otherwise urllib can send 127.0.0.1 to the
        # system proxy and turn a healthy local API into a misleading 502.
        self._opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

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
        headers = {
            "authorization": f"Bearer {self.config.service_token}",
            "content-type": "application/json",
            "x-request-id": request_id,
            "x-trace-id": trace_id,
        }
        if idempotency_key:
            headers["idempotency-key"] = idempotency_key
        for attempt in range(max_attempts):
            request = urllib.request.Request(
                f"{self.config.api_base_url}{path}",
                data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            try:
                with self._opener.open(request, timeout=15) as response:
                    if empty_is_none and response.status == 204:
                        return None
                    return json.load(response)
            except urllib.error.HTTPError as error:
                try:
                    payload = json.load(error)
                    code = str(
                        payload.get("code")
                        or payload.get("error", {}).get("code")
                        or f"crawler_api_http_{error.code}"
                    )
                except (json.JSONDecodeError, AttributeError):
                    code = f"crawler_api_http_{error.code}"
                failure = RuntimeClientError(code, error.code >= 500)
            except (urllib.error.URLError, TimeoutError):
                failure = RuntimeClientError("crawler_api_unavailable")
            if not failure.retryable or attempt + 1 >= max_attempts:
                raise failure
            base = min(2.0, 0.25 * (2**attempt))
            self._sleep(base * (0.5 + self._random()))
        raise RuntimeClientError("crawler_api_unavailable")
