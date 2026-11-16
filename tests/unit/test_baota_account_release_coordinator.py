import ast
import contextlib
import json
import pathlib
import re
import runpy
import types
import unittest
from unittest.mock import patch


SCRIPTS = pathlib.Path(__file__).parents[2] / "scripts"
COORD = runpy.run_path(str(SCRIPTS / "baota-account-release-coordinator.py"))
LOCAL = runpy.run_path(str(SCRIPTS / "deploy-account-baota.py"))
DRAIN = runpy.run_path(str(SCRIPTS / "baota-account-claim-drain.py"))


class Steps:
    build_sha = "a" * 40

    def __init__(self, fail=None):
        self.calls = []
        self.fail = fail

    def event(self, name):
        self.calls.append(name)
        if self.fail == name:
            raise RuntimeError(name)

    def stage(self): self.event("stage")
    def prepare_dependencies_and_routes(self): self.event("dependencies")
    def journal(self, phase): self.event(phase)
    def quiesce(self): self.event("quiesce")
    def restore_unchanged_baseline(self): self.event("restore_unchanged_baseline")
    def reload_routes(self): self.event("routes")
    def activate(self): self.event("activate")
    def cleanup(self): self.event("cleanup")

    @contextlib.contextmanager
    def database_session(self):
        self.event("lock")
        try:
            yield self
        finally:
            self.event("unlock")

    def prepare(self):
        self.event("prepare")
        return {"run_id": "uuid", "review": {"review_sha256": "a"*64, "scope_counts": {"shared": "2"},
                "record_counts_by_table_and_reason": {name: {"shared": "1"} for name in
                    ["opportunities", "trend_topics", "trend_signals", "competitors", "raw_evidence",
                     "collection_tasks", "score_rules", "cost_rules"]}}}

    def apply(self, review):
        self.event("apply")
        return {"forward": {"receipt": {"applied": 121}}}

    def fence(self): self.event("fence")

    def install(self, database, fence):
        fence()
        self.event("install")


