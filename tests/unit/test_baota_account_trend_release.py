import runpy
import unittest
from pathlib import Path


trend = runpy.run_path(
    str(Path(__file__).resolve().parents[2] / "scripts/baota-account-trend-release.py")
)


class TrendReleaseScopeTest(unittest.TestCase):
    def test_allowlist_requires_the_trend_worker_source(self):
        trend["validate_changes"]([trend["SOURCE"], "apps/web/src/main.ts", "docs/update.md"])
        with self.assertRaisesRegex(RuntimeError, "trend_release_contains_other_runtime_changes"):
            trend["validate_changes"](["docs/update.md"])

    def test_allowlist_refuses_any_other_server_or_migration_source(self):
        for path in ("apps/worker/src/index.ts", "apps/api/src/server.ts",
                     "apps/crawler/scoutops_crawler/__main__.py", "database/migrations/x.sql"):
            with self.subTest(path=path), self.assertRaisesRegex(
                RuntimeError, "trend_release_contains_other_runtime_changes"
            ):
                trend["validate_changes"]([trend["SOURCE"], path])

    def test_identity_guards_run_before_io(self):
        with self.assertRaisesRegex(RuntimeError, "trend_project_mismatch"):
            trend["install"]("/tmp/not-the-project", "a" * 40, "a" * 64, "", "", "")

        with self.assertRaisesRegex(RuntimeError, "trend_release_requires_expected_sha256_and_base_sha"):
            trend["publish"](None, "a" * 40, "bad-digest", {}, None)


if __name__ == "__main__":
    unittest.main()
