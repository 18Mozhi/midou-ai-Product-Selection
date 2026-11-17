import io
import json
from pathlib import Path
import runpy
import tarfile
import unittest
from unittest.mock import patch


static = runpy.run_path(str(Path(__file__).resolve().parents[2] / "scripts/baota-account-static-release.py"))


def bundle(entries):
    out = io.BytesIO()
    with tarfile.open(fileobj=out, mode="w:gz") as archive:
        for name, content in entries:
            info = tarfile.TarInfo(name)
            info.size = len(content)
            archive.addfile(info, io.BytesIO(content))
    return out.getvalue()


class StaticReleaseTest(unittest.TestCase):
    script = "assets/index-BJLyahnO.js"
    html = b'<script src="/assets/index-BJLyahnO.js"></script>'

    def test_valid_bundle_is_index_and_versioned_assets_only(self):
        files, refs = static["read_bundle"](bundle([("index.html", self.html), (self.script, b"js")]))
        self.assertEqual(refs, [self.script])
        self.assertEqual(files, {"index.html": self.html, self.script: b"js"})

    def test_unknown_paths_stable_files_and_duplicate_names_are_rejected(self):
        for entry in ("../config/release.env", "favicon.svg", "assets/../../index.html", self.script):
            with self.subTest(entry=entry), self.assertRaisesRegex(RuntimeError, "frontend_invalid_asset"):
                static["read_bundle"](bundle([("index.html", self.html), (self.script, b"js"), (entry, b"bad")]))

    def test_missing_referenced_asset_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "frontend_index_asset_missing"):
            static["read_bundle"](bundle([("index.html", self.html)]))

    def test_availability_rechecks_transient_degradation_but_rejects_worker_failure(self):
        before = [{"build_sha": "abc"}, {"status": "ready"}]
        healthy_services = {"api": "available", "worker": "available"}
        for service, succeeds, expected_calls in [("available", True, 4), ("unavailable", False, 3)]:
            responses = before + [{"status": "degraded", "services": dict(healthy_services, worker=service)},
                                  {"status": "available", "services": healthy_services}]
            replies = [io.BytesIO(json.dumps({"data": data}).encode()) for data in responses]
            with patch("urllib.request.urlopen", side_effect=replies) as get, patch("time.sleep"):
                if succeeds:
                    static["remote_check"]("abc")
                else:
                    with self.assertRaisesRegex(RuntimeError, "frontend_runtime_health_failed:available"):
                        static["remote_check"]("abc")
                self.assertEqual(get.call_count, expected_calls)


if __name__ == "__main__":
    unittest.main()
