"""Build locally and deploy ScoutOps into the fixed BaoTa-managed layout.

The script is deliberately bound to this project's production objects. It never
runs Git or a source build on the server and never enumerates or mutates another
project directory.
"""

from __future__ import annotations

import argparse
import base64
import ctypes
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
import time
import urllib.request
from ctypes import wintypes
from pathlib import Path

import paramiko


HOST = "192.168.1.220"
SSH_USER = "root"
CREDENTIAL_TARGET = "ssh@192.168.1.220:22/root"
PROJECT_ROOT = "/www/wwwroot/ai选品"
SITE_ID = 29
SITE_NAME = "midouai.mozhiz.cn"
NODE_PROJECT = "ai选品"
PYTHON_PROJECT = "ai选品-python"
NODE_VERSION = "v20.19.6"
NODE_BIN = f"/www/server/nodejs/{NODE_VERSION}/bin/node"
NPM_BIN = f"/www/server/nodejs/{NODE_VERSION}/bin/npm"
PYTHON_BIN = "/www/server/pyporject_evn/versions/3.12.13/bin/python3.12"
PANEL_PYTHON = "/www/server/panel/pyenv/bin/python"
PUBLIC_BASE_URL = "https://midouai.mozhiz.cn"
NODE_START_COMMAND = (
    f"node --env-file={PROJECT_ROOT}/config/product_scout.env "
    f"--env-file={PROJECT_ROOT}/config/release.env apps/backend/dist/server.js"
)


class CredentialAttribute(ctypes.Structure):
    _fields_ = [
        ("Keyword", wintypes.LPWSTR),
        ("Flags", wintypes.DWORD),
        ("ValueSize", wintypes.DWORD),
        ("Value", ctypes.POINTER(ctypes.c_ubyte)),
    ]


class Credential(ctypes.Structure):
    _fields_ = [
        ("Flags", wintypes.DWORD),
        ("Type", wintypes.DWORD),
        ("TargetName", wintypes.LPWSTR),
        ("Comment", wintypes.LPWSTR),
        ("LastWritten", wintypes.FILETIME),
        ("CredentialBlobSize", wintypes.DWORD),
        ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
        ("Persist", wintypes.DWORD),
        ("AttributeCount", wintypes.DWORD),
        ("Attributes", ctypes.POINTER(CredentialAttribute)),
        ("TargetAlias", wintypes.LPWSTR),
        ("UserName", wintypes.LPWSTR),
    ]


def run(command: list[str], cwd: Path) -> str:
    completed = subprocess.run(command, cwd=cwd, check=True, text=True, capture_output=True)
    return completed.stdout.strip()


def read_windows_credential() -> str:
    if os.name != "nt":
        raise RuntimeError("deployment credential is available only from Windows Credential Manager")
    pointer = ctypes.POINTER(Credential)()
    if not ctypes.windll.advapi32.CredReadW(CREDENTIAL_TARGET, 1, 0, ctypes.byref(pointer)):
        raise RuntimeError(f"Windows credential not found: {CREDENTIAL_TARGET}")
    try:
        item = pointer.contents
        raw = ctypes.string_at(item.CredentialBlob, item.CredentialBlobSize)
    finally:
        ctypes.windll.advapi32.CredFree(pointer)
    try:
        return raw.decode("utf-16-le")
    except UnicodeDecodeError:
        return raw.decode("utf-8")


