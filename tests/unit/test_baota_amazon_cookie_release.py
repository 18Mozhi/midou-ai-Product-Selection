import base64
import contextlib
import hashlib
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zlib

ROOT = Path(__file__).resolve().parents[2]
C = runpy.run_path(str(ROOT / "scripts/baota-amazon-cookie-release.py"))

class CookieReleaseTest(unittest.TestCase):
    def test_exact_scope_and_source_recipe(self):
        self.assertEqual(len(C["BASE_HASHES"]), 10)
        self.assertEqual(sum(v is None for v in C["BASE_HASHES"].values()), 2)
        self.assertTrue(all(not n.startswith(("apps/crawler/", "python/")) for n in C["BASE_HASHES"]))
        source = C["engine_overlay"](ROOT).decode()
        self.assertIn('session_mode === "administrator_cookie"', source)
        self.assertNotIn("options.dailyDelivery?.refresh", source)
        C["validate_changes"](["apps/api/src/amazon-cookie-session-service.ts", "docs/amazon-administrator-cookie.md"])
        for name in ["apps/worker/src/index.ts", "database/migrations/0200.sql", "apps/crawler/scoutops_crawler/__main__.py"]:
            with self.assertRaisesRegex(RuntimeError, "unrelated_runtime_change"):
                C["validate_changes"]([name])

    def fixture(self, root):
        baseline, protected, manifest = {}, {}, {}
        for name, value in C["BASE_HASHES"].items():
            prior = b"owned:" + name.encode()
            path = root / "backend" / name
            path.parent.mkdir(parents=True, exist_ok=True)
            if value is not None:
                path.write_bytes(prior)
            baseline[name] = None if value is None else hashlib.sha256(prior).hexdigest()
            after = b"changed:" + name.encode()
            manifest[name] = (baseline[name], base64.b64encode(zlib.compress(after)).decode(), hashlib.sha256(after).hexdigest())
        g = C["prepare"].__globals__
        for name in g["PROTECTED_HASHES"]:
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"protected")
            protected[name] = hashlib.sha256(b"protected").hexdigest()
        return baseline, protected, manifest

    def check(self, mutation=None, expected=None):
        with tempfile.TemporaryDirectory(prefix="scoutops-cookie-release-test-") as directory:
            root = Path(directory)
            baseline, protected, manifest = self.fixture(root)
            if mutation:
                mutation(root, manifest)
            with patch.dict(C["prepare"].__globals__, {"BASE_HASHES": baseline, "PROTECTED_HASHES": protected}):
                read = lambda path, maximum: path.read_bytes()
                if expected:
                    with self.assertRaisesRegex(RuntimeError, expected):
                        C["prepare"](root, manifest, read)
                else:
                    replacements, preserved = C["prepare"](root, manifest, read)
                    self.assertEqual(len(replacements), 10)
                    self.assertEqual(len(preserved), len(protected))

    def test_valid_precise_manifest(self):
        self.check()

    def test_foreign_path_rejected(self):
        self.check(lambda r,m: m.update({"../python/evil.py": next(iter(m.values()))}), "manifest_changed")

    def test_live_drift_rejected(self):
        self.check(lambda r,m: (r / "backend" / next(iter(m))).write_bytes(b"drift"), "live_module_drift")

    def test_new_module_must_be_absent(self):
        name = next(n for n,v in C["BASE_HASHES"].items() if v is None)
        self.check(lambda r,m: (r / "backend" / name).write_bytes(b"existing"), "new_module_already_exists")

    def test_payload_hash_enforced(self):
        def change(root, manifest):
            name = next(iter(manifest))
            before, data, digest = manifest[name]
            manifest[name] = (before, data, "0" * 64)
        self.check(change, "payload_invalid")

    def test_protected_transport_not_overwritten(self):
        name = next(iter(C["prepare"].__globals__["PROTECTED_HASHES"]))
        self.check(lambda r,m: (r / name).write_bytes(b"drift"), "protected_module_drift")

    def test_cli_invalid_identity_fails_before_connection(self):
        p = subprocess.run(["python", "-B", "scripts/deploy-account-baota.py", "--amazon-cookie-session",
            "--expected-previous-sha", "0"*40, "--expected-module-sha256", "0"*64], cwd=ROOT, capture_output=True)
        self.assertEqual(p.returncode, 2)
        self.assertIn(b"Cookie release requires exact", p.stderr)

if __name__ == "__main__":
    unittest.main()
