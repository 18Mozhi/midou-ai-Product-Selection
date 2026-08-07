import sys
import unittest
from unittest.mock import Mock, patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scoutops_crawler.foundation import FoundationTask, validate_task
from scoutops_crawler.config import ConfigError, load_config
from scoutops_crawler.playwright_bridge import PlaywrightBridge, PlaywrightBridgeError


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


if __name__ == "__main__":
    unittest.main()
