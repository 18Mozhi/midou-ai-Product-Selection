import hashlib
import io
import json
import pathlib
import runpy
import tarfile
import tempfile
import unittest


PACKAGE = runpy.run_path(str(pathlib.Path(__file__).parents[2] / "scripts/account-release-package.py"))
BUILD, PLAN = "a" * 40, "b" * 64
SOURCE = dict(local_sha=BUILD, remote_sha=BUILD, remote_branch="main", repository="18Mozhi/midou-ai-Product-Selection")


class AccountReleasePackageTest(unittest.TestCase):
    def test_compiled_dist_only_packages_current_outputs(self):
        with tempfile.TemporaryDirectory(prefix="scoutops-package-unit-") as scratch:
            dist = pathlib.Path(scratch) / "dist"
            dist.mkdir()
            for name in ("current.js", "deleted-organization.js"):
                (dist / name).write_text("export {};", encoding="utf-8")
            selected = {}

            def add(source, dest):
                selected[dest] = source.read_text(encoding="utf-8")

            PACKAGE["add_compiled_dist"](add, dist, "apps/api", ["current.js"])
            self.assertEqual(selected, {"backend/apps/api/dist/current.js": "export {};"})
            self.assertTrue((dist / "deleted-organization.js").is_file())
            with self.assertRaises(FileNotFoundError):
                PACKAGE["add_compiled_dist"](add, dist, "apps/api", ["missing.js"])
            with self.assertRaisesRegex(RuntimeError, "dist_manifest_invalid"):
                PACKAGE["add_compiled_dist"](add, dist, "apps/api", ["../other.js"])

    def test_only_approved_release_identity_selects_retired_runtime_mode(self):
        release = PACKAGE["release_metadata"](SOURCE, "1.2.3", PLAN)
        self.assertEqual(release["ACCOUNT_SCOPE_MODE"], "retired")
        self.assertTrue(release["RELEASE_SOURCE_MIGRATION_VERSION"].startswith("0197_"))
        for change in [dict(remote_branch="debug"), dict(remote_sha="c" * 40), dict(repository="other/repo")]:
            with self.assertRaisesRegex(RuntimeError, "invalid_source_identity"):
                PACKAGE["release_metadata"](SOURCE | change, "1.2.3", PLAN)

    def verify_fixture(self, *, bad_hash=False, unexpected=None):
        release = PACKAGE["release_metadata"](SOURCE, "1.2.3", PLAN)
        files = {name: b"example" for name in (
            "frontend/index.html", "backend/apps/backend/dist/server.js", "backend/apps/worker/dist/index.js",
            "backend/scripts/run-account-production-cutover.mjs", "backend/scripts/serve-account-production-cutover.mjs",
            "python/scoutops_crawler/__main__.py",
            "backend/database/migrations/" + PACKAGE["MIGRATION"],
        )}
        files["release.env"] = "".join(f"{key}={value}\n" for key, value in release.items()).encode()
        if unexpected:
            files[unexpected] = b"unexpected"
        hashes = {key: hashlib.sha256(value).hexdigest() for key, value in files.items()}
        if bad_hash:
            hashes["frontend/index.html"] = "f" * 64
        files["manifest.json"] = json.dumps(dict(schema=1, build_sha=BUILD, plan_sha256=PLAN,
                                                  migration=PACKAGE["MIGRATION"], files=hashes)).encode()
        with tempfile.TemporaryDirectory(prefix="scoutops-package-unit-") as sandbox:
            path = pathlib.Path(sandbox) / "fixture.tar.gz"
            with tarfile.open(path, "w:gz") as archive:
                for key, value in files.items():
                    entry = tarfile.TarInfo(key)
                    entry.size = len(value)
                    archive.addfile(entry, io.BytesIO(value))
            return PACKAGE["verify_account_archive"](path, BUILD, PLAN)

    def test_reopens_archive_and_checks_member_hashes(self):
        self.assertEqual(self.verify_fixture()["files"], 8)
        with self.assertRaisesRegex(RuntimeError, "identity_or_checksum_mismatch"):
            self.verify_fixture(bad_hash=True)

    def test_unsafe_paths_are_rejected_even_with_matching_hashes(self):
        for name in ["../escape", "backend/.env", "backups/archive.sql", "python/node_modules/a"]:
            with self.assertRaisesRegex(RuntimeError, "unsafe_member"):
                self.verify_fixture(unexpected=name)


if __name__ == "__main__":
    unittest.main()
