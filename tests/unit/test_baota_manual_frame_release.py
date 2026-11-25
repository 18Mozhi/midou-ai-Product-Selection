import hashlib
import runpy
import subprocess
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
T = runpy.run_path(str(REPO / "scripts/baota-account-trend-release.py"))

class ManualFrameReleaseTest(unittest.TestCase):
    def test_exact_two_modules_and_reconstructed_baseline(self):
        before, after = T["collection_hashes"]("manual_frame")
        self.assertEqual(set(before), {T["COLLECTION_DETAIL"], T["COLLECTION_MANUAL_FRAME_MODULE"]})
        self.assertEqual(T["collection_hashes"]("manual_frame_restore"), (after, before))
        for name, digest in before.items():
            data = T["build_collection_restore"](REPO, name, T["COLLECTION_MANUAL_FRAME_SOURCE"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), digest)
        with self.assertRaisesRegex(RuntimeError, "manifest_invalid"):
            T["prepare_amazon"](Path("fixture"), {}, lambda *_: self.fail("unexpected read"), "manual_frame")
        with self.assertRaisesRegex(RuntimeError, "manifest_invalid"):
            T["publish"](REPO, T["REPORT_RUNTIME_BASE"], "0" * 64, {},
                         lambda *_: self.fail("unexpected SSH"), collection="manual_frame")

    def test_both_candidates_match_canonical_utf8_source(self):
        script = "import ts from 'typescript';let s='';for await(const c of process.stdin)s+=c;process.stdout.write(ts.transpileModule(s,{fileName:process.argv[1],compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,sourceMap:true}}).outputText)"
        for name, expected in T["COLLECTION_MANUAL_FRAME_CANDIDATE"].items():
            source = name.replace("/dist/", "/src/").removesuffix(".js") + ".ts"
            result = subprocess.run(["node", "--input-type=module", "-e", script, Path(source).name],
                input=(REPO / source).read_bytes().replace(b"\r\n", b"\n"), capture_output=True, check=True)
            self.assertEqual(hashlib.sha256(result.stdout).hexdigest(), expected)
        text = (REPO / "scripts/baota-account-trend-release.py").read_text(encoding="utf-8")
        self.assertIn('api_hashes["amazon-public-browser-health.js"] = COLLECTION_DUAL_HEALTH_CANDIDATE', text)
        self.assertIn('if path in replacements:\n                continue', text)
        self.assertIn('source = compact_release_source(source)', text)
        self.assertIn('"manual_frame", "manual_frame_restore") else None)', text)

    def test_mutually_exclusive_cli_actions_reject_before_ssh(self):
        for flag in ("--collection-manual-frame-only", "--collection-manual-frame-rollback"):
            p = subprocess.run(["python", "-B", "scripts/deploy-account-baota.py", flag,
                "--collection-viewport-evidence-only"], cwd=REPO, capture_output=True, text=True)
            self.assertEqual(p.returncode, 2)
            self.assertIn("not allowed with argument", p.stderr)

if __name__ == "__main__":
    unittest.main()
