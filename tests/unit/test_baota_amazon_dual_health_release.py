"""Local-only proof of the exact two-module Amazon dual-health release route."""
import ast
import base64
import contextlib
import hashlib
import runpy
import subprocess
import sys
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[2]
TREND = runpy.run_path(str(REPO / "scripts/baota-account-trend-release.py"))


class AmazonDualHealthReleaseTest(unittest.TestCase):
    def test_dual_health_exact_two_leaves_rebuild_and_restore_from_git(self):
        before, after = TREND["collection_hashes"]("dual_health")
        self.assertEqual(set(before), {"apps/api/dist/amazon-public-browser-health.js",
                                       "packages/playwright-crawler/dist/index.js"})
        self.assertEqual(TREND["collection_hashes"]("dual_health_restore"), (after, before))
        self.assertEqual(len(before), 2)
        for source, expected in ((TREND["COLLECTION_DUAL_HEALTH_SOURCE"], before),
                                 (TREND["COLLECTION_DUAL_HEALTH_CANDIDATE_SOURCE"], after)):
            for name, digest in expected.items():
                data = TREND["build_collection_restore"](REPO, name, source)
                self.assertEqual(hashlib.sha256(data).hexdigest(), digest)
        helper = subprocess.check_output(["git", "show", TREND["COLLECTION_DUAL_HEALTH_CANDIDATE_SOURCE"]
                                          + ":apps/crawler/scoutops_crawler/public_http.py"], cwd=REPO)
        self.assertEqual(hashlib.sha256(helper).hexdigest(), TREND["COLLECTION_DUAL_HEALTH_PROTECTED"][
            "python/scoutops_crawler/public_http.py"])
        adapter = TREND["build_collection_restore"](REPO,
            "packages/playwright-crawler/dist/public-http-transport.js",
            TREND["COLLECTION_DUAL_HEALTH_CANDIDATE_SOURCE"])
        self.assertEqual(hashlib.sha256(adapter).hexdigest(), TREND["COLLECTION_DUAL_HEALTH_PROTECTED"][
            "backend/packages/playwright-crawler/dist/public-http-transport.js"])

    def test_existing_python_and_node_transport_files_are_protected_not_replaced(self):
        source = TREND["COLLECTION_DUAL_HEALTH_CANDIDATE_SOURCE"]
        root = Path("project")
        files = {
            root / "python/scoutops_crawler/public_http.py": subprocess.check_output(
                ["git", "show", source + ":apps/crawler/scoutops_crawler/public_http.py"], cwd=REPO),
            root / "backend/packages/playwright-crawler/dist/public-http-transport.js":
                TREND["build_collection_restore"](REPO,
                    "packages/playwright-crawler/dist/public-http-transport.js", source),
        }
        self.assertEqual(TREND["dual_health_transport_files"](root, lambda p, _: files[p]), files)
        for path in files:
            with self.subTest(path=str(path)), self.assertRaisesRegex(RuntimeError, "prerequisite_changed"):
                TREND["dual_health_transport_files"](root,
                    lambda p, _: files[p] + (b"changed" if p == path else b""))

    def test_only_literal_health_api_source_is_added_to_existing_allowlist(self):
        required = list(TREND["collection_sources"]()) + [
            "apps/web/src/components/ProviderAdapterCenter.vue", "apps/web/src/source-1688-operator-action.ts",
            "apps/api/src/amazon-public-browser-health.ts"]
        TREND["validate_collection_changes"](required)
        for foreign in ("apps/api/src/unrelated.ts", "apps/api/src/unrelated-runtime-repository.ts",
                        "apps/crawler/scoutops_crawler/public_http.py", "packages/database/src/mysql.ts"):
            with self.subTest(foreign=foreign), self.assertRaisesRegex(RuntimeError, "contains_other_runtime_changes"):
                TREND["validate_collection_changes"](required + [foreign])

    def test_wrong_manifest_or_wrong_primary_hash_fails_before_remote_io(self):
        for action in ("dual_health", "dual_health_restore"):
            with self.subTest(action=action):
                with self.assertRaisesRegex(RuntimeError, "manifest_invalid"):
                    TREND["prepare_amazon"](Path("project"), {},
                        lambda *_: self.fail("manifest must fail before filesystem reads"), action)
                with self.assertRaisesRegex(RuntimeError, "manifest_invalid"):
                    TREND["publish"](REPO, TREND["REPORT_RUNTIME_BASE"], "0" * 64, {},
                        lambda *_: self.fail("must not connect"), collection=action)

    def test_forward_and_restore_plan_always_embed_strict_drain_and_node_only_route(self):
        primary = TREND["COLLECTION_DUAL_HEALTH"]
        sha = TREND["COLLECTION_DUAL_HEALTH_CANDIDATE_SOURCE"]
        baseline = TREND["COLLECTION_DUAL_HEALTH_SOURCE"]
        payloads = {(source, name): TREND["build_collection_restore"](REPO, name, source)
                    for source in (baseline, sha) for name in TREND["COLLECTION_DUAL_HEALTH_BASE"]}
        changed = list(TREND["collection_sources"]()) + [
            "apps/web/src/components/ProviderAdapterCenter.vue", "apps/web/src/source-1688-operator-action.ts",
            "apps/api/src/amazon-public-browser-health.ts"]
        for action in ("dual_health", "dual_health_restore"):
            before, after = TREND["collection_hashes"](action)
            captured = []
            connections = []
            def git(command, **kwargs):
                self.assertEqual(command[0], "git")
                op = command[1:]
                if op == ["rev-parse", "HEAD"]:
                    return sha.encode()
                if op == ["status", "--porcelain"]:
                    return b""
                if op == ["remote", "get-url", "origin"]:
                    return b"https://github.com/fixture/project.git"
                if op == ["ls-remote", "--exit-code", "origin", "refs/heads/main"]:
                    return (sha + "\trefs/heads/main").encode()
                if op[0] == "diff":
                    return "\n".join(changed).encode()
                self.fail("unexpected local command: " + repr(command))
            @contextlib.contextmanager
            def ssh(_):
                connections.append("mock-only")
                yield "mock-ssh"
            def remote(connection, source, timeout):
                self.assertEqual(connection, "mock-ssh")
                self.assertEqual(timeout, 400)
                tree = ast.parse(source)
                assignments = {n.targets[0].id: ast.literal_eval(n.value) for n in tree.body[:4]}
                self.assertEqual(assignments["drain_code"],
                    (REPO / "scripts/baota-account-claim-drain.py").read_text(encoding="utf-8"))
                self.assertIn("consecutive == 4", assignments["drain_code"])
                self.assertIn("install_with_claim_drain", source)
                args = assignments["args"]
                self.assertEqual(args[10], action)
                self.assertEqual(set(args[9]), set(before))
                self.assertEqual(args[2], before[primary])
                for name, (old, compressed, digest) in args[9].items():
                    data = zlib.decompress(base64.b64decode(compressed))
                    self.assertEqual(old, before[name])
                    self.assertEqual(digest, after[name])
                    self.assertEqual(hashlib.sha256(data).hexdigest(), digest)
                    expected_source = baseline if action.endswith("_restore") else sha
                    self.assertEqual(data, payloads[expected_source, name])
                captured.append(args)
                return {"status": True, "mock_only": True}
            deploy = {"normalize_github_repository": lambda _: "fixture/project",
                      "EXPECTED_GITHUB_REPOSITORY": "fixture/project",
                      "verify_production_sha_history": lambda *_: None,
                      "local_npm_executable": lambda: "fixture-npm",
                      "PROJECT_ROOT": "/www/wwwroot/ai选品", "NODE_BIN": "/fixture/node",
                      "remote_python": remote}
            with self.subTest(action=action), patch.object(TREND["subprocess"], "check_output", side_effect=git), \
                 patch.object(TREND["subprocess"], "run") as builds, \
                 patch.dict(TREND["publish"].__globals__, {"build_collection_restore":
                     lambda _repo, name, source: payloads[source, name]}):
                result = TREND["publish"](REPO, TREND["REPORT_RUNTIME_BASE"], before[primary],
                                           deploy, ssh, collection=action)
                self.assertTrue(result["mock_only"])
                self.assertEqual([c.args[0] for c in builds.call_args_list],
                    [["fixture-npm", "run", "build:api"], ["fixture-npm", "run", "build:playwright-crawler"]])
                self.assertEqual(len(connections), 1)
                self.assertEqual(len(captured), 1)
                self.assertTrue(TREND["restart_identity_valid"](
                    {"api": 1, "worker": 2, "python": [3]}, {"api": 4, "worker": 5, "python": [3]}))
                self.assertFalse(TREND["restart_identity_valid"](
                    {"api": 1, "worker": 2, "python": [3]}, {"api": 4, "worker": 2, "python": [3]}))
                self.assertIn('if not python_transport and after["python"] != pids["python"]:',
                              (REPO / "scripts/baota-account-trend-release.py").read_text(encoding="utf-8"))
                self.assertIn('raise RuntimeError("trend_unexpected_python_identity_change")',
                              (REPO / "scripts/baota-account-trend-release.py").read_text(encoding="utf-8"))

    def test_cli_rejects_combined_module_actions_before_ssh(self):
        command = [sys.executable, "-B", str(REPO / "scripts/deploy-account-baota.py")]
        for flag in ("--collection-dual-health-only", "--collection-dual-health-rollback"):
            result = subprocess.run(command + [flag, "--collection-checkpoint-only"],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn("not allowed with argument", result.stderr)


if __name__ == "__main__":
    unittest.main()
