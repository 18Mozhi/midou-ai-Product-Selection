import io
import json
from pathlib import Path
import runpy
import tarfile
import unittest
from datetime import datetime, timedelta, timezone
from tempfile import TemporaryDirectory
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

    def test_scoped_degradation_gate_checks_fresh_backpressure_not_failures(self):
        now = datetime.now(timezone.utc)
        snap = dict(observed_at=now.isoformat(), status="running", backpressure=True,
                    suspected_stuck_runs=0, failed_last_minute=0, snapshot_publish_failed_total=0,
                    queues=[{"name": "collection_tasks", "circuit_state": "closed"}])
        with TemporaryDirectory() as tmp:
            file = Path(tmp).resolve() / "worker-scheduler.json"
            file.write_text(json.dumps(snap))
            self.assertTrue(static["expected_scheduler_backpressure"](file, now))
            self.assertFalse(static["expected_scheduler_backpressure"](file, now + timedelta(seconds=21)))
            file.write_text(json.dumps(dict(snap, failed_last_minute=1)))
            self.assertFalse(static["expected_scheduler_backpressure"](file, now))
            file.write_text(json.dumps(dict(snap, queues=[{"circuit_state": "open"}])))
            self.assertFalse(static["expected_scheduler_backpressure"](file, now))
            file.write_text(json.dumps(dict(snap, queues=[dict(last_result_at=now.isoformat(),
                last_result_error_code="network_error", last_result_status="retry_scheduled")])))
            self.assertFalse(static["expected_scheduler_backpressure"](file, now))


if __name__ == "__main__":
    unittest.main()
