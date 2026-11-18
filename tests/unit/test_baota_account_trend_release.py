import base64
import hashlib
import runpy
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch


trend = runpy.run_path(
    str(Path(__file__).resolve().parents[2] / "scripts/baota-account-trend-release.py")
)


class TrendReleaseScopeTest(unittest.TestCase):
    def test_collection_scope_release_and_restore(self):
        prepare = trend["prepare_amazon"]
        root = Path("project")
        sha = lambda b: hashlib.sha256(b).hexdigest()
        names = list(trend["COLLECTION_BASE"])
        old = {n: n.encode() for n in names}
        new = {n: n.encode()+b" new" for n in names}
        workers = {n: n.encode() for n in trend["REPORT_PROTECTED"]}
        worker_dir = (root / trend["REPORT_TARGET"]).parent
        api_dir = root / trend["AMAZON_DIR"]
        with patch.dict(prepare.__globals__, {
            "COLLECTION_BASE": {n: sha(b) for n,b in old.items()},
            "COLLECTION_CANDIDATE": {n: sha(b) for n,b in new.items()},
            "REPORT_PROTECTED": {n: sha(b) for n,b in workers.items()},
            "AMAZON_INSTALLED": {},
            "REPORT_NEW": sha(b"report"),
        }):
            for action, before, after in (("apply",old,new),("restore",new,old)):
                manifest = {n:(sha(before[n]),base64.b64encode(zlib.compress(after[n])).decode(),sha(after[n]))
                            for n in names}
                live = {root/"backend"/n:b for n,b in before.items()}
                live.update({worker_dir/n:b for n,b in workers.items()})
                live[root/trend["REPORT_TARGET"]] = b"report"
                live[api_dir/trend["AMAZON_AUDIT_MODULE"]] = b"unexpected"
                with self.assertRaisesRegex(RuntimeError,"protected_module_changed"):
                    prepare(root,manifest,lambda p,_:live[p],action)
                with self.assertRaisesRegex(RuntimeError,"manifest_invalid"):
                    prepare(root,{**manifest,"foreign.js":next(iter(manifest.values()))},lambda p,_:live[p],action)
                with self.assertRaisesRegex(RuntimeError,"baseline_changed|manifest_invalid"):
                    prepare(root,manifest,lambda p,_:live[p],"restore" if action=="apply" else "apply")
        source = list(trend["collection_sources"]())
        web = ["apps/web/src/components/ProviderAdapterCenter.vue","apps/web/src/source-1688-operator-action.ts"]
        trend["validate_collection_changes"](source+web)
        with self.assertRaisesRegex(RuntimeError,"contains_other_runtime_changes"):
            trend["validate_collection_changes"](source+web+["apps/api/src/unrelated.ts"])
        for n,v in trend["COLLECTION_BASE"].items():
            self.assertEqual(sha(trend["build_collection_restore"](Path(__file__).resolve().parents[2],n)),v)

    def test_amazon_release_is_pinned_and_preserves_worker_overlays(self):
        prepare = trend["prepare_amazon"]
        root = Path("project")
        sha = lambda b: hashlib.sha256(b).hexdigest()
        baseline = {name: name.encode() for name in trend["AMAZON_BASE_HASHES"]}
        worker_bytes = {name: name.encode() for name in trend["REPORT_PROTECTED"]}
        manifest = {name: (sha(data), base64.b64encode(zlib.compress(data+b" new")).decode(), sha(data+b" new"))
                    for name, data in baseline.items()}
        live = {root / trend["AMAZON_DIR"] / name: data for name, data in baseline.items()}
        worker = (root / trend["REPORT_TARGET"]).parent
        live.update({worker / name: data for name, data in worker_bytes.items()})
        live[root / trend["REPORT_TARGET"]] = b"installed report"
        with patch.dict(prepare.__globals__, {"AMAZON_BASE_HASHES": {n: sha(b) for n,b in baseline.items()},
                                             "REPORT_PROTECTED": {n: sha(b) for n,b in worker_bytes.items()},
                                             "REPORT_NEW": sha(b"installed report")}):
            replacements, protected = prepare(root, manifest, lambda p, _: live[p])
            self.assertEqual(set(replacements), {root / trend["AMAZON_DIR"] / n for n in baseline})
            self.assertEqual(protected[root / trend["REPORT_TARGET"]], b"installed report")
            with self.assertRaisesRegex(RuntimeError, "trend_amazon_manifest_invalid"):
                prepare(root, {**manifest, "foreign.js": next(iter(manifest.values()))}, lambda p, _: live[p])
            live[root / trend["REPORT_TARGET"]] = b"unexpected report"
            with self.assertRaisesRegex(RuntimeError, "trend_amazon_protected_module_changed"):
                prepare(root, manifest, lambda p, _: live[p])
        allowed = ["apps/api/src/" + n.removesuffix(".js") + ".ts" for n in baseline]
        trend["validate_amazon_changes"](allowed)
        with self.assertRaisesRegex(RuntimeError, "trend_amazon_contains_other_runtime_changes"):
            trend["validate_amazon_changes"](allowed + ["apps/api/src/lan-1688-recovery.ts"])

    def test_report_overlay_replaces_only_report_and_rejects_drift(self):
        sha = lambda b: hashlib.sha256(b).hexdigest()
        target = Path(trend["REPORT_TARGET"])
        prepare = trend["prepare_report"]
        siblings = {target.with_name(name): name.encode() for name in trend["REPORT_PROTECTED"]}
        settings = {"REPORT_OLD": sha(b"old"), "REPORT_NEW": sha(b"new"),
                    "REPORT_PROTECTED": {p.name: sha(v) for p, v in siblings.items()}}
        with patch.dict(prepare.__globals__, settings):
            for action, old, new in (("apply", b"old", b"new"), ("restore", b"new", b"old")):
                files = {**siblings, target: old}
                read = lambda path, _: files[path]
                args = (target, sha(old), base64.b64encode(new).decode(), sha(new), read, action)
                self.assertEqual(prepare(*args), ({target: (new, sha(old), sha(new))}, siblings))
                with self.assertRaisesRegex(RuntimeError, "trend_report_hash_pair_invalid"):
                    prepare(*args[:-1], "restore" if action == "apply" else "apply")
                files[target] = b"drift"
                with self.assertRaisesRegex(RuntimeError, "trend_report_baseline_changed"):
                    prepare(*args)
                files[target] = old
                files[next(iter(siblings))] = b"drift"
                with self.assertRaisesRegex(RuntimeError, "trend_report_protected_module_changed"):
                    prepare(*args)

    def test_report_overlay_allowlist_and_exact_rollback_bytes(self):
        source = trend["REPORT_SOURCE"]
        trend["validate_report_changes"]([source, "docs/runbooks/account-report-exports.md"])
        for other in (trend["SOURCE"], "apps/worker/src/queue-scheduler.ts", "db/migrations/0200.sql"):
            with self.assertRaisesRegex(RuntimeError, "trend_report_contains_other_runtime_changes"):
                trend["validate_report_changes"]([source, other])
        old = trend["build_report_restore"](Path(__file__).resolve().parents[2])
        self.assertEqual(hashlib.sha256(old).hexdigest(), trend["REPORT_OLD"])

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
