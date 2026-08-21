import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from unittest.mock import Mock, patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scoutops_crawler.foundation import FoundationTask, validate_task
from scoutops_crawler.config import ConfigError, load_config
from scoutops_crawler.playwright_bridge import PlaywrightBridge, PlaywrightBridgeError, sanitize_stderr
from scoutops_crawler.__main__ import event, load_env_file
from scoutops_crawler.runtime_client import CrawlerLease, CrawlerRuntimeClient, RuntimeClientError


class FoundationTaskTest(unittest.TestCase):
    def test_accepts_scoped_task(self) -> None:
        task = FoundationTask("task-1", "org-1", "workspace-1", "req-1", "trace-1")
        self.assertEqual(validate_task(task), task)

    def test_rejects_missing_organization(self) -> None:
        task = FoundationTask("task-1", "", "workspace-1", "req-1", "trace-1")
        with self.assertRaisesRegex(ValueError, "organization_id"):
            validate_task(task)

    def test_production_requires_master_key_without_echoing_value(self) -> None:
        with self.assertRaises(ConfigError) as raised:
            load_config({"NODE_ENV": "production", "CREDENTIALS_MASTER_KEY": "too-short"})
        self.assertNotIn("too-short", str(raised.exception))

    def test_credential_key_version_matches_node_runtime_contract(self) -> None:
        with self.assertRaises(ConfigError) as raised:
            load_config({"CREDENTIALS_MASTER_KEY_VERSION": "version with spaces"})
        self.assertEqual(raised.exception.key, "CREDENTIALS_MASTER_KEY_VERSION")

    def test_command_mode_loads_restricted_env_without_shell_or_overriding_panel_values(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "runtime.env"
            path.write_text("# managed by BaoTa\nCRAWLER_ID=from-file\nQUOTED_VALUE='kept private'\n", encoding="utf-8")
            with patch.dict(os.environ, {"CRAWLER_ID": "panel-wins"}, clear=True):
                load_env_file(str(path))
                self.assertEqual(os.environ["CRAWLER_ID"], "panel-wins")
                self.assertEqual(os.environ["QUOTED_VALUE"], "kept private")

    def test_command_mode_rejects_malformed_env_entry_without_echoing_value(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "runtime.env"
            path.write_text("INVALID-KEY=secret-value\n", encoding="utf-8")
            with self.assertRaises(ValueError) as raised:
                load_env_file(str(path))
            self.assertNotIn("secret-value", str(raised.exception))

    def test_structured_events_redact_cookie_token_and_nested_credentials(self) -> None:
        output = io.StringIO()
        with redirect_stdout(output):
            event(
                load_config(),
                "security_probe",
                request_id="request-safe",
                detail="cookie=session-secret authorization=Bearer-secret",
                credential={"cookies": [{"name": "sid", "value": "nested-secret"}]},
                lease_token="lease-secret",
            )
        serialized = output.getvalue()
        payload = json.loads(serialized)
        self.assertEqual(payload["request_id"], "request-safe")
        self.assertNotIn("session-secret", serialized)
        self.assertNotIn("Bearer-secret", serialized)
        self.assertNotIn("nested-secret", serialized)
        self.assertNotIn("lease-secret", serialized)
        self.assertEqual(payload["credential"], "[REDACTED]")
        self.assertEqual(payload["lease_token"], "[REDACTED]")

    @patch("scoutops_crawler.playwright_bridge.subprocess.Popen")
    def test_playwright_bridge_uses_stdin_without_shell_and_checks_correlation(self, popen: Mock) -> None:
        config = load_config({"PLAYWRIGHT_NODE_BINARY": "node-test", "PLAYWRIGHT_RUNNER_PATH": "runner.mjs"})
        process = Mock(returncode=0)
        process.communicate.return_value = (
            '{"status":"succeeded_empty","request_id":"r1","trace_id":"t1"}',
            "warning token=private-value",
        )
        popen.return_value = process
        result = PlaywrightBridge(config).run({"request_id": "r1", "trace_id": "t1", "plan": {}})
        self.assertEqual(result["status"], "succeeded_empty")
        self.assertEqual(result["stderr_diagnostic"], "warning token=[REDACTED]")
        _, kwargs = popen.call_args
        self.assertFalse(kwargs["shell"])
        self.assertIn('"request_id": "r1"', process.communicate.call_args.kwargs["input"])

    @patch("scoutops_crawler.playwright_bridge.subprocess.Popen")
    def test_playwright_bridge_fails_closed_on_invalid_output(self, popen: Mock) -> None:
        process = Mock(returncode=2)
        process.communicate.return_value = ('{"code":"blocked_captcha"}', "Cookie: hidden")
        popen.return_value = process
        with self.assertRaises(PlaywrightBridgeError):
            PlaywrightBridge(load_config()).run({"request_id": "r1", "trace_id": "t1"})

    @patch("scoutops_crawler.playwright_bridge.subprocess.Popen")
    def test_playwright_bridge_stops_process_when_heartbeat_fails(self, popen: Mock) -> None:
        import subprocess
        import threading

        process = Mock(returncode=None)
        process.communicate.side_effect = [
            subprocess.TimeoutExpired("runner", 0.25),
            ("", "authorization=private-value"),
        ]
        popen.return_value = process
        cancelled = threading.Event()
        cancelled.set()
        with self.assertRaisesRegex(PlaywrightBridgeError, "crawler_heartbeat_failed") as raised:
            PlaywrightBridge(load_config()).run(
                {"request_id": "r1", "trace_id": "t1"}, cancelled
            )
        process.terminate.assert_called_once()
        self.assertNotIn("private-value", raised.exception.stderr_diagnostic)

    def test_stderr_diagnostic_is_bounded_and_redacted(self) -> None:
        diagnostic = sanitize_stderr("Bearer abc token=secret " + ("x" * 5000))
        self.assertNotIn("abc", diagnostic)
        self.assertNotIn("secret", diagnostic)
        self.assertLessEqual(len(diagnostic), 4000)

    def test_runtime_client_maps_playwright_results_to_terminal_api_status(self) -> None:
        client = CrawlerRuntimeClient(load_config())
        self.assertEqual(client._terminal_status("blocked_login"), "blocked")
        self.assertEqual(client._terminal_status("timeout"), "timed_out")
        self.assertEqual(client._terminal_status("succeeded_empty"), "succeeded_empty")

    def test_runtime_client_heartbeat_fails_without_retry_delay(self) -> None:
        sleeper = Mock()
        client = CrawlerRuntimeClient(load_config({"CRAWLER_SERVICE_TOKEN": "service-token"}), sleeper=sleeper)
        lease = CrawlerLease(
            "job-1", "run-1", "profile-1", "x" * 64, "request-1", "trace-1", {}, {}, "zh-CN", "Asia/Shanghai"
        )
        with patch(
            "scoutops_crawler.runtime_client.urllib.request.urlopen",
            side_effect=urllib.error.URLError("down"),
        ):
            with self.assertRaises(RuntimeClientError):
                client.heartbeat(lease)
        sleeper.assert_not_called()

    def test_runtime_client_uses_bounded_exponential_backoff_with_jitter(self) -> None:
        delays = []
        response = io.BytesIO(b'{"data":{"accepted":true}}')
        response.status = 200
        client = CrawlerRuntimeClient(
            load_config({"CRAWLER_SERVICE_TOKEN": "service-token"}),
            sleeper=delays.append,
            random_source=lambda: 0.5,
        )
        with patch(
            "scoutops_crawler.runtime_client.urllib.request.urlopen",
            side_effect=[
                urllib.error.URLError("down-1"),
                urllib.error.URLError("down-2"),
                response,
            ],
        ):
            result = client._post("/retry", {}, "request-1", "trace-1")
        self.assertEqual(result["data"]["accepted"], True)
        self.assertEqual(delays, [0.25, 0.5])

    def test_failed_completion_is_spooled_and_retried(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            config = load_config({
                "CRAWLER_SERVICE_TOKEN": "service-token",
                "CRAWLER_COMPLETION_SPOOL_ROOT": directory,
            })
            client = CrawlerRuntimeClient(config, sleeper=lambda _seconds: None)
            lease = CrawlerLease(
                "job-1", "run-1", "profile-1", "x" * 64, "request-1", "trace-1", {}, {}, "zh-CN", "Asia/Shanghai"
            )
            with patch.object(client, "_post", side_effect=RuntimeClientError("crawler_api_unavailable")):
                with self.assertRaises(RuntimeClientError):
                    client.complete(lease, {"status": "succeeded_empty"})
            pending = list(Path(directory).glob("*.json"))
            self.assertEqual(len(pending), 1)
            self.assertNotIn("credential", pending[0].read_text(encoding="utf-8"))
            with patch.object(client, "_post", return_value={"data": {}}):
                self.assertEqual(client.flush_pending(), (1, 0))
            self.assertEqual(list(Path(directory).glob("*.json")), [])

    def test_runtime_client_does_not_claim_without_scoped_assignment(self) -> None:
        client = CrawlerRuntimeClient(load_config())
        self.assertIsNone(client.acquire())

    def test_runtime_client_claims_business_browser_job_without_static_request_file(self) -> None:
        config = load_config({"CRAWLER_SERVICE_TOKEN": "service-token"})
        client = CrawlerRuntimeClient(config)
        assignment = {
            "data": {
                "job": {
                    "id": "job-1",
                    "execution_request": {"plan": {"start_url": "https://s.1688.com/"}},
                },
                "run": {"id": "run-1", "request_id": "request-1", "trace_id": "trace-1"},
                "profile": {"id": "profile-1", "locale": "zh-CN", "timezone": "Asia/Shanghai"},
                "credential": {"asset_id": "asset-1", "kind": "cookie_bundle"},
                "lease_token": "x" * 64,
            }
        }
        with patch.object(client, "_post", return_value=assignment) as post:
            lease = client.acquire()
        self.assertIsNotNone(lease)
        self.assertEqual(lease.job_id, "job-1")
        self.assertEqual(lease.execution_request["plan"]["start_url"], "https://s.1688.com/")
        self.assertEqual(post.call_args.args[0], "/api/v1/internal/crawler-runtime/jobs/acquire")

    def test_production_crawler_no_longer_requires_static_scope_or_request_file(self) -> None:
        config = load_config({
            "NODE_ENV": "production",
            "CREDENTIALS_MASTER_KEY": "m" * 32,
            "CRAWLER_SERVICE_TOKEN": "s" * 32,
        })
        self.assertEqual(config.lease_seconds, 120)
        self.assertFalse(hasattr(config, "execution_request_file"))


if __name__ == "__main__":
    unittest.main()
