import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

helpers = runpy.run_path("scripts/single-backend-rollback.py")
deployer = runpy.run_path("scripts/deploy-baota.py")


class RollbackTests(unittest.TestCase):
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
