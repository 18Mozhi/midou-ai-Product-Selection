"""Static-only mode of the official BaoTa deployment command.

No service, configuration, queue, database or crawler mutation is permitted.
"""

import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import urllib.request
from uuid import uuid4


def frontend_remote_source(values: dict) -> str:
    return r'''import hashlib, json, os, shutil, sys, tarfile, tempfile
from pathlib import Path
sys.path.insert(0, "/www/server/panel")
sys.path.insert(0, "/www/server/panel/class")
import public
v=json.loads(PAYLOAD)
root=Path("/www/wwwroot/ai选品")
site=public.M("sites").where("id=?", (29,)).find()
front=root/"frontend"
if root.is_symlink() or root.resolve()!=root or not front.is_dir() or front.is_symlink(): raise RuntimeError("frontend_path_invalid")
if not isinstance(site,dict) or site.get("name")!="midouai.medouai.com" or site.get("path")!=str(front): raise RuntimeError("frontend_site_identity_invalid")
def protected():
    # Hash only; never return credentials or process arguments.
    paths=[root/"config"/"product_scout.env",root/"config"/"release.env"]
    for group in ("backend/apps", "backend/packages", "python/scoutops_crawler"):
        paths.extend(p for p in (root/group).rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix not in (".log",".pyc"))
    return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()}
def pids():
    found=[]
    for p in Path("/proc").iterdir():
        if not p.name.isdigit(): continue
        try:
            args=(p/"cmdline").read_bytes()
            if b"scoutops_crawler" in args or b"apps/backend/dist/server.js" in args or b"apps/worker/dist/" in args:
                found.append(int(p.name))
        except (FileNotFoundError,PermissionError,ProcessLookupError): pass
    return sorted(found)
archive=root/"runtime/tmp"/v["archive_name"]
if archive.parent.resolve()!=root/"runtime/tmp" or archive.is_symlink(): raise RuntimeError("frontend_archive_invalid")
if hashlib.sha256(archive.read_bytes()).hexdigest()!=v["archive_sha256"]: raise RuntimeError("frontend_archive_hash_mismatch")
before=protected(); before_pids=pids()
backup=root/"backups"/("frontend-"+v["build_sha"])
if backup.exists(): raise RuntimeError("frontend_backup_collision")
backup.mkdir(mode=0o700)
old_files=[]; temporaries=[]
try:
    with tempfile.TemporaryDirectory(prefix="frontend-",dir=root/"runtime/tmp") as staging:
        stage=Path(staging)
        with tarfile.open(archive) as tar:
            members=tar.getmembers()
            if any(not m.isfile() or Path(m.name).is_absolute() or ".." in Path(m.name).parts for m in members): raise RuntimeError("frontend_archive_member_invalid")
            tar.extractall(stage)
        files=sorted(p for p in stage.rglob("*") if p.is_file())
        if not (stage/"index.html").is_file(): raise RuntimeError("frontend_index_missing")
        # Keep hashed old assets for already-open browser tabs. Replace index last.
        files.sort(key=lambda p:p.name=="index.html")
        for source in files:
            rel=source.relative_to(stage); target=front/rel
            if target.is_symlink() or front not in target.resolve().parents: raise RuntimeError("frontend_target_invalid")
            if target.exists():
                saved=backup/rel; saved.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(target,saved); old_files.append(str(rel))
            target.parent.mkdir(parents=True,exist_ok=True)
            temporary=target.with_name(target.name+".upload-"+v["build_sha"])
            if temporary.exists() or temporary.is_symlink(): raise RuntimeError("frontend_temporary_collision")
            temporaries.append(temporary)
            shutil.copy2(source,temporary); os.chmod(temporary,0o644); os.replace(temporary,target)
        if protected()!=before or pids()!=before_pids: raise RuntimeError("frontend_protected_runtime_changed")
        for source in files:
            if source.read_bytes()!=(front/source.relative_to(stage)).read_bytes(): raise RuntimeError("frontend_readback_mismatch")
    (backup/"rollback.json").write_text(json.dumps({"files":old_files,"build_sha":v["build_sha"]}),encoding="utf-8")
except Exception:
    # Restore all overwritten bytes, including the prior index, before reporting failure.
    for rel in old_files: shutil.copy2(backup/rel,front/rel)
    raise
finally:
    for temporary in temporaries:
        if temporary.exists() or temporary.is_symlink(): temporary.unlink()
    if archive.exists() or archive.is_symlink(): archive.unlink()
print("SCOUTOPS_RESULT="+json.dumps({"status":True,"message":"frontend published without runtime restart","frontend_sha":v["build_sha"],"index_sha256":hashlib.sha256((front/"index.html").read_bytes()).hexdigest(),"protected_runtime_unchanged":True,"runtime_pids_unchanged":True,"backup":str(backup)}))
'''.replace("PAYLOAD", repr(json.dumps(values, ensure_ascii=False)))


