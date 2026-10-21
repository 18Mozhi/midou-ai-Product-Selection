import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("frontend-only mode rejects runtime flags and never restarts services", () => {
  const entry = readFileSync("scripts/deploy-baota.py", "utf8");
  const source = readFileSync("scripts/deploy_baota_frontend.py", "utf8");
  assert.match(entry, /args.frontend_only and \(args.initialize_layout/);
  assert.match(source, /frontend_site_identity_invalid/);
  assert.match(source, /frontend_protected_runtime_changed/);
  assert.match(source, /frontend-only release contains a non-UI runtime change/);
  assert.doesNotMatch(
    source,
    /restart_project|panel_node_action_source|apply-deployment-migrations|client\.exec_command/,
  );
});

test("static helper supports the existing BaoTa panel Python and class imports", () => {
  const source = readFileSync("scripts/deploy_baota_frontend.py", "utf8");
  assert.match(source, /sys\.path\.insert\(0, "\/www\/server\/panel\/class"\)/);
  assert.doesNotMatch(source, /\.unlink\(missing_ok=/);
  const result = spawnSync(
    "python",
    [
      "-B",
      "-c",
      "import sys,ast;sys.path.insert(0,'scripts');from deploy_baota_frontend import frontend_remote_source;ast.parse(frontend_remote_source({}),feature_version=(3,7));print('panel helper syntax: Python 3.7 compatible')",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Python 3.7 compatible/);
});

test("static publisher executes real byte readback, backup and wrong-hash refusal", () => {
  const code = String.raw`
import sys, tempfile, types, tarfile, hashlib, io, json
from pathlib import Path
sys.path.insert(0, str(Path('scripts').resolve()))
from deploy_baota_frontend import frontend_remote_source
with tempfile.TemporaryDirectory(prefix='scoutops-static-unit-') as directory:
    root=Path(directory); (root/'frontend').mkdir(); (root/'backups').mkdir(); (root/'runtime/tmp').mkdir(parents=True); (root/'config').mkdir()
    (root/'frontend/index.html').write_bytes(b'PRISTINE')
    (root/'config/release.env').write_bytes(b'BUILD_SHA=baseline')
    archive=root/'runtime/tmp/test.tar.gz'
    with tarfile.open(archive,'w:gz') as tar:
        for name,data in [('index.html',b'MODIFIED'),('assets/app.js',b'APP')]:
            item=tarfile.TarInfo(name);item.size=len(data);tar.addfile(item,io.BytesIO(data))
    class Model:
        def where(self,*args): return self
        def find(self): return {'name':'midouai.medouai.com','path':str(root/'frontend')}
    sys.modules['public']=types.SimpleNamespace(M=lambda *args:Model())
    values={'archive_name':'test.tar.gz','build_sha':'a'*40,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
    def execute(v):
        source=frontend_remote_source(v).replace('/www/wwwroot/ai选品',str(root).replace('\\','/'))
        exec(compile(source,'frontend-remote-test','exec'),{})
    # /proc is Linux-only; isolate process inventory in this local Windows unit.
    original=frontend_remote_source
    def frontend_remote_source(v):
        source=original(v)
        start=source.index('def pids():');end=source.index('archive=root/',start)
        return source[:start]+'def pids(): return [123,456]\n'+source[end:]
    try:
        execute({**values,'archive_sha256':'0'*64})
        raise AssertionError('bad hash accepted')
    except RuntimeError as error:
        assert str(error)=='frontend_archive_hash_mismatch'
    assert (root/'frontend/index.html').read_bytes()==b'PRISTINE'
    execute(values)
    assert (root/'frontend/index.html').read_bytes()==b'MODIFIED'
    assert (root/'backups'/('frontend-'+'a'*40)/'index.html').read_bytes()==b'PRISTINE'
    assert (root/'config/release.env').read_bytes()==b'BUILD_SHA=baseline'
    assert not archive.exists()
    # Force a post-write invariant failure and prove old index bytes are restored.
    with tarfile.open(archive,'w:gz') as tar:
        data=b'REJECTED'; item=tarfile.TarInfo('index.html');item.size=len(data);tar.addfile(item,io.BytesIO(data))
    previous_source=frontend_remote_source
    def frontend_remote_source(v):
        return previous_source(v).replace('if protected()!=before or pids()!=before_pids:', 'if True:')
    try:
        execute({**values,'build_sha':'b'*40,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()})
        raise AssertionError('invariant failure accepted')
    except RuntimeError as error:
        assert str(error)=='frontend_protected_runtime_changed'
    assert (root/'frontend/index.html').read_bytes()==b'MODIFIED'
    assert not archive.exists()
print('static publisher: hash rejection, byte readback, pristine backup, runtime unchanged, cleanup passed')
`;
  const result = spawnSync("python", ["-B", "-c", code], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /static publisher: hash rejection/);
});
