import sys
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scoutops_crawler.main_loop import run_loop
from scoutops_crawler.runtime_transport import RuntimeClientError


class MainLoopHeartbeatTest(unittest.TestCase):
    def test_successful_empty_poll_waits_without_emitting_idle_heartbeat(self):
        config = SimpleNamespace(heartbeat_seconds=30)
        stopped = threading.Event()
        events = []
        with patch("scoutops_crawler.main_loop.run_once", return_value=False) as cycle:
            with patch.object(stopped, "wait", side_effect=lambda _seconds: stopped.set()) as wait:
                run_loop(config, stopped, False, lambda _config, status, **fields: events.append((status, fields)))
        cycle.assert_called_once_with(config, stopped, unittest.mock.ANY)
        wait.assert_called_once_with(30)
        self.assertEqual(events, [("stopped", {})])

    def test_failed_poll_never_emits_a_healthy_idle_event(self):
        config = SimpleNamespace(heartbeat_seconds=30)
        events = []
        with patch("scoutops_crawler.main_loop.run_once", side_effect=RuntimeClientError("unavailable")):
            run_loop(config, threading.Event(), True, lambda _config, status, **fields: events.append((status, fields)))
        self.assertEqual(events, [("api_error", {"error_code": "unavailable"}), ("stopped", {})])

    def test_processed_cycle_is_not_reported_as_idle(self):
        events = []
        with patch("scoutops_crawler.main_loop.run_once", return_value=True):
            run_loop(SimpleNamespace(heartbeat_seconds=30), threading.Event(), True,
                     lambda _config, status, **fields: events.append((status, fields)))
        self.assertEqual(events, [("stopped", {})])
