import io
import sys
import threading
import unittest
from http.client import RemoteDisconnected
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scoutops_crawler.config import load_config
from scoutops_crawler.main_loop import run_loop
from scoutops_crawler.runtime_transport import CrawlerRuntimeTransport, RuntimeClientError


class RuntimeDisconnectTest(unittest.TestCase):
    def test_disconnect_reuses_existing_retry_and_identical_request(self):
        delays = []
        client = CrawlerRuntimeTransport(load_config(), delays.append, lambda: 0.5)
        response = io.BytesIO(b'{"data":{"accepted":true}}')
        response.status = 200
        with patch.object(client._opener, "open", side_effect=[RemoteDisconnected("private"), response]) as send:
            result = client.post("/existing", {"value": 1}, "request", "trace", "idempotency")
        self.assertTrue(result["data"]["accepted"])
        self.assertEqual(delays, [0.25])
        first, second = [call.args[0] for call in send.call_args_list]
        self.assertEqual(first.full_url, second.full_url)
        self.assertEqual(first.data, second.data)
        self.assertEqual(first.headers, second.headers)

    def test_exhausted_disconnect_becomes_sanitized_runtime_error(self):
        client = CrawlerRuntimeTransport(load_config(), lambda _: None)
        with patch.object(client._opener, "open", side_effect=RemoteDisconnected("private")) as send:
            with self.assertRaises(RuntimeClientError) as raised:
                client.post("/existing", {}, "request", "trace")
        self.assertEqual(send.call_count, 4)
        self.assertEqual(raised.exception.code, "crawler_api_unavailable")
        self.assertNotIn("private", str(raised.exception))

    def test_disconnect_does_not_escape_loop_or_add_heartbeat_retries(self):
        sleeper = Mock()
        client = CrawlerRuntimeTransport(load_config(), sleeper)
        stopped = threading.Event()
        events = []
        def poll(*_args):
            client.post("/existing", {}, "request", "trace", max_attempts=1)
        with patch.object(client._opener, "open", side_effect=RemoteDisconnected("private")) as send:
            with patch("scoutops_crawler.main_loop.run_once", side_effect=poll):
                with patch.object(stopped, "wait", side_effect=lambda _: stopped.set()) as wait:
                    run_loop(SimpleNamespace(heartbeat_seconds=30, idle_poll_seconds=2), stopped, False,
                             lambda _config, status, **fields: events.append((status, fields)))
        send.assert_called_once()
        sleeper.assert_not_called()
        wait.assert_called_once_with(30)
        self.assertEqual(events, [("api_error", {"error_code": "crawler_api_unavailable"}), ("stopped", {})])
