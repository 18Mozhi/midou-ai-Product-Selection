"""Publish only the vetted account trend-projection Worker module."""
import base64
import hashlib
import re
import subprocess
from pathlib import Path

TARGET = "backend/apps/worker/dist/trend-projection-account-queue.js"
SOURCE = "apps/worker/src/trend-projection-account-queue.ts"
RESTART = "/www/server/panel/script/restart_project.py"
MODULE_PHASE = "not_installed"


def install(root, expected_runtime, expected_module, build, encoded, digest):
    root = Path(root)
    if root != Path("/www/wwwroot/ai选品"):
        raise RuntimeError("trend_project_mismatch")

    import fcntl
    import json
    import os
    import stat
    import sys
    import tempfile
    import time
    import urllib.request

    global MODULE_PHASE
    target = root / TARGET
    for path in (root, root / "config", root / "runtime", root / "backend", target.parent):
        if not path.is_dir() or path.resolve(strict=True) != path:
            raise RuntimeError("trend_unsafe_directory")
    for path in (root, root / "config"):
        if path.stat().st_uid != os.geteuid() or path.stat().st_mode & 0o022:
            raise RuntimeError("trend_untrusted_root")
    lock = root / "config/account-release.lock"
    fd = os.open(lock, os.O_RDWR | os.O_NONBLOCK | os.O_NOFOLLOW)
    with os.fdopen(fd, "r+b") as handle:
        info = os.fstat(handle.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid()
                or info.st_mode & 0o077 or info.st_nlink != 1):
            raise RuntimeError("trend_unsafe_lock")
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        sys.path[:0] = ["/www/server/panel", "/www/server/panel/class"]
        import public

        node = public.M("sites").where("name=?", ("ai选品",)).find()
        python = public.M("sites").where("name=?", ("ai选品-python",)).find()
        site = public.M("sites").where("id=?", (29,)).find()
        if ((node.get("project_type"), node.get("path")) != ("Node", str(root / "backend"))
                or (python.get("project_type"), python.get("path")) != ("Python", str(root / "python"))
                or (site.get("name"), site.get("path")) != ("midouai.medouai.com", str(root / "frontend"))):
            raise RuntimeError("trend_wrong_baota_objects")
        for task_id in (5, 12):
            if str(public.M("crontab").where("id=?", (task_id,)).find().get("status")) != "0":
                raise RuntimeError("trend_backup_task_not_disabled")

        def read_file(path, limit):
            st = path.lstat()
            if (not stat.S_ISREG(st.st_mode) or not 0 < st.st_size <= limit
                    or st.st_nlink != 1 or path.resolve(strict=True) != path):
                raise RuntimeError("trend_unsafe_runtime_file")
            return path.read_bytes()

        state_file = root / "config/account-release-state.json"
        state = read_file(state_file, 65536)
        last = json.loads(state.splitlines()[-1])
        protected = {
            p: read_file(p, 262144) for p in (
                root / "config/product_scout.env", root / "config/release.env",
                root / "frontend/index.html", state_file,
            )
        }
        release = protected[root / "config/release.env"].decode().splitlines()
        if (last.get("phase") != "runtime_ready" or last.get("build_sha") != expected_runtime
                or not all(v in release for v in (
                    "BUILD_SHA=" + expected_runtime, "ACCOUNT_SCOPE_MODE=retired",
                    "RELEASE_SOURCE_MIGRATION_VERSION=0197_retire_tenancy_roots.up.sql",
                ))):
            raise RuntimeError("trend_base_runtime_changed")

        def get_health(base, ep):
            with urllib.request.urlopen(base + "/api/v1/health/" + ep, timeout=4) as reply:
                return json.load(reply)["data"]

        def ready(base):
            return (get_health(base, "version").get("build_sha") == expected_runtime
                    and get_health(base, "ready").get("status") == "ready"
                    and get_health(base, "available").get("services") ==
                    {"api": "available", "worker": "available"})

        def processes():
            snap = json.loads(read_file(root / "runtime/backend-supervisor.json", 262144))
            result = {
                key: snap["processes"][key].get("pid")
                for key in ("api", "worker")
                if snap["processes"][key].get("status") == "running"
            }
            for proc in Path("/proc").iterdir():
                if not proc.name.isdecimal():
                    continue
                try:
                    cwd = Path(os.readlink(str(proc / "cwd")))
                    args = (proc / "cmdline").read_bytes().split(b"\0")[1:]
                except (FileNotFoundError, ProcessLookupError):
                    continue
                if (cwd == root / "python" or root / "python" in cwd.parents) and (
                    b"scoutops_crawler" in args or any(x.endswith(b"/scoutops_crawler/__main__.py") for x in args)
                ):
                    result.setdefault("python", []).append(int(proc.name))
            result["python"] = sorted(result.get("python", []))
            return result

        old = read_file(target, 65536)
        if hashlib.sha256(old).hexdigest() != expected_module:
            raise RuntimeError("trend_module_baseline_changed")
        incoming = base64.b64decode(encoded, validate=True)
        if (not 0 < len(incoming) < 65536 or hashlib.sha256(incoming).hexdigest() != digest
                or b"SELECT STRAIGHT_JOIN seed.task_id" not in incoming or incoming == old):
            raise RuntimeError("trend_candidate_invalid")
        local = "http://127.0.0.1:4101"
        domain = "https://midouai.medouai.com"
        pids = processes()
        if not pids.get("api") or not pids.get("worker") or not ready(local):
            raise RuntimeError("trend_baseline_not_ready")
        metadata = target.stat()
        fd, scratch = tempfile.mkstemp(prefix=".trend-release-", dir=str(target.parent))
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(incoming)
                stream.flush()
                os.fchown(stream.fileno(), metadata.st_uid, metadata.st_gid)
                os.fchmod(stream.fileno(), metadata.st_mode & 0o777)
                os.fsync(stream.fileno())
            os.replace(scratch, target)
            MODULE_PHASE = "installed"
        finally:
            if os.path.exists(scratch):
                os.unlink(scratch)
        if read_file(target, 65536) != incoming:
            raise RuntimeError("trend_module_readback_failed")

        restart = subprocess.run([sys.executable, RESTART, "nodejs", "ai选品"],
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=95)
        if restart.returncode:
            raise RuntimeError("trend_baota_restart_failed")
        MODULE_PHASE = "node_restart_returned"
        until = time.monotonic() + 75
        while time.monotonic() < until:
            try:
                after = processes()
                if (after.get("api") and after.get("worker") and after["api"] != pids["api"]
                        and after["worker"] != pids["worker"] and ready(local) and ready(domain)):
                    break
            except (OSError, KeyError, ValueError):
                pass
            time.sleep(2)
        else:
            raise RuntimeError("trend_node_not_ready_after_restart")
        if (after["python"] != pids["python"] or read_file(target, 65536) != incoming
                or any(read_file(p, 262144) != b for p, b in protected.items())):
            raise RuntimeError("trend_unexpected_runtime_change")
        return {"status": True, "overlay_sha": build, "runtime_base_sha": expected_runtime,
                "module_sha256": digest, "previous_module_sha256": expected_module,
                "restarted": "ai选品", "node_before": pids, "node_after": after}


