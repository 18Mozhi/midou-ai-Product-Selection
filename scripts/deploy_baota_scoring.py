"""Bounded scoring-only release through the official BaoTa deployment entrypoint."""
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
from uuid import uuid4

MODULES = ("automatic-selection-evaluation.js", "automatic-selection-evaluation-worker.js")


def scoring_remote_source(values: dict) -> str:
    return r'''import hashlib,json,os,shutil,sys,tarfile,tempfile
from pathlib import Path
sys.path.insert(0,"/www/server/panel")
sys.path.insert(0,"/www/server/panel/class")
import public
v=json.loads(PAYLOAD)
root=Path("/www/wwwroot/ai选品")
backend=root/"backend"
modules=("automatic-selection-evaluation.js","automatic-selection-evaluation-worker.js")
row=public.M("sites").where("name=?",("ai选品",)).find()
if root.resolve()!=root or root.is_symlink() or not row or row.get("project_type")!="Node" or row.get("path")!=str(backend): raise RuntimeError("scoring_project_identity_invalid")
for name in ("backend","backend/apps/worker/dist","runtime/tmp","backups"):
    p=root/name
    if not p.is_dir() or p.resolve()!=p: raise RuntimeError("scoring_path_invalid")
targets=[backend/"apps/worker/dist"/name for name in modules]
metadata=backend/"scoring-release.json"
if metadata.is_symlink(): raise RuntimeError("scoring_metadata_path_invalid")
if any(not p.is_file() or p.is_symlink() for p in targets): raise RuntimeError("scoring_module_missing")
def protected():
    paths=[]
    for group in ("config","python/scoutops_crawler","frontend","backend/apps","backend/packages"):
        paths.extend(p for p in (root/group).rglob("*") if p.is_file() and p not in targets and "__pycache__" not in p.parts and p.suffix not in (".pyc",".log") and p.name!="deployment.lock")
    return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
def python_pids():
    ids=[]
    for p in Path("/proc").iterdir():
        if not p.name.isdigit(): continue
        try:
            if b"scoutops_crawler" in (p/"cmdline").read_bytes(): ids.append(int(p.name))
        except (FileNotFoundError,PermissionError,ProcessLookupError): pass
    return sorted(ids)
backup=root/"backups"/("scoring-"+v["sha"])
state_file=backup/"rollback.json"
if v["action"]=="apply":
    archive=root/"runtime/tmp"/v["archive_name"]
    if archive.parent.resolve()!=root/"runtime/tmp" or archive.is_symlink() or hashlib.sha256(archive.read_bytes()).hexdigest()!=v["archive_hash"]: raise RuntimeError("scoring_archive_invalid")
    if backup.exists(): raise RuntimeError("scoring_backup_collision")
    before=protected();pids=python_pids()
    with tempfile.TemporaryDirectory(prefix="scoring-",dir=root/"runtime/tmp") as temp:
        stage=Path(temp)
        with tarfile.open(archive) as tar:
            members=tar.getmembers()
            if sorted(m.name for m in members)!=sorted(modules) or any(not m.isfile() for m in members): raise RuntimeError("scoring_archive_members_invalid")
            tar.extractall(stage)
        if any(hashlib.sha256((stage/name).read_bytes()).hexdigest()!=v["hashes"][name] for name in modules): raise RuntimeError("scoring_module_hash_invalid")
        backup.mkdir(mode=0o700)
        for p in targets: shutil.copy2(p,backup/p.name)
        if metadata.is_file(): shutil.copy2(metadata,backup/"scoring-release.json")
        state_file.write_text(json.dumps({"protected":before,"python_pids":pids,"hashes":v["hashes"]}))
        temporaries=[]
        try:
            for p in targets:
                tmp=p.with_name(p.name+".scoring-upload")
                if tmp.exists() or tmp.is_symlink(): raise RuntimeError("scoring_temporary_collision")
                temporaries.append(tmp)
                shutil.copy2(stage/p.name,tmp);os.chmod(tmp,0o644);os.replace(tmp,p)
            if protected()!=before or python_pids()!=pids: raise RuntimeError("scoring_protected_changed")
        except Exception:
            for p in targets: shutil.copy2(backup/p.name,p)
            for tmp in temporaries:
                if tmp.exists() and not tmp.is_symlink(): tmp.unlink()
            raise
elif v["action"]=="rollback":
    if not state_file.is_file() or backup.is_symlink(): raise RuntimeError("scoring_rollback_missing")
    for p in targets:
        if not (backup/p.name).is_file(): raise RuntimeError("scoring_rollback_file_missing")
    for p in targets: shutil.copy2(backup/p.name,p)
    if (backup/"scoring-release.json").is_file(): shutil.copy2(backup/"scoring-release.json",metadata)
    elif metadata.exists(): metadata.unlink()
elif v["action"]=="verify":
    state=json.loads(state_file.read_text())
    if protected()!=state["protected"] or python_pids()!=state["python_pids"]: raise RuntimeError("scoring_protected_changed")
    if any(hashlib.sha256(p.read_bytes()).hexdigest()!=state["hashes"][p.name] for p in targets): raise RuntimeError("scoring_readback_mismatch")
    metadata.write_text(json.dumps({"sha":v["sha"],"modules":state["hashes"]}))
else: raise RuntimeError("scoring_action_invalid")
print("SCOUTOPS_RESULT="+json.dumps({"status":True,"action":v["action"],"sha":v["sha"],"python_unchanged":True,"backup":str(backup)}))
'''.replace("PAYLOAD", repr(json.dumps(values, ensure_ascii=False)))