class CoordinatorTest(unittest.TestCase):
    def test_old_release_cli_cannot_start_backup_or_runtime_operations(self):
        legacy = runpy.run_path(str(SCRIPTS / "deploy-baota.py"))
        for options in ([], ["--backup-tools-only", "apply"], ["--initialize-layout"], ["--rollback-drill"]):
            with patch("sys.argv", ["deploy-baota.py", *options]):
                with self.assertRaisesRegex(SystemExit, "Legacy deployment disabled"):
                    legacy["main"]()

    def test_worker_drain_restarts_zero_window_after_activity_and_fails_closed(self):
        empty = dict.fromkeys(DRAIN["DRAIN_KEYS"], 0)
        busy = dict(empty, intelligence_active=1, worker_active=1)
        samples = iter([empty, empty, busy, empty, empty, empty, empty])
        DRAIN["verify_collection_drained"](lambda: next(samples), attempts=7, sleep=lambda _: None)
        with self.assertRaisesRegex(RuntimeError, "worker_drain_timeout"):
            DRAIN["verify_collection_drained"](lambda: busy, attempts=4, sleep=lambda _: None)
        with self.assertRaisesRegex(RuntimeError, "drain_sample_invalid"):
            DRAIN["verify_collection_drained"](lambda: dict(empty, worker_active=False))

    def test_only_the_owned_pause_can_be_restored_after_an_uncertain_response(self):
        drain = DRAIN["BaselineClaimDrain"](pathlib.Path("/example"), "/node")
        calls = []
        paused_by = None

        def action(verb):
            nonlocal paused_by
            calls.append(verb)
            if verb == "pause":
                paused_by = drain.owner
                raise RuntimeError("response_lost")
            if verb == "resume":
                paused_by = None
                return {"paused": False, "maintenanceId": drain.owner}
            return {"paused": paused_by is not None, "maintenanceId": paused_by}

        drain.claim_action = action
        with self.assertRaisesRegex(RuntimeError, "response_lost"):
            drain.pause()
        drain.resume_owned()
        self.assertEqual(calls, ["status", "pause", "status", "resume"])
        self.assertFalse(drain.pause_attempted)
        drain.pause_attempted = True
        paused_by = "operator-other"
        with self.assertRaisesRegex(RuntimeError, "owner_changed"):
            drain.resume_owned()
        self.assertEqual(calls[-1], "status")
        self.assertEqual(paused_by, "operator-other")

    def test_quiesce_verifies_final_drain_and_stopped_processes_before_resuming_claims(self):
        calls = []
        def event(name):
            return lambda: calls.append(name)
        def panel(action, final):
            self.assertEqual(action, "quiesce")
            calls.append("python_stop")
            final()
            calls.append("node_stop")
        steps = types.SimpleNamespace(
            _panel=panel, assert_stopped=event("stopped"),
            claim_drain=types.SimpleNamespace(
                pause=event("pause"), drain=event("drain"), verify_final=event("final"),
                resume_owned=event("resume"),
            ),
        )
        COORD["BaoTaRelease"].quiesce(steps)
        self.assertEqual(calls, ["pause", "drain", "python_stop", "final", "node_stop", "stopped", "resume"])

    def test_public_verification_requires_exact_404_without_redirect(self):
        function = LOCAL["verify_public_retired_pages"]
        for status in (404, 200, 302, 403):
            with self.subTest(status=status):
                calls = []
                class Connection:
                    def __init__(self, host, timeout):
                        self.assertion = (host, timeout)
                    def request(self, method, path, headers):
                        calls.append((self.assertion, method, path))
                    def getresponse(self):
                        return types.SimpleNamespace(status=status, read=lambda _: b"", close=lambda: None)
                    def close(self):
                        pass
                with patch.dict(function.__globals__, {"HTTPSConnection": Connection}):
                    if status == 404:
                        function()
                        self.assertEqual(len(calls), 3)
                    else:
                        with self.assertRaisesRegex(RuntimeError, "public_legacy_page_visible"):
                            function()
                        self.assertEqual(len(calls), 1)
                self.assertEqual(calls[0], (("midouai.medouai.com", 10), "GET", "/select-context"))

    def test_public_spa_route_include_never_serves_retired_scope(self):
        catalog = SCRIPTS.parent / "config/route-catalog.json"
        routes = json.loads(catalog.read_text(encoding="utf-8"))["routes"]
        rule = COORD["render_account_spa_routes"](routes).splitlines()[0]
        regex = re.compile(rule.removeprefix("location ~ ").removesuffix(" {"))
        for path in ("/select-context", "/org-admin", "/org-admin/members/", "/platform-admin/organizations",
                     "/platform-admin/organizations/new", "/platform-admin/organizations/sample", "/resource-grants"):
            self.assertIsNone(regex.fullmatch(path), path)
        for path in ("/login", "/opportunities", "/me", "/platform-admin/accounts"):
            self.assertIsNotNone(regex.fullmatch(path), path)
        for route in routes:
            if route["acceptance"] == "internal":
                self.assertIsNone(regex.fullmatch(route["path"]), route)

    def test_standalone_crawler_probe_gate_refuses_orphan_runs_and_live_leases(self):
        for counts in ({"running": 4, "leases": 0}, {"running": 0, "leases": 1}):
            with self.assertRaisesRegex(RuntimeError, "standalone_crawler_not_drained"):
                LOCAL["require_drained_crawler"](counts)
        self.assertIsNone(LOCAL["require_drained_crawler"]({"running": 0, "leases": 0}))

    def test_activation_waits_for_migration_install_and_locked_session_release(self):
        steps = Steps()
        self.assertEqual(COORD["coordinate_account_release"](steps)["migration_receipts"], 121)
        self.assertEqual(steps.calls, ["stage", "dependencies", "prepared", "quiesce", "writers_stopped", "lock",
            "prepare", "applying_database", "apply", "database_verified", "fence", "install", "runtime_installed",
            "unlock", "routes", "activate", "runtime_ready", "cleanup"])

    def test_failed_preparation_can_restart_only_unchanged_baseline(self):
        steps = Steps(fail="prepare")
        with self.assertRaisesRegex(RuntimeError, "prepare"):
            COORD["coordinate_account_release"](steps)
        self.assertIn("restore_unchanged_baseline", steps.calls)
        self.assertNotIn("apply", steps.calls)
        self.assertNotIn("activate", steps.calls)

    def test_post_apply_failure_never_activates_either_runtime(self):
        for phase in ("apply", "install"):
            steps = Steps(fail=phase)
            with self.assertRaisesRegex(RuntimeError, phase):
                COORD["coordinate_account_release"](steps)
            self.assertNotIn("restore_unchanged_baseline", steps.calls)
            self.assertNotIn("activate", steps.calls)

    def test_failed_account_activation_does_not_record_runtime_ready_or_cleanup(self):
        steps = Steps(fail="activate")
        with self.assertRaisesRegex(RuntimeError, "activate"):
            COORD["coordinate_account_release"](steps)
        self.assertIn("runtime_installed", steps.calls)
        self.assertNotIn("runtime_ready", steps.calls)
        self.assertNotIn("cleanup", steps.calls)
        self.assertNotIn("restore_unchanged_baseline", steps.calls)

    def test_real_activation_requires_panel_route_proof(self):
        activate = COORD["BaoTaRelease"].activate
        for value in ({}, {"account_routes_verified": 1}, {"account_routes_verified": False}):
            with self.assertRaisesRegex(RuntimeError, "node_scope_proof_missing"):
                activate(type("Fixture", (), {"_panel": lambda _, action: value})())
        confirmed = []
        fixture = types.SimpleNamespace(
            _panel=lambda action: {"account_routes_verified": True},
            claim_drain=types.SimpleNamespace(verify_active=confirmed.append),
            build_sha="a" * 40,
        )
        self.assertIsNone(activate(fixture))
        self.assertEqual(confirmed, [fixture.build_sha])

    def test_worker_activation_needs_two_advancing_samples_from_the_same_worker(self):
        check = DRAIN["BaselineClaimDrain"](pathlib.Path("/example"), "/node")
        original, replacement = (101, 3), (102, 4)
        workers = iter([[original], [replacement], [replacement], [replacement]])
        stamps = iter(["1", "2", "2", "3"])
        observed = []
        check.worker_identities = lambda: next(workers)
        def sample(build, identity):
            observed.append((build, identity))
            return next(stamps)
        check.active_sample = sample
        check.verify_active("a" * 40, attempts=4, sleep=lambda _: None)
        self.assertEqual(len(observed), 4)
        self.assertEqual(observed[-2:], [("a" * 40, replacement)] * 2)
        check.worker_identities = lambda: [replacement]
        check.active_sample = lambda *args: "3"
        with self.assertRaisesRegex(RuntimeError, "worker_activation_unverified"):
            check.verify_active("a" * 40, attempts=2, sleep=lambda _: None)

    def test_remote_payload_is_python37_parseable_without_executing(self):
        rendered = LOCAL["remote_source"](SCRIPTS, {})
        ast.parse(rendered, feature_version=(3, 7))
        for filename in LOCAL["SOURCES"].values():
            ast.parse((SCRIPTS / filename).read_text(encoding="utf-8"), feature_version=(3, 7))


if __name__ == "__main__":
    unittest.main()
