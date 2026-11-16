import hashlib
import io
import json
import os
import pathlib
import runpy
import stat
import tarfile
import tempfile
import types
import unittest
from unittest.mock import patch


BASE = pathlib.Path(__file__).parents[2] / "scripts"
stage = runpy.run_path(str(BASE / "baota-account-release-stage.py"))["stage_verified_account_runtime"]
package = runpy.run_path(str(BASE / "account-release-package.py"))
build, plan = "a" * 40, "b" * 64


class ReleaseStageTest(unittest.TestCase):
    def stage_fixture(self, *, invalid=False, transport_drift=False):
        upstream = dict(local_sha=build, remote_sha=build, remote_branch="main", repository="18Mozhi/midou-ai-Product-Selection")
        files = {name: b"code" for name in (
            "frontend/index.html", "backend/apps/backend/dist/server.js", "backend/apps/worker/dist/index.js",
            "backend/scripts/run-account-production-cutover.mjs", "backend/scripts/serve-account-production-cutover.mjs",
            "python/scoutops_crawler/__main__.py",
            "backend/database/migrations/" + package["MIGRATION"],
        )}
        env = package["release_metadata"](upstream, "1.0.0", plan)
        files["release.env"] = "".join(f"{k}={v}\n" for k, v in env.items()).encode()
        manifest = dict(schema=1, build_sha=build, plan_sha256=plan, migration=package["MIGRATION"],
                        files={key: hashlib.sha256(value).hexdigest() for key, value in files.items()})
        if invalid:
            manifest["files"]["frontend/index.html"] = "f" * 64
        files["manifest.json"] = json.dumps(manifest).encode()
        with tempfile.TemporaryDirectory(prefix="scoutops-stage-unit-") as temp:
            root = pathlib.Path(temp).resolve()
            config = root / "config"
            config.mkdir()
            upload = config / ("account-upload-" + build + ".tar.gz")
            with tarfile.open(upload, "w:gz") as archive:
                for name, data in files.items():
                    entry = tarfile.TarInfo(name)
                    entry.size = len(data)
                    archive.addfile(entry, io.BytesIO(data))
            upload.chmod(0o600)
            sha = "f" * 64 if transport_drift else hashlib.sha256(upload.read_bytes()).hexdigest()
            dest = config / ("account-release-" + build)
            os_for_module = os
            filesystem_stat = stat
            if os.name == "nt":
                source_stat = upload.stat()
                os_for_module = types.SimpleNamespace(open=os.open, fdopen=os.fdopen, O_RDONLY=os.O_RDONLY | os.O_BINARY,
                    O_NOFOLLOW=0, O_NONBLOCK=0, geteuid=lambda: 0,
                    fstat=lambda fd: types.SimpleNamespace(st_mode=stat.S_IFREG | 0o600, st_uid=0, st_nlink=1, st_size=source_stat.st_size))
                filesystem_stat = types.SimpleNamespace(S_ISREG=stat.S_ISREG, S_IMODE=lambda mode: 0o600 if stat.S_ISREG(mode) else 0o700)
            with patch.dict(stage.__globals__, ROOT=root, os=os_for_module, stat=filesystem_stat):
                if invalid or transport_drift:
                    code = "archive_digest_mismatch" if transport_drift else "identity_or_checksum_mismatch"
                    with self.assertRaisesRegex(RuntimeError, code):
                        stage(upload, build, plan, sha, package["verify_account_archive"])
                    self.assertFalse(dest.exists())
                else:
                    path, result = stage(upload, build, plan, sha, package["verify_account_archive"])
                    self.assertEqual(path, dest)
                    self.assertEqual(result["files"], 8)
                    self.assertEqual((dest / "frontend/index.html").read_bytes(), b"code")
                    with self.assertRaises(FileExistsError):
                        stage(upload, build, plan, sha, package["verify_account_archive"])
                    self.assertEqual((dest / "frontend/index.html").read_bytes(), b"code")
            self.assertTrue(upload.is_file())

    def test_verified_payload_is_written_and_collision_preserves_existing(self):
        self.stage_fixture()

    def test_verification_failure_leaves_no_candidate_directory(self):
        self.stage_fixture(invalid=True)
        self.stage_fixture(transport_drift=True)


if __name__ == "__main__":
    unittest.main()
