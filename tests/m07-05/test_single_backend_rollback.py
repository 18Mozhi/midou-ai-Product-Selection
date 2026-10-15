import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from unittest.mock import Mock
import json
import inspect
import tarfile

helpers = runpy.run_path("scripts/single-backend-rollback.py")
deployer = runpy.run_path("scripts/deploy-baota.py")


class RollbackTests(unittest.TestCase):
    def test_capacity_runtime_package_contains_complete_relative_import_chain(self):
        with tempfile.TemporaryDirectory(prefix="scoutops-capacity-package-test-") as temp:
            identity = dict(local_sha="a" * 40, remote_sha="a" * 40, remote_branch="main", repository="test")
            def empty_tree(_source, target):
                Path(target).mkdir(parents=True, exist_ok=True)
            with patch.dict(deployer["build_package"].__globals__, verify_local_build_preflight=lambda _repo: None, copy_tree=empty_tree):
                archive = deployer["build_package"](Path.cwd(), identity, True, Path(temp))
            with tarfile.open(archive, "r:gz") as package:
                names = set(package.getnames())
                for relative in ("capture-capacity-boundary-production.mjs", "release-rollout-async-lag.mjs", "single-backend-release-evidence.mjs", "lib/capacity-release-prerequisite.mjs"):
                    self.assertIn("backend/scripts/" + relative, names)
                    self.assertGreater(package.getmember("backend/scripts/" + relative).size, 0)

    def test_rollback_audits_use_official_security_endpoint_without_changing_global_registry(self):
        for name in ("build_historical_rollback", "reverify_same_version"):
            source = inspect.getsource(deployer[name])
            self.assertIn("--registry=https://registry.npmjs.org", source)
            self.assertNotIn("config set", source)

    def test_reverification_rejects_runtime_changes_and_accepts_tooling_only(self):
        function = deployer["rollback_reverify_source"]
        identity = dict(local_sha="a" * 40, remote_sha="a" * 40)
        with tempfile.TemporaryDirectory() as temp:
            receipt = Path(temp) / "receipt.json"
            receipt.write_text(json.dumps(dict(previousBuildSha="b" * 40, capturedAt="2026-10-15T00:00:00Z", migrationVersion=deployer["DEPLOYMENT_MIGRATION_VERSION"])))
            with patch.dict(function.__globals__, {
                "local_node_executable": lambda: "node",
                "verify_production_sha_history": Mock(),
                "run": Mock(return_value="scripts/deploy-baota.py"),
            }), patch("subprocess.run", return_value=Mock(returncode=0)):
                self.assertEqual(function(Path(temp), identity, receipt)["local_sha"], "b" * 40)
                for changed in ("package-lock.json", "database/migrations/new.sql", "apps/api/src/server.ts"):
                    function.__globals__["run"].return_value = changed
                    with self.assertRaisesRegex(RuntimeError, "runtime-identical"):
                        function(Path(temp), identity, receipt)

    def test_reverification_restores_target_after_rollback_health_failure(self):
        function = deployer["reverify_same_version"]
        calls = []
        def remote(client, source, **kwargs):
            calls.append(source)
            if source == "identity":
                return dict(status=True, build_sha=("a" if calls.count("identity") == 1 else "b") * 40,
                            migration_version=deployer["DEPLOYMENT_MIGRATION_VERSION"])
            return dict(status=True)
        client = Mock()
        client.open_sftp.return_value.__enter__ = Mock(return_value=Mock())
        client.open_sftp.return_value.__exit__ = Mock(return_value=False)
        with tempfile.TemporaryDirectory() as temp, patch.dict(function.__globals__, {
            "rollback_reverify_source": lambda *a: dict(local_sha="b" * 40),
            "build_historical_rollback": lambda *a: Path(temp) / "archive",
            "read_windows_credential": lambda: "test-only",
            "remote_python": remote,
            "production_identity_source": lambda: "identity",
            "ssh_exec": Mock(),
            "verify_public": Mock(side_effect=[{}, RuntimeError("probe failed"), {}]),
            "runpy": Mock(run_path=Mock(return_value={"exchange_source": lambda root, build, expected: "exchange:" + expected})),
        }), patch("paramiko.SSHClient", return_value=client):
            with self.assertRaisesRegex(RuntimeError, "probe failed"):
                function(Path(temp), dict(local_sha="a" * 40), Path(temp) / "receipt.json")
        self.assertIn("exchange:" + "a" * 40, calls)
        self.assertIn("exchange:" + "b" * 40, calls)
        self.assertFalse(any("cleanup complete" in source for source in calls))
        client.close.assert_called_once()

    def test_historical_worktree_is_removed_even_when_offline_install_fails(self):
        function = deployer["build_historical_rollback"]
        with tempfile.TemporaryDirectory() as temp, patch("subprocess.run") as invoke:
            invoke.side_effect = [Mock(returncode=0), RuntimeError("offline cache miss"), Mock(returncode=0)]
            with self.assertRaisesRegex(RuntimeError, "offline cache miss"):
                function(Path(temp), dict(local_sha="b" * 40), Path(temp))
            self.assertEqual(invoke.call_args_list[0].args[0][:4], ["git", "-c", "core.autocrlf=false", "worktree"])
            self.assertEqual(invoke.call_args_list[-1].args[0][:4], ["git", "worktree", "remove", "--force"])

    def test_historical_cleanup_retries_transient_windows_file_locks(self):
        function = deployer["build_historical_rollback"]
        with tempfile.TemporaryDirectory() as temp, patch("subprocess.run") as invoke, patch("time.sleep") as wait:
            invoke.side_effect = [Mock(returncode=0), RuntimeError("offline cache miss"), Mock(returncode=255, stderr="Directory not empty"), Mock(returncode=0)]
            with self.assertRaisesRegex(RuntimeError, "offline cache miss"):
                function(Path(temp), dict(local_sha="b" * 40), Path(temp))
            wait.assert_called_once_with(2)

    def test_historical_cleanup_removes_only_owned_unregistered_leftovers(self):
        function = deployer["build_historical_rollback"]
        with tempfile.TemporaryDirectory() as temp, patch("subprocess.run") as invoke:
            source = Path(temp) / "source"
            source.mkdir()
            invoke.side_effect = [Mock(returncode=0), RuntimeError("offline cache miss"), Mock(returncode=128, stderr="is not a working tree")]
            with self.assertRaisesRegex(RuntimeError, "offline cache miss"):
                function(Path(temp), dict(local_sha="b" * 40), Path(temp))
            self.assertFalse(source.exists())

    def test_deployment_lock_is_exclusive_and_owner_bound(self):
        with tempfile.TemporaryDirectory(prefix="scoutops-lock-test-") as temp:
            root = Path(temp)
            (root / "config").mkdir()
            def invoke(owner, release=False):
                source = deployer["deployment_lock_source"](owner, release).replace("/www/wwwroot/ai选品", root.as_posix())
                exec(compile(source, "lock-test", "exec"), {})
            invoke("owner-one")
            with self.assertRaises(FileExistsError):
                invoke("owner-two")
            with self.assertRaises(RuntimeError):
                invoke("owner-two", True)
            self.assertEqual((root / "config" / "deployment.lock").read_text(), "owner-one")
            invoke("owner-one", True)
            self.assertFalse((root / "config" / "deployment.lock").exists())

    def test_exchange_and_restore_and_failed_exchange_are_lossless(self):
        for fail in (False, True):
            with self.subTest(fail=fail), tempfile.TemporaryDirectory(prefix="scoutops-package-test-") as temp:
                root = Path(temp)
                pairs = []
                for index in range(4):
                    live, old = root / ("live" + str(index)), root / ("old" + str(index))
                    live.write_text("new" + str(index))
                    old.write_text("prior" + str(index))
                    pairs.append((live, old))
                scratch = root / "exchange"
                rename = Path.rename
                triggered = False

                def injected(path, target):
                    nonlocal triggered
                    if fail and not triggered and path == pairs[2][1]:
                        triggered = True
                        raise OSError("injected rename failure")
                    return rename(path, target)

                with patch.object(Path, "rename", injected):
                    if fail:
                        with self.assertRaises(OSError):
                            helpers["exchange_pairs"](pairs, scratch)
                    else:
                        helpers["exchange_pairs"](pairs, scratch)
                        self.assertEqual(pairs[0][0].read_text(), "prior0")
                        helpers["exchange_pairs"](pairs, scratch)
                self.assertFalse(scratch.exists())
                for index, (live, old) in enumerate(pairs):
                    self.assertEqual(live.read_text(), "new" + str(index))
                    self.assertEqual(old.read_text(), "prior" + str(index))

    def test_generated_panel_source_compiles_without_creating_a_candidate(self):
        source = helpers["exchange_source"]("/www/wwwroot/ai选品", "a" * 40, "b" * 40)
        compile(source, "panel-exchange", "exec")
        self.assertIn("finally:", source)
        self.assertNotIn("CreateProject", source)


if __name__ == "__main__":
    unittest.main()
