import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scoutops_crawler.config import ConfigError, load_config


class IdlePollConfigTest(unittest.TestCase):
    def test_defaults_separate_empty_poll_from_lease_heartbeat(self):
        config = load_config({})
        self.assertEqual(config.idle_poll_seconds, 2)
        self.assertEqual(config.heartbeat_seconds, 30)
        self.assertEqual(config.lease_seconds, 120)

    def test_setting_changes_fingerprint_without_changing_heartbeat_or_lease(self):
        original = load_config({})
        for value in (1, 7, 60):
            with self.subTest(value=value):
                configured = load_config({"CRAWLER_IDLE_POLL_SECONDS": str(value)})
                self.assertEqual(configured.idle_poll_seconds, value)
                self.assertEqual(configured.heartbeat_seconds, original.heartbeat_seconds)
                self.assertEqual(configured.lease_seconds, original.lease_seconds)
                self.assertNotEqual(configured.fingerprint, original.fingerprint)

    def test_invalid_setting_fails_closed_without_printing_the_value(self):
        for value in ("0", "-1", "61", "1.5", "private-invalid-value", ""):
            with self.subTest(value=value), self.assertRaises(ConfigError) as raised:
                load_config({"CRAWLER_IDLE_POLL_SECONDS": value})
            self.assertEqual(raised.exception.key, "CRAWLER_IDLE_POLL_SECONDS")
            self.assertNotIn("private-invalid-value", str(raised.exception))
