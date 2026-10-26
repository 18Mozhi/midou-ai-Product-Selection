import base64
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scoutops_crawler.public_http import fetch_document
from scoutops_crawler.config import load_config
from scoutops_crawler.playwright_bridge import PlaywrightBridge


class Headers:
    def multi_items(self):
        return [("Content-Type", "text/html"), ("Set-Cookie", "fixture=1; Path=/; Secure"),
                ("Content-Encoding", "gzip"), ("Content-Length", "999")]


class Response:
    status_code = 503
    headers = Headers()
    closed = False

    def iter_content(self):
        yield b'<form action="/errors/validateCaptcha"></form>'

    def close(self):
        self.closed = True


class Session:
    def __init__(self, **kwargs):
        self.options = kwargs
        self.response = Response()
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def request(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return self.response


class PublicHttpTests(unittest.TestCase):
    @patch("scoutops_crawler.playwright_bridge.subprocess.Popen")
    def test_amazon_runtime_uses_own_python_and_module_not_caller_executable(self, popen):
        process = Mock(returncode=0)
        process.communicate.return_value = ('{"status":"succeeded_empty","request_id":"r","trace_id":"t"}', "")
        popen.return_value = process
        PlaywrightBridge(load_config()).run({"request_id": "r", "trace_id": "t", "purpose": "amazon_public",
                                             "public_http_runtime": {"executable": "untrusted", "script": "untrusted"}})
        sent = json.loads(process.communicate.call_args.kwargs["input"])
        self.assertEqual(sent["public_http_runtime"]["executable"], sys.executable)
        self.assertEqual(sent["public_http_runtime"]["script"], str(Path(__file__).parents[1] / "scoutops_crawler/public_http.py"))

    def payload(self):
        return {"url": "https://www.amazon.com/dp/B000000001/", "timeout_ms": 1000,
                "headers": {"cookie": "fixture-session=anonymous", "authorization": "fixture-private",
                            "user-agent": "obsolete", "sec-ch-ua": "obsolete", "x-amazon-s-swrs-version": "obsolete"}}

    def test_public_document_preserves_status_challenge_and_same_session_without_login(self):
        session = Session()
        result = fetch_document(self.payload(), lambda **kwargs: session)
        self.assertEqual(result["status"], 503)
        self.assertIn(b"validateCaptcha", base64.b64decode(result["body_base64"]))
        headers = session.calls[0][1]["headers"]
        self.assertEqual(headers["cookie"], "fixture-session=anonymous")
        self.assertEqual(headers["accept-language"], "en-US,en;q=0.9")
        for key in ["authorization", "user-agent", "sec-ch-ua", "x-amazon-s-swrs-version"]:
            self.assertNotIn(key, headers)
        self.assertFalse(session.calls[0][1]["allow_redirects"])
        self.assertTrue(session.response.closed)
        self.assertEqual([k for k, _ in result["headers"]], ["Content-Type", "Set-Cookie"])
        self.assertEqual(len(session.calls), 1)

    def test_invalid_origin_budget_and_method_never_fetch(self):
        for changes in [{"url": "https://example.test/"}, {"url": "http://www.amazon.com/"},
                        {"url": "https://user:secret@www.amazon.com/"}, {"timeout_ms": 0},
                        {"timeout_ms": True}, {"method": "DELETE"}]:
            with self.assertRaises(ValueError):
                fetch_document({**self.payload(), **changes}, lambda **kwargs: self.fail("must not fetch"))

    def test_oversized_response_is_closed_and_never_returned(self):
        session = Session()
        session.response.iter_content = lambda: iter([b"x" * (8 * 1024 * 1024 + 1)])
        with self.assertRaises(ValueError):
            fetch_document(self.payload(), lambda **kwargs: session)
        self.assertTrue(session.response.closed)


if __name__ == "__main__":
    unittest.main()
