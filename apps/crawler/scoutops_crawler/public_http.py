"""Bounded anonymous Amazon document fetch; JSON stdin/stdout, never logs bodies."""
import base64
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit

# The official deployment installs this dependency inside this project's Python
# package, never into BaoTa's shared interpreter or another application's env.
_dependencies = Path(__file__).resolve().parents[1] / ".runtime-deps"
if _dependencies.is_dir():
    sys.path.insert(0, str(_dependencies))

MAX_BODY = 8 * 1024 * 1024


def fetch_document(payload, session_factory=None):
    url = payload.get("url", "")
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.hostname != "www.amazon.com"
            or parsed.port not in (None, 443) or parsed.username or parsed.password or parsed.fragment):
        raise ValueError("public_http_origin_forbidden")
    method = payload.get("method", "GET")
    if method not in ("GET", "POST"):
        raise ValueError("public_http_method_forbidden")
    timeout = payload.get("timeout_ms")
    if type(timeout) is not int or not 1 <= timeout <= 120000:
        raise ValueError("public_http_timeout_invalid")
    headers = {}
    for key, value in payload.get("headers", {}).items():
        lower = key.lower()
        if lower in ("authorization", "proxy-authorization", "host", "content-length",
                     "user-agent", "content-type", "origin", "x-requested-with") or lower.startswith(("sec-ch-", "x-amazon-")):
            continue
        if not isinstance(value, str) or "\r" in value or "\n" in value:
            raise ValueError("public_http_header_invalid")
        headers[lower] = value
    headers["accept-language"] = "en-US,en;q=0.9"
    headers["accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    body = base64.b64decode(payload.get("body_base64", ""), validate=True)
    if len(body) > 1048576:
        raise ValueError("public_http_request_too_large")
    if method == "POST":
        content_type = payload.get("headers", {}).get("content-type")
        if isinstance(content_type, str) and "\r" not in content_type and "\n" not in content_type:
            headers["content-type"] = content_type
    if session_factory is None:
        from curl_cffi import requests
        session_factory = requests.Session
    # Match the source projects' Chrome TLS profile without copying their stale
    # UA/client hints or cookies. Browser-issued Cookie travels only in stdin.
    with session_factory(impersonate="chrome", trust_env=False) as session:
        response = session.request(method, url, headers=headers, data=body or None,
                                   timeout=timeout / 1000, allow_redirects=False, verify=True,
                                   stream=True, **({"proxy": payload["proxy"]} if payload.get("proxy") else {}))
        try:
            chunks, size = [], 0
            for chunk in response.iter_content():
                size += len(chunk)
                if size > MAX_BODY:
                    raise ValueError("public_http_response_too_large")
                chunks.append(chunk)
            # libcurl decoded the representation; do not replay encoding/length.
            pairs = [(k, v) for k, v in response.headers.multi_items()
                     if k.lower() not in ("content-encoding", "content-length", "transfer-encoding", "connection")]
            return {"status": response.status_code, "headers": pairs,
                    "body_base64": base64.b64encode(b"".join(chunks)).decode("ascii")}
        finally:
            response.close()


def main():
    try:
        raw = sys.stdin.buffer.read(2 * 1024 * 1024 + 1)
        if len(raw) > 2 * 1024 * 1024:
            raise ValueError("public_http_input_too_large")
        result = fetch_document(json.loads(raw))
    except Exception:
        # Never emit exceptions containing cookies, URLs, proxy credentials or HTML.
        print(json.dumps({"error": "public_http_request_failed"}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
