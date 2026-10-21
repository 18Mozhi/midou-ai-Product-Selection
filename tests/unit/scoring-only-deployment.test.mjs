import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("scoring release is limited to two modules and official Node restart", () => {
  const source = readFileSync("scripts/deploy_baota_scoring.py", "utf8");
  assert.match(source, /restart_project.py nodejs ai选品/);
  assert.doesNotMatch(source, /restart_project.py python|apply-deployment-migrations|npm.*ci/);
  assert.match(source, /scoring_unrelated_runtime_change/);
  assert.match(source, /python_pids\(\)!=state\["python_pids"\]/);
  const run = spawnSync(
    "python",
    ["-B", "scripts/deploy-baota.py", "--scoring-only", "--frontend-only"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 2);
  assert.match(run.stderr, /cannot be combined/);
});

test("scoring package verifies bytes, preserves Python and restores pristine modules", () => {
  const code = String.raw`
import sys,tempfile,types,tarfile,io,hashlib,json,ast
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path('scripts').resolve()))
from deploy_baota_scoring import scoring_remote_source,MODULES
ast.parse(scoring_remote_source({}),feature_version=(3,7))
with tempfile.TemporaryDirectory(prefix='scoutops-scoring-unit-') as temp:
 root=Path(temp)
 for name in ('backend/apps/worker/dist','runtime/tmp','backups','config','frontend','python/scoutops_crawler','proc'):
  (root/name).mkdir(parents=True,exist_ok=True)
 for name in MODULES:(root/'backend/apps/worker/dist'/name).write_bytes(b'BASELINE')
 (root/'python/scoutops_crawler/protected.py').write_bytes(b'UNTOUCHED')
 class Model:
  def where(self,*args):return self
  def find(self):return {'project_type':'Node','path':str(root/'backend')}
 sys.modules['public']=types.SimpleNamespace(M=lambda *args:Model())
 archive=root/'runtime/tmp/test.tar.gz'
 with tarfile.open(archive,'w:gz') as tar:
  for name in MODULES:
   item=tarfile.TarInfo(name);item.size=8;tar.addfile(item,io.BytesIO(b'MODIFIED'))
 values={'sha':'a'*40,'action':'apply','archive_name':'test.tar.gz','archive_hash':hashlib.sha256(archive.read_bytes()).hexdigest(),'hashes':{n:hashlib.sha256(b'MODIFIED').hexdigest() for n in MODULES}}
 def execute(v):exec(scoring_remote_source(v).replace('/www/wwwroot/ai选品',root.as_posix()).replace('Path("/proc")','Path('+repr((root/'proc').as_posix())+')'),{})
 try:execute({**values,'archive_hash':'0'*64})
 except RuntimeError as e:assert str(e)=='scoring_archive_invalid'
 else:raise AssertionError('bad hash accepted')
 execute(values)
 execute({**values,'action':'verify'})
 assert all((root/'backend/apps/worker/dist'/n).read_bytes()==b'MODIFIED' for n in MODULES)
 execute({**values,'action':'rollback'})
 assert all((root/'backend/apps/worker/dist'/n).read_bytes()==b'BASELINE' for n in MODULES)
 assert (root/'python/scoutops_crawler/protected.py').read_bytes()==b'UNTOUCHED'
 print('scoring real-file apply/readback/rollback passed')
`;
  const run = spawnSync("python", ["-B", "-c", code], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /scoring real-file apply\/readback\/rollback passed/);
});
