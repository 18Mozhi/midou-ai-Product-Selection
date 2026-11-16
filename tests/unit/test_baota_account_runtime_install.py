import io
import os
import pathlib
import runpy
import tempfile
import unittest
from unittest.mock import patch


INSTALL = runpy.run_path(str(pathlib.Path(__file__).parents[2] / "scripts/baota-account-runtime-install.py"))
activate = INSTALL["install_fixed_runtime"]
build, previous = "a" * 40, "b" * 40
verified = {
    "status": "database_verified",
    "forward": {
        "receipt": {"applied": 121}, "preservation": {"status": "matched"},
        "ownership": {"tenancy_schema": {"status": "retired"}},
    },
}


class RuntimeInstallTest(unittest.TestCase):
    def test_incomplete_db_result_does_not_call_install(self):
        with self.assertRaisesRegex(RuntimeError, "requires_verified_database_cutover"):
            activate(None, build, previous, {"status": "database_verified"}, self.fail)

    def test_bind_mount_inside_live_package_is_rejected(self):
        with patch("builtins.open", return_value=io.StringIO("1 2 0:99 / /www/wwwroot/ai选品/backend/cache rw\n")):
            with self.assertRaisesRegex(RuntimeError, "live_package_contains_mount"):
                INSTALL["check_mounts"](pathlib.PurePosixPath("/www/wwwroot/ai选品"))

    def test_fixed_install_moves_dependency_tree_and_never_touches_business_data(self):
        with tempfile.TemporaryDirectory(prefix="scoutops-install-unit-") as directory:
            root = pathlib.Path(directory)
            stage = root / "runtime/tmp" / ("account-release-" + build)
            for name in ("frontend", "backend", "python"):
                (root / name).mkdir(parents=True)
                (root / name / "old.txt").write_text("old")
                (stage / name).mkdir(parents=True)
                (stage / name / "new.txt").write_text("new")
            modules = root / "backend/node_modules"
            modules.mkdir()
            (modules / "dependency").write_text("moving only dependency bytes")
            (stage / "python/.runtime-deps/curl_cffi").mkdir(parents=True)
            (root / "config").mkdir()
            (root / "config/release.env").write_text(f"BUILD_SHA={previous}\n")
            (stage / "release.env").write_text(f"BUILD_SHA={build}\n")
            (root / "runtime/evidence").mkdir()
            evidence = root / "runtime/evidence/original"
            evidence.write_text("business")
            calls = []
            with patch.dict(activate.__globals__, ROOT=root, check_install_layout=lambda *args: {},
                            check_reusable_node_modules=lambda *args: modules), patch.object(os, "chown", create=True):
                result = activate(stage, build, previous, verified, lambda: calls.append("fenced"))
            self.assertEqual(result, {"status": "runtime_installed", "build_sha": build})
            self.assertEqual(len(calls), 5)
            self.assertEqual(evidence.read_text(), "business")
            self.assertEqual((root / "backend/node_modules/dependency").read_text(), "moving only dependency bytes")
            self.assertFalse((root / "backups").exists())
            self.assertFalse(list(root.rglob("old.txt")))
            self.assertTrue(all((root / n / "new.txt").is_file() for n in ("frontend", "backend", "python")))


if __name__ == "__main__":
    unittest.main()