def deploy_frontend(api, repo: Path, source_identity: dict) -> None:
    sha = source_identity["local_sha"]
    subprocess.run([api.local_npm_executable(), "run", "build:web"], cwd=repo, check=True)
    dist = repo / "apps/web/dist"
    (dist / "frontend-release.json").write_text(
        json.dumps({"build_sha": sha, "mode": "frontend-only"}) + "\n", encoding="utf-8"
    )
    with tempfile.TemporaryDirectory(prefix="scoutops-frontend-") as temporary:
        archive = Path(temporary) / "frontend.tar.gz"
        with tarfile.open(archive, "w:gz") as tar:
            for path in sorted(dist.rglob("*")):
                if path.is_file():
                    tar.add(path, arcname=path.relative_to(dist).as_posix(), recursive=False)
        client = api.paramiko.SSHClient()
        client.set_missing_host_key_policy(api.paramiko.RejectPolicy())
        client.load_host_keys(str(Path.home() / ".ssh/known_hosts"))
        client.connect(api.HOST, username=api.SSH_USER, password=api.read_windows_credential(), timeout=15)
        owner = str(uuid4())
        acquired = False
        upload_started = False
        remote = f"{api.PROJECT_ROOT}/runtime/tmp/frontend-{sha}-{owner}.tar.gz"
        try:
            api.remote_python(client, api.deployment_lock_source(owner), timeout=30)
            acquired = True
            api.remote_python(client, '''import json
from pathlib import Path
root=Path("/www/wwwroot/ai选品")
if root.is_symlink() or root.resolve()!=root: raise RuntimeError("frontend_root_invalid")
for sub in ("frontend","runtime","runtime/tmp","backups"):
    p=root/sub
    if not p.is_dir() or p.resolve()!=p: raise RuntimeError("frontend_upload_parent_invalid")
print("SCOUTOPS_RESULT="+json.dumps({"status":True,"message":"static upload paths verified"}))
''', timeout=30)
            identity = api.remote_python(client, api.production_identity_source(), timeout=30)
            api.verify_production_sha_history(repo, identity.get("build_sha"), sha)
            # Refuse hidden backend/runtime changes in this delivery.
            changed = api.run(["git", "diff", "--name-only", identity["build_sha"], sha], repo).splitlines()
            allowed = ("apps/web/", "docs/", "tests/", "scripts/", "new-product-enterprise-blueprint.md", "AGENTS.md", "BACKLOG.md")
            runtime = {"apps/worker/src/automatic-selection-evaluation.ts", "apps/worker/src/automatic-selection-evaluation-worker.ts"}
            if any(not path.startswith(allowed) for path in changed):
                if any(path not in runtime and not path.startswith(allowed) for path in changed):
                    raise RuntimeError("frontend-only release contains a non-UI runtime change")
                # Permit only an already verified scoring-only patch of this exact commit.
                # Check installed bytes against both receipt and this local build, not a label alone.
                from deploy_baota_scoring import MODULES
                hashes = {name: hashlib.sha256((repo/"apps/worker/dist"/name).read_bytes()).hexdigest() for name in MODULES}
                proof = api.remote_python(client, '''import hashlib,json
from pathlib import Path
r=Path("/www/wwwroot/ai选品/backend")
m=r/"scoring-release.json"
if r.resolve()!=r or m.is_symlink(): raise RuntimeError("scoring_proof_path_invalid")
v=json.loads(m.read_text())
for name,expected in v["modules"].items():
    if name not in ("automatic-selection-evaluation.js","automatic-selection-evaluation-worker.js"): raise RuntimeError("scoring_proof_module_invalid")
    p=r/"apps/worker/dist"/name
    if p.is_symlink() or p.resolve()!=p or hashlib.sha256(p.read_bytes()).hexdigest()!=expected: raise RuntimeError("scoring_proof_hash_invalid")
print("SCOUTOPS_RESULT="+json.dumps({"status":True,"sha":v["sha"],"modules":v["modules"]}))
''', timeout=30)
                if proof.get("sha") != sha or proof.get("modules") != hashes:
                    raise RuntimeError("frontend_scoring_patch_not_verified")
            with client.open_sftp() as sftp:
                upload_started = True
                sftp.put(str(archive), remote)
            result = api.remote_python(client, frontend_remote_source({
                "build_sha": sha, "archive_name": remote.rsplit("/", 1)[1],
                "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
            }), timeout=180)
            for route in ("/opportunities", "/home", "/frontend-release.json"):
                with urllib.request.urlopen(api.PUBLIC_BASE_URL + route + "?ui=" + sha, timeout=20) as response:
                    body = response.read()
                    if route.endswith(".json"):
                        if json.loads(body).get("build_sha") != sha:
                            raise RuntimeError("public frontend release identity mismatch")
                    elif hashlib.sha256(body).hexdigest() != result["index_sha256"]:
                        raise RuntimeError("public frontend index differs from deployed bytes")
            receipt = repo / ".artifacts/verification/frontend-only-production-evidence.json"
            receipt.parent.mkdir(parents=True, exist_ok=True)
            receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(json.dumps(result, ensure_ascii=False))
        finally:
            try:
                # Exact generated file only; never sweep runtime data or sessions.
                if upload_started:
                    api.remote_python(client, f"from pathlib import Path\nimport json\np=Path({remote!r})\nif p.parent.resolve()!=Path('/www/wwwroot/ai选品/runtime/tmp'): raise RuntimeError('frontend_cleanup_path_invalid')\nif p.exists() or p.is_symlink(): p.unlink()\nprint('SCOUTOPS_RESULT='+json.dumps({{'status':True}}))", timeout=30)
                if acquired:
                    api.remote_python(client, api.deployment_lock_source(owner, True), timeout=30)
            finally:
                client.close()
