import inspect
import runpy
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import deploy_baota_runtime_gate as gate


class GateTests(unittest.TestCase):
    def window(self, rows, health=lambda: None, max_gap=20, interval=5):
        clock = [0]
        witness = Mock(side_effect=rows)
        result = gate.verify_after_claims_resume(
            health, witness, duration=10, interval=interval, max_gap=max_gap,
            monotonic=lambda: clock[0], sleep=lambda delay: clock.__setitem__(0, clock[0]+delay),
        )
        self.assertEqual(witness.call_args_list[0].args, ("",))
        self.assertTrue(all(call.args == ("baseline",) for call in witness.call_args_list[1:]))
        return result

    @staticmethod
    def state(witnessed=False, paused=False):
        return {"claimsResumed": not paused, "migration": 1, "observedAt": "baseline", "witnessed": witnessed}

    def test_requires_real_post_resume_witness_and_full_window(self):
        result = self.window([self.state(), self.state(), self.state(True), self.state()])
        self.assertEqual(result["samples"], 3)
        self.assertEqual(result["seconds"], 10)
        self.assertTrue(result["collectionResult"])

    def test_fails_on_pause_missing_business_result_probe_failure_or_gap(self):
        healthy = self.state()
        with self.assertRaisesRegex(RuntimeError, "resume_baseline"):
            self.window([self.state(paused=True)])
        with self.assertRaisesRegex(RuntimeError, "changed"):
            self.window([healthy, self.state(paused=True)])
        with self.assertRaisesRegex(RuntimeError, "no_post_resume"):
            self.window([healthy]*4)
        with self.assertRaisesRegex(RuntimeError, "observation_gap"):
            self.window([healthy]*4, max_gap=4)
        with self.assertRaisesRegex(RuntimeError, "503"):
            self.window([healthy]*4, health=Mock(side_effect=[None, RuntimeError("503")]))

    def test_drain_requires_four_consecutive_all_zero_samples(self):
        zero = dict(in_flight=0, scheduler_leases=0, profile_leases=0, browser_leased=0)
        busy = {**zero, "browser_leased": 1}
        probe = Mock(side_effect=[zero, zero, busy, zero, zero, zero, zero])
        gate.verify_collection_drained(probe, attempts=7, sleep=lambda _: None)
        self.assertEqual(probe.call_count, 7)
        with self.assertRaisesRegex(RuntimeError, "drain_timeout"):
            gate.verify_collection_drained(lambda: busy, attempts=4, sleep=lambda _: None)

    def test_node_terminates_worker_before_api_and_supervisor_and_never_escalates(self):
        class Process:
            def __init__(self, pid, marker, stubborn=False):
                self.pid, self.marker, self.stubborn = pid, marker, stubborn
                self.running = True
            def cwd(self):
                return "/fixed/backend"
            def cmdline(self):
                return [self.marker]
            def children(self, recursive=False):
                return [p for p in (api, worker) if p.running] if self.pid == 1 else []
            def environ(self):
                return {}
            def is_running(self):
                return self.running
            def status(self):
                return "running"
            def terminate(self):
                signals.append(self.pid)
                self.running = self.stubborn

        for stubborn in (False, True):
            signals, now = [], [0]
            parent = Process(1, "apps/backend/dist/server.js")
            api = Process(2, "apps/api/dist/server.js")
            worker = Process(3, "apps/worker/dist/index.js", stubborn)
            fake = types.SimpleNamespace(Process={p.pid: p for p in (parent, api, worker)}.__getitem__,
                NoSuchProcess=ProcessLookupError, STATUS_ZOMBIE="zombie")
            clock = types.SimpleNamespace(monotonic=lambda: now[0], sleep=lambda s: now.__setitem__(0, now[0]+s))
            scope = {"root": Path("/fixed"), "time": clock, "print": Mock()}
            # The remote target is Linux even when the release client is Windows.
            from pathlib import PurePosixPath
            scope["root"] = PurePosixPath("/fixed")
            with patch.dict(sys.modules, {"psutil": fake}):
                exec(gate.NODE_TERM_ONLY, scope)
                if stubborn:
                    with self.assertRaisesRegex(RuntimeError, "timeout"):
                        scope["node_term_only"](pids=[1,2,3])
                    self.assertEqual(signals, [3])
                else:
                    scope["node_term_only"](pids=[1,2,3])
                    self.assertEqual(signals, [3,2,1])

    def test_python_timeout_does_not_escalate(self):
        from pathlib import PurePosixPath
        crawler = Mock(pid=15)
        crawler.status.return_value = "running"
        crawler.cwd.return_value = "/fixed/python"
        crawler.cmdline.return_value = ["python", "-m", "scoutops_crawler"]
        crawler.children.return_value = []
        for remaining in ([], [crawler]):
            fake = types.SimpleNamespace(Process=lambda _: crawler, STATUS_ZOMBIE="zombie",
                NoSuchProcess=ProcessLookupError, wait_procs=Mock(return_value=([], remaining)))
            scope = {"root": PurePosixPath("/fixed"), "rollback": PurePosixPath("/fixed/.rollback"),
                "PythonModel": type("PythonModel", (), {}), "print": Mock()}
            crawler.reset_mock()
            with patch.dict(sys.modules, {"psutil": fake}):
                exec(gate.PYTHON_TERM_ONLY, scope)
                if remaining:
                    with self.assertRaisesRegex(RuntimeError, "timeout_no_force"):
                        scope["python_term_only"]([15])
                else:
                    scope["python_term_only"]([15])
                crawler.terminate.assert_called_once_with()
                crawler.kill.assert_not_called()

    def test_wiring_compiles_both_remote_paths_without_native_restart(self):
        deploy = runpy.run_path(str(ROOT / "scripts/deploy-baota.py"))
        node = deploy["panel_node_action_source"]("stop")
        python = deploy["panel_deploy_source"]("a"*40, False)
        compile(node, "node_remote", "exec")
        compile(python, "python_remote", "exec")
        self.assertIn("install_node_term_only(model", node)
        self.assertIn("PythonModel.kill_pids=staticmethod(python_term_only)", python)
        self.assertNotIn("script/restart_project.py", python)
        self.assertNotIn(".kill()", node+python)

    def test_full_deploy_orders_drain_stop_migrate_resume_and_acceptance(self):
        deploy = runpy.run_path(str(ROOT / "scripts/deploy-baota.py"))
        source = inspect.getsource(deploy["main"])
        full = source[source.index('with tempfile.TemporaryDirectory(prefix="scoutops-deploy-")'):]
        tokens = (
            'release_claims(client, "pause", lock_owner)',
            'verify_collection_drained(',
            'panel_node_action_source("stop")',
            'ssh_exec(client, migrate',
            'remote_python(client, panel_deploy_source',
            'resume_owned_release_claims(client, lock_owner)',
            'release_health = verify_public(build_sha)',
            'post_resume = verify_resumed_runtime(client, build_sha)',
            'remote_python(client, cleanup_source(build_sha',
        )
        indexes = [full.index(token) for token in tokens]
        self.assertEqual(indexes, sorted(indexes))
        readonly = source[source.index('    if args.verify_live:\n        client'):source.index('    verify_release_change_ownership(repo)')]
        for forbidden in ('panel_node_action_source', 'panel_deploy_source', 'cleanup_source', 'release_claims('):
            self.assertNotIn(forbidden, readonly)


if __name__ == "__main__":
    unittest.main()

