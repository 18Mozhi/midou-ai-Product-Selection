import ast
import base64
import contextlib
import hashlib
import runpy
import subprocess
import unittest
import zlib
from pathlib import Path
from unittest.mock import Mock, patch

REPO = Path(__file__).resolve().parents[2]
TREND = runpy.run_path(str(REPO / "scripts/baota-account-trend-release.py"))
DRAIN = runpy.run_path(str(REPO / "scripts/baota-account-claim-drain.py"))

class MaintenanceBootstrapTest(unittest.TestCase):
    def test_business_only_gate_is_explicit_first_load_not_a_weaker_full_gate(self):
        state = {k: 0 for k in DRAIN["DRAIN_KEYS"]}
        busy = {**state, "worker_active": 2, "intelligence_active": 1}
        DRAIN["verify_bootstrap_business_drained"](lambda: busy, attempts=4, sleep=lambda _: None)
        with self.assertRaisesRegex(RuntimeError, "worker_drain_timeout"):
            DRAIN["verify_collection_drained"](lambda: busy, attempts=4, sleep=lambda _: None)
        for key in DRAIN["BUSINESS_DRAIN_KEYS"]:
            with self.subTest(key=key), self.assertRaisesRegex(RuntimeError, "business_drain_timeout"):
                DRAIN["verify_bootstrap_business_drained"](
                    lambda: {**state, key: 1}, attempts=4, sleep=lambda _: None)
        with self.assertRaisesRegex(RuntimeError, "sample_invalid"):
            DRAIN["verify_bootstrap_business_drained"](lambda: {**state, "worker_active": False})
        # Three zeros, a busy sample, then only three zeros must not pass.
        values = iter([state] * 3 + [{**state, "in_flight": 1}] + [state] * 3)
        with self.assertRaisesRegex(RuntimeError, "business_drain_timeout"):
            DRAIN["verify_bootstrap_business_drained"](lambda: next(values), attempts=7, sleep=lambda _: None)

    def test_postload_full_zero_before_followup_and_pause_is_retained_on_uncertainty(self):
        for failure in (None, "business", "install1", "full1", "final1", "install2", "full2", "final2"):
            events = []
            drain = Mock(owner="fixture-owner", samples=[])
            counts = {"install": 0, "full": 0, "final": 0}
            def event(name):
                events.append(name)
                if failure == name:
                    raise RuntimeError("injected_" + name)
            drain.pause.side_effect = lambda: event("pause")
            drain.bootstrap_business_drain.side_effect = lambda: event("business")
            drain.resume_owned.side_effect = lambda: event("resume")
            def invoke(name):
                counts[name] += 1
                event(name + str(counts[name]))
            drain.drain.side_effect = lambda: invoke("full")
            drain.verify_final.side_effect = lambda: invoke("final")
            def install(*args):
                invoke("install")
                return {"status": True, "kind": args[-1]}
            with self.subTest(failure=failure):
                if failure:
                    with self.assertRaisesRegex(RuntimeError, "injected_"):
                        TREND["install_maintenance_bootstrap"](install, ("maintenance_bootstrap",),
                            ("dual_health",), drain)
                    if failure == "business":
                        self.assertEqual(events, ["pause", "business", "resume"])
                    else:
                        self.assertNotIn("resume", events)
                    if failure in ("full1", "final1"):
                        self.assertNotIn("install2", events)
                else:
                    result = TREND["install_maintenance_bootstrap"](install, ("maintenance_bootstrap",),
                        ("dual_health",), drain)
                    self.assertTrue(result["status"])
                    self.assertEqual(events, ["pause", "business", "install1", "full1", "final1",
                                               "install2", "full2", "final2", "resume"])

    def test_manifest_only_replaces_two_worker_modules_and_protects_them_during_followup(self):
        before, after = TREND["collection_hashes"]("maintenance_bootstrap")
        self.assertEqual(set(before), {"apps/worker/dist/index.js", "apps/worker/dist/queue-scheduler.js"})
        for name, digest in before.items():
            data = TREND["build_collection_restore"](REPO, name, TREND["COLLECTION_MAINTENANCE_SOURCE"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), digest)
        for name in after:
            source = name.replace("/dist/", "/src/").removesuffix(".js") + ".ts"
            script = "import ts from 'typescript';let d='';for await(const c of process.stdin)d+=c;process.stdout.write(ts.transpileModule(d,{fileName:" + repr(Path(source).name) + ",compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,sourceMap:true}}).outputText)"
            data = subprocess.run(["node", "--input-type=module", "-e", script], input=(REPO/source).read_bytes().replace(b"\r\n",b"\n"),capture_output=True,check=True).stdout
            self.assertEqual(hashlib.sha256(data).hexdigest(), after[name])
        text=(REPO/"scripts/baota-account-trend-release.py").read_text(encoding="utf-8")
        self.assertIn('protect_hashes["queue-scheduler.js"] = COLLECTION_MAINTENANCE_CANDIDATE',text)
        self.assertIn('protect_hashes["index.js"] = COLLECTION_MAINTENANCE_CANDIDATE',text)
        self.assertIn('action.add_argument("--collection-maintenance-bootstrap", action="store_true")',
            (REPO/"scripts/deploy-account-baota.py").read_text(encoding="utf-8"))

    def test_official_publisher_packages_bootstrap_then_dual_release_without_network(self):
        sha = "a" * 40
        old = TREND["COLLECTION_MAINTENANCE_SOURCE"]
        names = list(TREND["COLLECTION_MAINTENANCE_BASE"]) + list(TREND["COLLECTION_DUAL_HEALTH_BASE"])
        payloads = {}
        for name in names:
            payloads[old, name] = TREND["build_collection_restore"](REPO, name, old)
            source = name.replace("/dist/", "/src/").removesuffix(".js") + ".ts"
            script = "import ts from 'typescript';let d='';for await(const c of process.stdin)d+=c;process.stdout.write(ts.transpileModule(d,{fileName:" + repr(Path(source).name) + ",compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,sourceMap:true}}).outputText)"
            # Freeze the already-approved first-load candidate, not a later engine overlay.
            payloads[sha, name] = TREND["build_collection_restore"](
                REPO, name, "d3652768328dc62f7f5c4fee2eec5c1918260cdd")
        changed = list(TREND["collection_sources"]()) + [
            "apps/web/src/components/ProviderAdapterCenter.vue", "apps/web/src/source-1688-operator-action.ts",
            "apps/api/src/amazon-public-browser-health.ts", "apps/worker/src/index.ts",
            "apps/worker/src/queue-scheduler.ts", "scripts/baota-account-claim-drain.py"]
        def git(command, **kwargs):
            op = command[1:]
            if op == ["rev-parse", "HEAD"]: return sha.encode()
            if op == ["status", "--porcelain"]: return b""
            if op == ["remote", "get-url", "origin"]: return b"https://github.com/fixture/project.git"
            if op[0] == "ls-remote": return (sha + "\trefs/heads/main").encode()
            if op[0] == "diff": return "\n".join(changed).encode()
            self.fail("unexpected command " + repr(command))
        @contextlib.contextmanager
        def ssh(_): yield "mock-only"
        def remote(connection, source, timeout):
            self.assertEqual(connection, "mock-only"); self.assertEqual(timeout, 900)
            self.assertLessEqual(len(base64.b64encode(source.encode("utf-8"))), 120000)
            packed = next(n.value for n in ast.walk(ast.parse(source))
                          if isinstance(n, ast.Constant) and isinstance(n.value, str))
            source = zlib.decompress(base64.b64decode(packed)).decode("utf-8")
            assignments = {n.targets[0].id: ast.literal_eval(n.value) for n in ast.parse(source).body[:5]}
            first, second = assignments["args"], assignments["followup_args"]
            for args, action, expected in [(first, "maintenance_bootstrap", TREND["COLLECTION_MAINTENANCE_BASE"]),
                                           (second, "dual_health", TREND["COLLECTION_DUAL_HEALTH_BASE"])]:
                self.assertEqual(args[-1], action); self.assertEqual(set(args[9]), set(expected))
                for name, (before, packed, after) in args[9].items():
                    self.assertEqual(before, expected[name]); self.assertEqual(
                        hashlib.sha256(zlib.decompress(base64.b64decode(packed))).hexdigest(), after)
            self.assertIn("bootstrap_business_drain", assignments["drain_code"])
            self.assertIn('ns["install_maintenance_bootstrap"]', source)
            return {"status": True, "mock_only": True}
        deploy = {"normalize_github_repository": lambda _: "fixture/project",
                  "EXPECTED_GITHUB_REPOSITORY": "fixture/project", "verify_production_sha_history": lambda *_: None,
                  "local_npm_executable": lambda: "fixture-npm", "PROJECT_ROOT": "/www/wwwroot/ai选品",
                  "NODE_BIN": "/node", "remote_python": remote}
        with patch.object(TREND["subprocess"], "check_output", side_effect=git), \
             patch.object(TREND["subprocess"], "run") as builds, \
             patch.dict(TREND["publish"].__globals__, {"build_collection_restore": lambda _r,n,s: payloads[s,n]}):
            result = TREND["publish"](REPO, TREND["REPORT_RUNTIME_BASE"],
                TREND["COLLECTION_MAINTENANCE_BASE"][TREND["COLLECTION_MAINTENANCE_PRIMARY"]],
                deploy, ssh, collection="maintenance_bootstrap")
            self.assertTrue(result["mock_only"])
            self.assertEqual([c.args[0][-1] for c in builds.call_args_list],
                             ["build:worker", "build:api", "build:playwright-crawler"])

    def test_compact_runner_roundtrips_exact_unicode_source_and_bounds_shell_argument(self):
        original = "print('智能选品')\n" * 15000
        wrapped = TREND["compact_release_source"](original)
        packed = next(n.value for n in ast.walk(ast.parse(wrapped))
                      if isinstance(n, ast.Constant) and isinstance(n.value, str))
        self.assertEqual(zlib.decompress(base64.b64decode(packed)).decode("utf-8"), original)
        self.assertLess(len(base64.b64encode(wrapped.encode("utf-8"))), 120000)
        import random
        noisy = random.Random(0).randbytes(200000).hex()
        with self.assertRaisesRegex(RuntimeError, "transport_too_large"):
            TREND["compact_release_source"](noisy)

if __name__ == "__main__":
    unittest.main()
