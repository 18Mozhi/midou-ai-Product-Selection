import base64
import hashlib
import runpy
import unittest
from pathlib import Path
from unittest.mock import patch


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

    def test_scheduler_requires_both_sources_and_refuses_other_runtime_changes(self):
        first = "apps/worker/src/queue-scheduler.ts"
        second = "apps/worker/src/worker-queue-registry.ts"
        trend["validate_changes"]([first, second, trend["SOURCE"]], scheduler=True)
        trend["validate_changes"]([trend["SOURCE"]], scheduler=True, rollback=True)
        with self.assertRaisesRegex(RuntimeError, "trend_release_contains_other_runtime_changes"):
            trend["validate_changes"]([trend["SOURCE"], "apps/api/src/server.ts"], scheduler=True, rollback=True)
        for paths in ([first], [first, second, "apps/api/src/server.ts"]):
            with self.assertRaisesRegex(RuntimeError, "trend_release_contains_other_runtime_changes"):
                trend["validate_changes"](paths, scheduler=True)

    def test_scheduler_manifest_preflights_both_hashes_and_preserves_trend_module(self):
        sha = lambda b: hashlib.sha256(b).hexdigest()
        target = Path(trend["TARGET"])
        names = trend["SCHEDULER_FILES"]
        existing = {target: b"installed trend overlaid module"}
        entries = {}
        for i, name in enumerate(names):
            existing[target.with_name(name)] = ("old " + name).encode()
            new = b"new " + trend["SCHEDULER_MARKERS"][i]
            entries[name] = (sha(existing[target.with_name(name)]), base64.b64encode(new).decode(), sha(new))
        args = (target, sha(existing[target]), "", "")
        read = lambda p, _: existing[p]
        replacements, protected = trend["prepare_modules"](*args, entries, read)
        self.assertEqual([p.name for p in replacements], list(names))
        self.assertEqual(protected, {target: existing[target]})
        with self.assertRaisesRegex(RuntimeError, "trend_scheduler_manifest_invalid"):
            trend["prepare_modules"](*args, {**entries, "unexpected.js": entries[names[0]]}, read)
        existing[target.with_name(names[1])] = b"foreign registry"
        with self.assertRaisesRegex(RuntimeError, "trend_module_baseline_changed"):
            trend["prepare_modules"](*args, entries, read)

    def test_rollback_accepts_only_the_verified_pre_stagger_pair(self):
        sha = lambda b: hashlib.sha256(b).hexdigest()
        target = Path(trend["TARGET"])
        names = trend["SCHEDULER_FILES"]
        old = {target: b"trend optimization"}
        entries = {}
        accepted = {}
        for name in names:
            old[target.with_name(name)] = ("staggered " + name).encode()
            restored = ("unstaggered " + name).encode()
            accepted[name] = sha(restored)
            entries[name] = (sha(old[target.with_name(name)]), base64.b64encode(restored).decode(), sha(restored))
        args = (target, sha(old[target]), "", "")
        read = lambda p, _: old[p]
        prepare = trend["prepare_modules"]
        with self.assertRaisesRegex(RuntimeError, "trend_candidate_invalid"):
            prepare(*args, entries, read, rollback=True)
        with patch.dict(prepare.__globals__["PRE_STAGGER_SHA256"], accepted):
            replacements, protected = prepare(*args, entries, read, rollback=True)
            self.assertEqual([p.name for p in replacements], list(names))
            self.assertEqual(protected, {target: old[target]})
            with self.assertRaisesRegex(RuntimeError, "trend_candidate_invalid"):
                prepare(*args, entries, read)


if __name__ == "__main__":
    unittest.main()
