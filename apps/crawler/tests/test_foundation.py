import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scoutops_crawler.foundation import FoundationTask, validate_task
from scoutops_crawler.config import ConfigError, load_config


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


if __name__ == "__main__":
    unittest.main()