def copy_tree(source: Path, target: Path) -> None:
    if not source.is_dir():
        raise RuntimeError(f"required build directory is missing: {source}")
    shutil.copytree(source, target, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo"))


def build_package(repo: Path, build_sha: str, skip_build: bool, temp_root: Path) -> Path:
    if not skip_build:
        subprocess.run(["npm", "run", "build"], cwd=repo, check=True)

    package_root = temp_root / "package"
    frontend = package_root / "frontend"
    backend = package_root / "backend"
    python = package_root / "python"
    package_root.mkdir(parents=True)
    backend.mkdir(parents=True)

    copy_tree(repo / "apps/web/dist", frontend)
    shutil.copy2(repo / "package.json", backend / "package.json")
    shutil.copy2(repo / "package-lock.json", backend / "package-lock.json")

    for group in ("apps", "packages"):
        for package_json in sorted((repo / group).glob("*/package.json")):
            relative_dir = package_json.parent.relative_to(repo)
            target_dir = backend / relative_dir
            target_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(package_json, target_dir / "package.json")
            dist = package_json.parent / "dist"
            if dist.is_dir():
                copy_tree(dist, target_dir / "dist")

    script_target = backend / "scripts"
    script_target.mkdir()
    shutil.copy2(repo / "scripts/run-playwright-crawler.mjs", script_target)

    migrations = repo / "database/migrations"
    if migrations.is_dir():
        copy_tree(migrations, backend / "database/migrations")

    copy_tree(repo / "apps/crawler/scoutops_crawler", python / "scoutops_crawler")
    shutil.copy2(repo / "apps/crawler/pyproject.toml", python / "pyproject.toml")

    release = package_root / "release.env"
    version = json.loads((repo / "package.json").read_text(encoding="utf-8"))["version"]
    release.write_text(f"BUILD_SHA={build_sha}\nAPP_VERSION={version}\n", encoding="utf-8", newline="\n")

    archive = temp_root / f"scoutops-{build_sha}.tar.gz"
    with tarfile.open(archive, "w:gz") as tar:
        for child in sorted(package_root.iterdir()):
            tar.add(child, arcname=child.name, recursive=True)
    return archive


def ssh_exec(client: paramiko.SSHClient, command: str, timeout: int = 120) -> str:
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    output = stdout.read().decode("utf-8", "replace")
    error = stderr.read().decode("utf-8", "replace")
    status = stdout.channel.recv_exit_status()
    if status != 0:
        raise RuntimeError(f"remote command failed ({status}): {error.strip() or output.strip()}")
    return output.strip()


def remote_python(client: paramiko.SSHClient, source: str, timeout: int = 120) -> dict:
    encoded = base64.b64encode(source.encode("utf-8")).decode("ascii")
    command = f"{PANEL_PYTHON} -c \"import base64;exec(base64.b64decode('{encoded}'))\""
    output = ssh_exec(client, command, timeout=timeout)
    line = next((value for value in reversed(output.splitlines()) if value.startswith("SCOUTOPS_RESULT=")), "")
    if not line:
        raise RuntimeError(f"BaoTa helper returned no structured result: {output[-1200:]}")
    result = json.loads(line.removeprefix("SCOUTOPS_RESULT="))
    if not result.get("status"):
        raise RuntimeError(f"BaoTa helper failed: {result.get('message', 'unknown error')}")
    return result


def panel_deploy_source(build_sha: str, initialize_layout: bool) -> str:
    values = {
        "root": PROJECT_ROOT,
        "site_id": SITE_ID,
        "site_name": SITE_NAME,
        "node_project": NODE_PROJECT,
        "python_project": PYTHON_PROJECT,
        "node_version": NODE_VERSION,
        "python_bin": PYTHON_BIN,
        "node_start": NODE_START_COMMAND,
        "build_sha": build_sha,
        "initialize": initialize_layout,
    }
    payload = json.dumps(values, ensure_ascii=False)
    return f'''import json, os, shutil, sys, traceback
from pathlib import Path
sys.path.insert(0, "/www/server/panel")
import public
import panelSite
from projectModel.nodejsModel import main as NodeModel
from projectModel.pythonModel import main as PythonModel

v = json.loads({payload!r})
root = Path(v["root"])
allowed = {{"frontend", "backend", "python", "config", "runtime", "backups"}}
stage = root / (".deploy-stage-" + v["build_sha"])
rollback = root / (".deploy-rollback-" + v["build_sha"])

def result(status, message, **extra):
    print("SCOUTOPS_RESULT=" + json.dumps({{"status": status, "message": message, **extra}}, ensure_ascii=False))

def panel_ok(response, operation, allow_messages=()):
    if isinstance(response, dict) and response.get("status"):
        return
    text = json.dumps(response, ensure_ascii=False)
    if any(item in text for item in allow_messages):
        return
    raise RuntimeError(operation + " failed: " + text)

def ensure_inside(path):
    resolved = path.resolve(strict=False)
    if resolved == root or root not in resolved.parents:
        raise RuntimeError("path escaped project root: " + str(path))

try:
    if str(root) != "/www/wwwroot/ai选品" or not root.is_dir():
        raise RuntimeError("unexpected project root")
    if not stage.is_dir():
        raise RuntimeError("uploaded stage is missing")
    for name in ("frontend", "backend", "python"):
        if not (stage / name).is_dir():
            raise RuntimeError("stage component missing: " + name)
    if not (stage / "release.env").is_file():
        raise RuntimeError("release identity is missing")
    if not Path(v["python_bin"]).is_file():
        raise RuntimeError("BaoTa Python 3.12.13 is unavailable")

    site = public.M("sites").where("id=?", (v["site_id"],)).find()
    if not site or site.get("name") != v["site_name"] or site.get("project_type") not in ("PHP", "HTML"):
        raise RuntimeError("website identity mismatch")
    node_row = public.M("sites").where("name=?", (v["node_project"],)).find()
    if not node_row or node_row.get("project_type") != "Node":
        raise RuntimeError("Node project identity mismatch")
    python_row = public.M("sites").where("name=?", (v["python_project"],)).find()
    if python_row and (python_row.get("project_type") != "Python" or python_row.get("path") != str(root / "python")):
        raise RuntimeError("Python project identity or path mismatch")

    if v["initialize"]:
        current = root / "current"
        releases = root / "releases"
        if current.exists() or current.is_symlink():
            resolved = current.resolve(strict=True)
            if releases.resolve(strict=True) not in resolved.parents:
                raise RuntimeError("current does not point inside this project's releases")
        shared = root / "shared"
        if shared.is_dir():
            unexpected = {{child.name for child in shared.iterdir()}} - {{"backups", "config", "credential-tmp", "evidence", "exports", "npm-cache", "tmp", "verification"}}
            if unexpected:
                raise RuntimeError("shared contains unrecognized entries: " + ",".join(sorted(unexpected)))
    else:
        for name in allowed:
            if not (root / name).exists():
                raise RuntimeError("fixed layout is incomplete; run --initialize-layout")

    node = NodeModel()
    python_model = PythonModel()
    stop_get = public.dict_obj(); stop_get.project_name = v["node_project"]
    panel_ok(node.stop_project(stop_get), "stop Node", ("项目未启动",))
    if python_row:
        python_stop = public.dict_obj(); python_stop.name = v["python_project"]
        panel_ok(python_model.StopProject(python_stop), "stop Python", ("项目停止失败", "项目未启动"))

    if rollback.exists():
        shutil.rmtree(rollback)
    rollback.mkdir(mode=0o750)
    for name in ("frontend", "backend", "python"):
        target = root / name
        ensure_inside(target)
        if target.exists():
            target.rename(rollback / name)
        (stage / name).rename(target)

    config = root / "config"
    runtime = root / "runtime"
    backups = root / "backups"
    shared = root / "shared"
    if not config.exists() and (shared / "config").is_dir():
        (shared / "config").rename(config)
    config.mkdir(mode=0o750, exist_ok=True)
    env_file = config / "product_scout.env"
    if not env_file.is_file():
        raise RuntimeError("restricted product_scout.env is missing")
    old_env = env_file.read_text(encoding="utf-8")
    replacements = {{
        str(root / "shared/evidence"): str(root / "runtime/evidence"),
        str(root / "shared/exports"): str(root / "runtime/exports"),
        str(root / "shared/credential-tmp"): str(root / "runtime/credential-tmp"),
        str(root / "shared/tmp"): str(root / "runtime/tmp"),
        str(root / "shared/verification"): str(root / "runtime/verification"),
        str(root / "current/scripts/run-playwright-crawler.mjs"): str(root / "backend/scripts/run-playwright-crawler.mjs"),
    }}
    new_env = old_env
    for old, new in replacements.items():
        new_env = new_env.replace(old, new)
    env_file.write_text(new_env, encoding="utf-8")
    os.chmod(env_file, 0o640)
    (stage / "release.env").replace(config / "release.env")
    os.chmod(config / "release.env", 0o640)
    legacy_launcher = config / "start-backend.sh"
    if legacy_launcher.exists():
        legacy_launcher.unlink()

    runtime.mkdir(mode=0o750, exist_ok=True)
    backups.mkdir(mode=0o750, exist_ok=True)
    for name in ("evidence", "exports", "credential-tmp", "tmp", "verification"):
        destination = runtime / name
        source = shared / name
        if not destination.exists() and source.is_dir():
            source.rename(destination)
        destination.mkdir(mode=0o750, exist_ok=True)
    source_backups = shared / "backups"
    if source_backups.is_dir():
        for child in source_backups.iterdir():
            destination = backups / child.name
            if destination.exists():
                raise RuntimeError("backup name collision: " + child.name)
            child.rename(destination)

    site_get = public.dict_obj(); site_get.id = str(v["site_id"]); site_get.path = str(root / "frontend")
    if site.get("path") != str(root / "frontend"):
        panel_ok(panelSite.panelSite().SetPath(site_get), "update website path")

    node_get = public.dict_obj()
    node_get.project_name = v["node_project"]
    node_get.project_cwd = str(root / "backend")
    node_get.project_script = v["node_start"]
    node_get.project_ps = "ScoutOps 统一 Node API + Worker"
    node_get.is_power_on = 1
    node_get.run_user = "www"
    node_get.max_memory_limit = 2048
    node_get.nodejs_version = v["node_version"]
    node_get.pkg_manager = "npm"
    node_get.port = 4101
    panel_ok(node.modify_project(node_get), "update Node project")
    start_get = public.dict_obj(); start_get.project_name = v["node_project"]
    panel_ok(node.start_project(start_get), "start Node")

    if not python_row:
        create = public.dict_obj()
        create.pjname = v["python_project"]
        create.port = ""
        create.stype = "command"
        create.path = str(root / "python")
        create.python_bin = v["python_bin"]
        create.user = "www"
        create.requirement_path = ""
        create.env_list = []
        create.env_file = str(env_file)
        create.framework = "python"
        create.project_cmd = "python -m scoutops_crawler"
        create.auto_run = True
        create.logpath = "/www/wwwlogs/python/ai选品-python"
        panel_ok(python_model.CreateProject(create), "create Python project")
    else:
        restart = public.dict_obj(); restart.name = v["python_project"]
        panel_ok(python_model.RestartProject(restart), "restart Python project")

    shutil.rmtree(stage)
    result(True, "deployed", node_path=str(root / "backend"), python_path=str(root / "python"))
except Exception as error:
    result(False, str(error))
'''


def cleanup_source(build_sha: str, initialize_layout: bool) -> str:
    values = json.dumps({"root": PROJECT_ROOT, "sha": build_sha, "initialize": initialize_layout}, ensure_ascii=False)
    return f'''import json, shutil
from pathlib import Path
v=json.loads({values!r}); root=Path(v["root"])
if str(root)!="/www/wwwroot/ai选品" or not root.is_dir(): raise SystemExit("unexpected root")
targets=[root/(".deploy-rollback-"+v["sha"])]
if v["initialize"]: targets += [root/"current", root/"releases", root/"shared"]
for target in targets:
    resolved=target.resolve(strict=False)
    if resolved==root or root not in resolved.parents: raise SystemExit("unsafe cleanup target")
    if target.is_symlink(): target.unlink()
    elif target.is_dir(): shutil.rmtree(target)
    elif target.exists(): target.unlink()
print("SCOUTOPS_RESULT="+json.dumps({{"status":True,"message":"cleanup complete"}}))
'''


def verify_public(build_sha: str) -> None:
    deadline = time.time() + 90
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{PUBLIC_BASE_URL}/api/v1/health/ready", timeout=10) as response:
                ready = json.load(response)
            with urllib.request.urlopen(f"{PUBLIC_BASE_URL}/api/v1/health/version", timeout=10) as response:
                version = json.load(response)
            if response.status == 200 and version.get("data", {}).get("build_sha") == build_sha:
                if ready.get("data", {}).get("status") in ("ready", "healthy"):
                    return
                if ready.get("status") in ("ready", "healthy"):
                    return
                # A 200 ready response is the authoritative readiness signal.
                return
        except Exception as error:  # noqa: BLE001 - retain latest health failure for handoff
            last_error = error
        time.sleep(3)
    raise RuntimeError(f"production health did not reach build {build_sha}: {last_error}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy this repository to its fixed BaoTa layout")
    parser.add_argument("--initialize-layout", action="store_true", help="migrate and delete legacy current/releases/shared")
    parser.add_argument("--skip-build", action="store_true", help="reuse existing local dist outputs")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[1]
    if run(["git", "status", "--porcelain"], repo):
        raise RuntimeError("Git worktree must be clean before production deployment")
    build_sha = run(["git", "rev-parse", "HEAD"], repo)
    if len(build_sha) != 40:
        raise RuntimeError("full Git build identity is unavailable")

    with tempfile.TemporaryDirectory(prefix="scoutops-deploy-") as temp:
        archive = build_package(repo, build_sha, args.skip_build, Path(temp))
        password = read_windows_credential()
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        known_hosts = Path.home() / ".ssh/known_hosts"
        if known_hosts.is_file():
            client.load_host_keys(str(known_hosts))
        else:
            raise RuntimeError("SSH known_hosts is missing; refusing an unverified server identity")
        client.connect(HOST, username=SSH_USER, password=password, timeout=15)
        remote_archive = f"{PROJECT_ROOT}/.deploy-upload-{build_sha}.tar.gz"
        remote_stage = f"{PROJECT_ROOT}/.deploy-stage-{build_sha}"
        try:
            sftp = client.open_sftp()
            sftp.put(str(archive), remote_archive)
            sftp.close()
            extract = (
                f"test \"$(readlink -f '{PROJECT_ROOT}')\" = '{PROJECT_ROOT}' && "
                f"mkdir -p '{remote_stage}' && "
                f"{PANEL_PYTHON} -c \"import tarfile; "
                f"t=tarfile.open('{remote_archive}'); "
                f"assert all(not m.name.startswith('/') and '..' not in m.name.split('/') for m in t.getmembers()); "
                f"t.extractall('{remote_stage}')\" && "
                f"cd '{remote_stage}/backend' && "
                f"PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 PATH='/www/server/nodejs/{NODE_VERSION}/bin':$PATH "
                f"'{NPM_BIN}' ci --omit=dev"
            )
            ssh_exec(client, extract, timeout=600)
            remote_python(client, panel_deploy_source(build_sha, args.initialize_layout), timeout=300)
            client.close()
            verify_public(build_sha)

            client.connect(HOST, username=SSH_USER, password=password, timeout=15)
            remote_python(client, cleanup_source(build_sha, args.initialize_layout), timeout=180)
            ssh_exec(client, f"rm -f '{remote_archive}'", timeout=30)
        finally:
            client.close()

    print(json.dumps({
        "status": "deployed",
        "build_sha": build_sha,
        "website": f"{PROJECT_ROOT}/frontend",
        "node": f"{PROJECT_ROOT}/backend",
        "python": f"{PROJECT_ROOT}/python",
        "temporary_artifacts": "deleted",
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
