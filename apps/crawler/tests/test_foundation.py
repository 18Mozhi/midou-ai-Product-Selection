import os
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scoutops_crawler.foundation import FoundationTask, validate_task
from scoutops_crawler.config import ConfigError, load_config
from scoutops_crawler.playwright_bridge import PlaywrightBridge, PlaywrightBridgeError
from scoutops_crawler.__main__ import load_env_file
from scoutops_crawler.runtime_client import CrawlerRuntimeClient


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

    @patch("scoutops_crawler.playwright_bridge.subprocess.run")
    def test_playwright_bridge_uses_stdin_without_shell_and_checks_correlation(self, run: Mock) -> None:
        config = load_config({"PLAYWRIGHT_NODE_BINARY": "node-test", "PLAYWRIGHT_RUNNER_PATH": "runner.mjs"})
        run.return_value = Mock(returncode=0, stdout='{"status":"succeeded_empty","request_id":"r1","trace_id":"t1"}')
        result = PlaywrightBridge(config).run({"request_id": "r1", "trace_id": "t1", "plan": {}})
        self.assertEqual(result["status"], "succeeded_empty")
        _, kwargs = run.call_args
        self.assertFalse(kwargs["shell"])
        self.assertIn('"request_id": "r1"', kwargs["input"])

    @patch("scoutops_crawler.playwright_bridge.subprocess.run")
    def test_playwright_bridge_fails_closed_on_invalid_output(self, run: Mock) -> None:
        run.return_value = Mock(returncode=2, stdout='{"code":"blocked_captcha"}')
        with self.assertRaises(PlaywrightBridgeError):
            PlaywrightBridge(load_config()).run({"request_id": "r1", "trace_id": "t1"})

    def test_runtime_client_maps_playwright_results_to_terminal_api_status(self) -> None:
        client = CrawlerRuntimeClient(load_config())
        self.assertEqual(client._terminal_status("blocked_login"), "blocked")
        self.assertEqual(client._terminal_status("timeout"), "timed_out")
        self.assertEqual(client._terminal_status("succeeded_empty"), "succeeded")

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
