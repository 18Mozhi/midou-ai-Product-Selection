import errno
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from deploy_baota_backup_gate import ARCHIVE_ROLLBACKS


class BackupGateTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name).resolve()
        self.backups = self.root / "backups"
        self.backups.mkdir()
        self.holding = self.root / "runtime" / "tmp"
        self.holding.mkdir(parents=True)
        sha = "a" * 40
        self.source = self.root / (".deploy-rollback-" + sha)
        self.source.mkdir()
        (self.source / "release.env").write_bytes(b"old release bytes")
        self.destination = self.backups / ("deploy-rollback-" + sha)
        scope = {}
        exec(ARCHIVE_ROLLBACKS, scope)
        self.archive = scope["archive_rollbacks"]
        original_read_text = Path.read_text
        mocked_mounts = patch.object(Path, "read_text", lambda path, *a, **kw:
            "" if path == Path("/proc/self/mountinfo") else original_read_text(path, *a, **kw))
        mocked_mounts.start()
        self.addCleanup(mocked_mounts.stop)

    def test_same_device_rename_and_collision(self):
        self.destination.mkdir()
        with self.assertRaisesRegex(RuntimeError, "destination already exists"):
            self.archive(self.root, False)
        self.assertTrue(self.source.is_dir())
        self.destination.rmdir()
        self.assertEqual(self.archive(self.root, False), {"archived": 1, "cross_device": 0})
        self.assertFalse(self.source.exists())
        self.assertEqual((self.destination / "release.env").read_bytes(), b"old release bytes")

    def test_exdev_copies_checksums_then_retains_original(self):
        rename = Path.rename

        def cross_device(path, target):
            if path == self.source and target == self.destination:
                raise OSError(errno.EXDEV, "cross-device fixture")
            return rename(path, target)

        calls = []

        def rsync(argv, **kwargs):
            self.assertEqual(argv[:4], ["/usr/bin/rsync", "-aHAX", "--numeric-ids", "--one-file-system"])
            src, dst = map(Path, argv[-2:])
            calls.append(dst)
            if "--dry-run" in argv:
                self.assertIn("--checksum", argv)
                self.assertEqual((src / "release.env").read_bytes(), (dst / "release.env").read_bytes())
            else:
                shutil.copytree(src, dst)
            return SimpleNamespace(stdout=b"", stderr=b"")

        with patch.object(Path, "rename", cross_device):
            with patch("subprocess.run", side_effect=rsync):
                self.assertEqual(self.archive(self.root, False), {"archived": 1, "cross_device": 1})
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[-1], self.destination)
        self.assertFalse(self.source.exists())
        original, = self.holding.glob("*/.deploy-rollback-*/release.env")
        self.assertEqual(original.read_bytes(), b"old release bytes")

    def test_failed_checksum_keeps_source_and_never_publishes_backup(self):
        with patch.object(Path, "rename", side_effect=OSError(errno.EXDEV, "fixture")):
            with patch("subprocess.run", side_effect=[
                SimpleNamespace(stdout=b"", stderr=b""),
                SimpleNamespace(stdout=b"checksum mismatch", stderr=b""),
            ]):
                with self.assertRaisesRegex(RuntimeError, "readback differs"):
                    self.archive(self.root, False)
        self.assertTrue(self.source.is_dir())
        self.assertFalse(self.destination.exists())
        self.assertEqual(list(self.holding.iterdir()), [])
        self.assertEqual(list(self.backups.iterdir()), [])