def deploy_scoring(api, repo: Path, identity: dict) -> None:
    sha = identity["local_sha"]
    subprocess.run([api.local_npm_executable(), "run", "build:worker"], cwd=repo, check=True)
    with tempfile.TemporaryDirectory(prefix="scoutops-scoring-") as temp:
        archive = Path(temp)/"scoring.tar.gz"
        files = [repo/"apps/worker/dist"/name for name in MODULES]
        hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
        with tarfile.open(archive,"w:gz") as tar:
            for p in files: tar.add(p,arcname=p.name,recursive=False)
        client=api.paramiko.SSHClient()
        client.set_missing_host_key_policy(api.paramiko.RejectPolicy())
        client.load_host_keys(str(Path.home()/".ssh/known_hosts"))
        client.connect(api.HOST,username=api.SSH_USER,password=api.read_windows_credential(),timeout=15)
        owner=str(uuid4()); locked=False; applied=False
        name="scoring-"+sha+"-"+owner+".tar.gz"
        values={"sha":sha,"action":"apply","archive_name":name,"archive_hash":hashlib.sha256(archive.read_bytes()).hexdigest(),"hashes":hashes}
        restart=f"{api.PANEL_PYTHON} /www/server/panel/script/restart_project.py nodejs ai选品"
        try:
            api.remote_python(client,api.deployment_lock_source(owner),timeout=30);locked=True
            current=api.remote_python(client,api.production_identity_source(),timeout=30)
            api.verify_production_sha_history(repo,current["build_sha"],sha)
            changes=api.run(["git","diff","--name-only",current["build_sha"],sha],repo).splitlines()
            allowed=("apps/web/","docs/","tests/","scripts/","new-product-enterprise-blueprint.md")
            runtime={"apps/worker/src/automatic-selection-evaluation.ts","apps/worker/src/automatic-selection-evaluation-worker.ts"}
            if any(p not in runtime and not p.startswith(allowed) for p in changes): raise RuntimeError("scoring_unrelated_runtime_change")
            api.remote_python(client, "import json\nfrom pathlib import Path\nr=Path('/www/wwwroot/ai选品')\nassert r.resolve()==r and not r.is_symlink()\nassert all((r/p).is_dir() and (r/p).resolve()==r/p for p in ('runtime','runtime/tmp','backups','backend'))\nprint('SCOUTOPS_RESULT='+json.dumps({'status':True}))",timeout=30)
            with client.open_sftp() as sftp: sftp.put(str(archive),f"{api.PROJECT_ROOT}/runtime/tmp/{name}")
            api.remote_python(client,scoring_remote_source(values),timeout=90);applied=True
            api.ssh_exec(client,restart,timeout=120)
            api.verify_public(current["build_sha"])
            result=api.remote_python(client,scoring_remote_source({**values,"action":"verify"}),timeout=90)
            receipt=repo/".artifacts/verification/scoring-only-production-evidence.json"
            receipt.parent.mkdir(parents=True,exist_ok=True)
            receipt.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
            print(json.dumps(result,ensure_ascii=False))
        except Exception:
            if applied:
                api.remote_python(client,scoring_remote_source({**values,"action":"rollback"}),timeout=90)
                api.ssh_exec(client,restart,timeout=120)
            raise
        finally:
            try:
                api.remote_python(client,f"import json\nfrom pathlib import Path\np=Path({(api.PROJECT_ROOT+'/runtime/tmp/'+name)!r})\nif p.exists() and not p.is_symlink(): p.unlink()\nprint('SCOUTOPS_RESULT='+json.dumps({{'status':True}}))",timeout=30)
                if locked: api.remote_python(client,api.deployment_lock_source(owner,True),timeout=30)
            finally: client.close()
