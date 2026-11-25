import hashlib
import runpy
import subprocess
import unittest
from pathlib import Path

REPO=Path(__file__).resolve().parents[2]
T=runpy.run_path(str(REPO/"scripts/baota-account-trend-release.py"))
class CaptureTraceReleaseTest(unittest.TestCase):
    def test_exact_installed_engine_baseline_and_reversible_one_leaf(self):
        before,after=T["collection_hashes"]("capture_trace")
        self.assertEqual(set(before),{"packages/playwright-crawler/dist/index.js"})
        self.assertEqual(T["collection_hashes"]("capture_trace_restore"),(after,before))
        for name,digest in before.items():
            self.assertEqual(hashlib.sha256(T["build_collection_restore"](REPO,name,T["COLLECTION_CAPTURE_TRACE_SOURCE"])).hexdigest(),digest)
        with self.assertRaisesRegex(RuntimeError,"manifest_invalid"):
            T["prepare_amazon"](Path("project"),{},lambda *_:self.fail("unexpected read"),"capture_trace")
        with self.assertRaisesRegex(RuntimeError,"manifest_invalid"):
            T["publish"](REPO,T["REPORT_RUNTIME_BASE"],"0"*64,{},lambda *_:self.fail("unexpected SSH"),collection="capture_trace")
    def test_candidate_is_exact_compiled_source_and_no_other_payload(self):
        c="import ts from 'typescript';let s='';for await(const c of process.stdin)s+=c;process.stdout.write(ts.transpileModule(s,{fileName:'index.ts',compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,sourceMap:true}}).outputText)"
        b=subprocess.run(["node","--input-type=module","-e",c],input=subprocess.check_output(["git","show","0c72858d6b7f2a02d1b2512ac3a847e265a7a216:packages/playwright-crawler/src/index.ts"],cwd=REPO),capture_output=True,check=True).stdout
        self.assertEqual(hashlib.sha256(b).hexdigest(),T["COLLECTION_CAPTURE_TRACE_CANDIDATE"][T["COLLECTION_DETAIL"]])
        text=(REPO/"scripts/baota-account-trend-release.py").read_text(encoding="utf-8")
        self.assertIn('api_hashes["amazon-public-browser-health.js"] = COLLECTION_DUAL_HEALTH_CANDIDATE',text)
        self.assertIn('if collection in ("maintenance_bootstrap", "capture_trace", "capture_trace_restore", "screenshot_wait", "screenshot_wait_restore"):',text)
        self.assertIn('source = compact_release_source(source)',text)

if __name__=="__main__":unittest.main()
