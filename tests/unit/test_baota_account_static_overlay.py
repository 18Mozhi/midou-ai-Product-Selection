import ast
import json
import runpy
import subprocess
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
STATIC_PATH = REPO / "scripts/baota-account-static-release.py"
TREND = runpy.run_path(str(REPO / "scripts/baota-account-trend-release.py"))

def pinned_modules(path):
    module = runpy.run_path(str(path))
    if "required_collection_modules" in module:
        return module["required_collection_modules"](TREND)
    return legacy_modules(path.read_text(encoding="utf-8"))

def legacy_modules(text):
    # Replays the original inline manifest as data, without build/SSH/file writes.
    tree = ast.parse(text)
    publish = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "deploy_static")
    assignment = next(n for n in ast.walk(publish) if isinstance(n, ast.Assign)
        and any(isinstance(t, ast.Name) and t.id == "required_node" for t in n.targets)
        and isinstance(n.value, ast.Dict))
    return eval(compile(ast.Expression(assignment.value), "owned_manifest", "eval"), {"collection": TREND})

class StaticOverlayTest(unittest.TestCase):
    def test_current_pinned_chain_and_unchanged_collection_modules(self):
        actual = pinned_modules(STATIC_PATH)
        expected = {**TREND["COLLECTION_DUAL_HEALTH_CANDIDATE"],
                    **TREND["COLLECTION_MAINTENANCE_CANDIDATE"],
                    **TREND["COLLECTION_MANUAL_FRAME_CANDIDATE"]}
        print(json.dumps({"required_node": {key: actual.get(key) for key in expected}}, sort_keys=True))
        self.assertEqual({key: actual.get(key) for key in expected}, expected)
        baseline = subprocess.check_output(["git", "show",
            "34ff928d5618c25ce58c1e9a31b8a531dfeb754a:scripts/baota-account-static-release.py"], cwd=REPO)
        # Preserve original last-wins precedence (e.g. later LAN health overrides
        # an earlier LAN candidate); only the five installed leaf pins may differ.
        self.assertEqual(actual, {**legacy_modules(baseline.decode("utf-8")), **expected})
        self.assertTrue(all(isinstance(v, str) and len(v) == 64 for v in actual.values()))

if __name__ == "__main__":
    if len(sys.argv) == 2 and Path(sys.argv[1]).is_file():
        STATIC_PATH = Path(sys.argv.pop(1))
    unittest.main()
