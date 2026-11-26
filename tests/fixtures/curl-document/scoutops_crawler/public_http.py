"""Exercise the real helper/curl on an owned loopback server, never Amazon."""
import base64
import hashlib
import json
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "apps" / "crawler"))
from scoutops_crawler.public_http import fetch_document
from curl_cffi import __version__, requests


class OwnedSession:
    def __init__(self, **options):
        assert options == {"impersonate": "chrome", "trust_env": False}
        assert __version__ == "0.7.4", "use the already pinned project dependency"
        self.inner = requests.Session(**options)

    def __enter__(self):
        self.inner.__enter__()
        return self

    def __exit__(self, *args):
        return self.inner.__exit__(*args)

    def request(self, method, url, **options):
        parsed = urlsplit(url)
        assert parsed.scheme == "https" and parsed.netloc == "www.amazon.com"
        assert parsed.path == "/dp/B0H8GWY1HV"
        query = parse_qs(parsed.query)
        port = int(query["owned_port"][0])
        case = query["owned_case"][0]
        assert 1024 <= port <= 65535
        assert case in ("identity", "gzip", "chunked", "gzip_chunked", "utf16", "source_shell", "truncated")
        assert options["verify"] is True
        assert options["stream"] is True
        assert options["allow_redirects"] is False
        assert "proxy" not in options
        # Only this test adapter remaps the destination. Production validation,
        # streaming, decoding, limits, headers and base64 serialization are real.
        return self.inner.request(method, f"http://127.0.0.1:{port}/{case}", **options)


def main():
    try:
        result = fetch_document(json.load(sys.stdin), OwnedSession)
        digest = hashlib.sha256(base64.b64decode(result["body_base64"])).hexdigest()
        result["headers"].append(["x-owned-helper-sha256", digest])
    except Exception:
        print(json.dumps({"error": "owned_document_request_failed"}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
