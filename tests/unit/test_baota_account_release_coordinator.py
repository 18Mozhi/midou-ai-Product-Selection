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
        self.assertIsNone(activate(type("Fixture", (), {"_panel": lambda _, action: {"account_routes_verified": True}})()))

    def test_remote_payload_is_python37_parseable_without_executing(self):
        rendered = LOCAL["remote_source"](SCRIPTS, {})
        ast.parse(rendered, feature_version=(3, 7))
        for filename in LOCAL["SOURCES"].values():
            ast.parse((SCRIPTS / filename).read_text(encoding="utf-8"), feature_version=(3, 7))


if __name__ == "__main__":
    unittest.main()