def validate_changes(changed):
    exact = {SOURCE, "scripts/baota-account-trend-release.py", "scripts/deploy-account-baota.py",
             "scripts/baota-account-static-release.py"}
    if SOURCE not in changed or any(
        p not in exact and not p.startswith(("apps/web/src/", "docs/", "tests/")) for p in changed
    ):
        raise RuntimeError("trend_release_contains_other_runtime_changes")


def publish(repo, previous, expected_module, deploy, ssh_connection):
    if not re.fullmatch(r"[a-f0-9]{40}", previous or "") or not re.fullmatch(r"[a-f0-9]{64}", expected_module or ""):
        raise RuntimeError("trend_release_requires_expected_sha256_and_base_sha")

    def git(*args):
        return subprocess.check_output(["git", *args], cwd=repo).decode().strip()

    sha = git("rev-parse", "HEAD")
    if (git("status", "--porcelain") or deploy["normalize_github_repository"](git("remote", "get-url", "origin")).lower()
            != deploy["EXPECTED_GITHUB_REPOSITORY"].lower()
            or git("ls-remote", "--exit-code", "origin", "refs/heads/main") != sha + "\trefs/heads/main"):
        raise RuntimeError("trend_release_requires_clean_approved_main")
    deploy["verify_production_sha_history"](repo, previous, sha)
    validate_changes(git("diff", "--name-only", previous, sha).splitlines())
    subprocess.run([deploy["local_npm_executable"](), "run", "build:worker"], cwd=repo, check=True)
    if git("rev-parse", "HEAD") != sha or git("status", "--porcelain"):
        raise RuntimeError("trend_release_source_changed_during_build")
    module = (repo / TARGET.removeprefix("backend/")).read_bytes()
    args = (deploy["PROJECT_ROOT"], previous, expected_module, sha, base64.b64encode(module).decode(),
            hashlib.sha256(module).hexdigest())
    code = Path(__file__).read_text(encoding="utf-8")
    source = "code=" + repr(code) + "\nargs=" + repr(args) + r'''
import json,re
ns={"__name__":"trend_release"}
exec(compile(code,"trend_release","exec"),ns)
try:
 result=ns["install"](*args)
except Exception as exc:
 message=str(exc)
 result={"status":False,"message":ns["MODULE_PHASE"]+":"+(
     message if re.fullmatch(r"trend_[a-z_]+",message) else type(exc).__name__)}
print("SCOUTOPS_RESULT="+json.dumps(result))
'''
    with ssh_connection(deploy) as ssh:
        return deploy["remote_python"](ssh, source, timeout=205)
