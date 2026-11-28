"""Static-only release under the account coordinator's project lock."""

import hashlib
import json
import re
import subprocess
import tarfile
import tempfile
from pathlib import Path
from uuid import uuid4

STABLE = {"favicon.svg", "midou-logo.jpg", "lucide-LICENSE.txt",
          "browser-helper/scoutops-browser-helper.zip"}


def allowed(name):
    return (name in STABLE or name == "index.html" or
            re.fullmatch(r"assets/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+", name))


def read_bundle(data):
    import io
    files = {}
    total = 0
    with tarfile.open(fileobj=io.BytesIO(data)) as tar:
        for m in tar:
            total += m.size
            if (not m.isfile() or not allowed(m.name) or m.name in STABLE or
                    m.name in files or total > 64 * 1024 * 1024):
                raise RuntimeError("frontend_invalid_asset")
            files[m.name] = tar.extractfile(m).read()
    refs = re.findall(rb'(?:src|href)="/(assets/[^"]+)"', files.get("index.html", b""))
    if not refs or not all(ref.decode() in files for ref in refs):
        raise RuntimeError("frontend_index_asset_missing")
    return files, [ref.decode() for ref in refs]


def install(root, uploaded, digest, build, previous, panel, check_public, required_node=None):
    import fcntl
    import os
    import stat

    front = root / "frontend"
    for p in (root, front, root / "config", root / "runtime", root / "runtime/tmp", front / "assets"):
        if not p.is_dir() or p.resolve(strict=True) != p:
            raise RuntimeError("frontend_unsafe_path")
    for p in (root, root / "config"):
        if p.stat().st_uid != os.geteuid() or p.stat().st_mode & 0o022:
            raise RuntimeError("frontend_untrusted_root")
    lock = root / "config/account-release.lock"
    fd = os.open(lock, os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "r+b") as handle:
        s = os.fstat(handle.fileno())
        if not stat.S_ISREG(s.st_mode) or s.st_uid != os.geteuid() or s.st_nlink != 1 or s.st_mode & 0o077:
            raise RuntimeError("frontend_unsafe_lock")
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = root / "config/account-release-state.json"
        if not state.is_file() or state.is_symlink() or state.stat().st_size > 65536:
            raise RuntimeError("frontend_unverified_account_release")
        last = json.loads(state.read_bytes().splitlines()[-1])
        if last.get("phase") != "runtime_ready" or last.get("build_sha") != previous:
            raise RuntimeError("frontend_runtime_not_ready")
        site = panel.M("sites").where("id=?", (29,)).find()
        if (site.get("name"), site.get("path")) != ("midouai.medouai.com", str(front)):
            raise RuntimeError("frontend_wrong_site")
        live_env = root / "config/release.env"
        before = hashlib.sha256(live_env.read_bytes()).hexdigest()
        lines = live_env.read_text(encoding="utf8").splitlines()
        if not all(x in lines for x in ("BUILD_SHA=" + previous, "ACCOUNT_SCOPE_MODE=retired",
                                         "RELEASE_SOURCE_MIGRATION_VERSION=0197_retire_tenancy_roots.up.sql")):
            raise RuntimeError("frontend_runtime_identity_changed")
        if required_node is not None:
            for name, expected in required_node.items():
                path = root / "backend" / name
                if (path.resolve(strict=True) != path or not path.is_file() or path.stat().st_size > 131072
                        or hashlib.sha256(path.read_bytes()).hexdigest() != expected):
                    raise RuntimeError("frontend_required_node_overlay_missing")
        def check_release(index=None, assets=None):
            if required_node is None:
                return check_public(previous, index, assets)
            return check_public(previous, index, assets, scheduler=root / "runtime/worker-scheduler.json")

        check_release()
        if uploaded.parent != root / "runtime/tmp" or uploaded.is_symlink() or not uploaded.is_file():
            raise RuntimeError("frontend_wrong_upload")
        if not 0 < uploaded.stat().st_size < 32 * 1024 * 1024:
            raise RuntimeError("frontend_upload_size_invalid")
        data = uploaded.read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            raise RuntimeError("frontend_upload_digest_changed")
        files, refs = read_bundle(data)
        for name, content in files.items():
            target = front / name
            if target.resolve().parent != front / Path(name).parent or target.is_symlink():
                raise RuntimeError("frontend_target_invalid")
            if name != "index.html" and target.exists():
                if not target.is_file() or target.read_bytes() != content:
                    raise RuntimeError("frontend_existing_asset_differs:" + name)

        def publish(path, content):
            fd, name = tempfile.mkstemp(prefix=".static-upload-", dir=path.parent)
            try:
                with os.fdopen(fd, "wb") as stream:
                    stream.write(content)
                    stream.flush()
                    os.fchmod(stream.fileno(), 0o644)
                    os.fsync(stream.fileno())
                os.replace(name, path)
            finally:
                if os.path.exists(name):
                    os.unlink(name)

        for name, content in files.items():
            target = front / name
            if name != "index.html" and not target.exists():
                publish(target, content)
        if any((front / n).read_bytes() != b for n, b in files.items() if n != "index.html"):
            raise RuntimeError("frontend_asset_readback_failed")
        index = files["index.html"]
        publish(front / "index.html", index)
        check_release(index, {n: files[n] for n in refs})
        if hashlib.sha256(live_env.read_bytes()).hexdigest() != before:
            raise RuntimeError("frontend_runtime_changed")
        return {"status": True, "frontend_sha": build, "runtime_sha": previous,
                "index_sha256": hashlib.sha256(index).hexdigest(), "verified_assets": len(files) - 1}


def expected_scheduler_backpressure(path, now):
    from datetime import datetime

    try:
        if path.resolve(strict=True) != path or not path.is_file() or path.stat().st_size > 262144:
            return False
        snap = json.loads(path.read_bytes())
        observed = datetime.fromisoformat(snap["observed_at"].replace("Z", "+00:00"))
        if not 0 <= (now - observed).total_seconds() <= 20:
            return False
        if not (snap["status"] == "running" and snap["backpressure"] is True
                and snap["suspected_stuck_runs"] == 0 and snap["failed_last_minute"] == 0
                and snap["snapshot_publish_failed_total"] == 0):
            return False
        for q in snap["queues"]:
            if q.get("circuit_state") == "open":
                return False
            if q.get("last_result_error_code") and q.get("last_result_status") not in ("waiting_evidence", "waiting_profit"):
                result_at = datetime.fromisoformat(q["last_result_at"].replace("Z", "+00:00"))
                if 0 <= (now - result_at).total_seconds() <= 60:
                    return False
        return True
    except (OSError, KeyError, TypeError, ValueError, AttributeError):
        return False


def remote_check(expected, index=None, assets=None, scheduler=None):
    from datetime import datetime, timezone
    import time
    import urllib.error
    import urllib.request
    base = "https://midouai.medouai.com"

    def get(path):
        return urllib.request.urlopen(base + path, timeout=12)

    for name, field, value in (("version", "build_sha", expected), ("ready", "status", "ready")):
        with get("/api/v1/health/" + name) as reply:
            if json.load(reply)["data"].get(field) != value:
                raise RuntimeError("frontend_runtime_health_failed:" + name)
    for attempt in range(5):
        with get("/api/v1/health/available") as reply:
            availability = json.load(reply)["data"]
        if availability.get("status") == "available":
            break
        services = availability.get("services", {})
        if (availability.get("status") != "degraded" or
                any(services.get(name) != "available" for name in ("api", "worker"))):
            raise RuntimeError("frontend_runtime_health_failed:available")
        if scheduler is not None and expected_scheduler_backpressure(scheduler, datetime.now(timezone.utc)):
            break
        if attempt == 4:
            raise RuntimeError("frontend_runtime_health_failed:available")
        time.sleep(2)
    if index is not None:
        query = "?ui_check=" + hashlib.sha256(index).hexdigest()[:20]
        for path in ("/login", "/home", "/opportunities"):
            with get(path + query) as reply:
                if reply.read() != index:
                    raise RuntimeError("frontend_public_index_differs:" + path)
        for path, content in assets.items():
            with get("/" + path + query) as reply:
                if reply.read() != content:
                    raise RuntimeError("frontend_public_asset_differs:" + path)
        for path in ("/select-context", "/org-admin/workspaces", "/platform-admin/organizations"):
            try:
                get(path).close()
            except urllib.error.HTTPError as error:
                if error.code == 404:
                    continue
                raise
            raise RuntimeError("frontend_retired_page_visible:" + path)



def required_collection_modules(collection):
    # Exact installed chain only; an older engine or any module drift fails closed.
    return {**collection["COLLECTION_CANDIDATE"],
            collection["COLLECTION_EXECUTOR"]: collection["COLLECTION_EXECUTOR_LOCK_CANDIDATE"],
            collection["COLLECTION_BROWSER"]: collection["COLLECTION_BROWSER_CANDIDATE"],
            **collection["COLLECTION_EVIDENCE_CANDIDATE"], **collection["COLLECTION_RANK_CANDIDATE"],
            **collection["COLLECTION_LAN_CANDIDATE"], **collection["COLLECTION_LAN_HEALTH_CANDIDATE"],
            **collection["COLLECTION_MODEL_HOLD_CANDIDATE"], **collection["COLLECTION_DAILY_CANDIDATE"], **collection["COLLECTION_HANDOFF_CANDIDATE"], **collection["COLLECTION_HANDOFF_ROUTES_CANDIDATE"], **collection["COLLECTION_MANUAL_WAF_CANDIDATE"], **collection["COLLECTION_DELIVERY_OBSERVE_CANDIDATE"], **collection["COLLECTION_DELIVERY_READY_CANDIDATE"], **collection["COLLECTION_SEARCH_READY_CANDIDATE"], **collection["COLLECTION_RELATION_KEY_CANDIDATE"], **collection["COLLECTION_SPONSORED_EMPTY_CANDIDATE"], **collection["COLLECTION_CHECKPOINT_CANDIDATE"], **collection["COLLECTION_DUAL_HEALTH_CANDIDATE"], **collection["COLLECTION_MAINTENANCE_CANDIDATE"], **collection["COLLECTION_MANUAL_FRAME_CANDIDATE"]}

def deploy_static(repo, previous, deploy, ssh_connection, transfer, collection=None):
    if not re.fullmatch(r"[a-f0-9]{40}", previous or ""):
        raise RuntimeError("frontend_expected_runtime_sha_required")

    def git(*args):
        return subprocess.check_output(["git", *args], cwd=repo).decode().strip()

    build = git("rev-parse", "HEAD")
    if (git("status", "--porcelain") or deploy["normalize_github_repository"](git("remote", "get-url", "origin")).lower()
            != deploy["EXPECTED_GITHUB_REPOSITORY"].lower() or
            git("ls-remote", "--exit-code", "origin", "refs/heads/main") != build + "\trefs/heads/main"):
        raise RuntimeError("frontend_requires_clean_approved_main_sha")
    deploy["verify_production_sha_history"](repo, previous, build)
    required_node = None
    if collection is not None and "administrator_cookie" in collection:
        collection["validate"](git("diff", "--name-only", collection["source_base"], build).splitlines())
        required_node = collection["administrator_cookie"]
    elif collection is not None:
        source_base = collection["COLLECTION_SOURCE_BASE"]
        deploy["verify_production_sha_history"](repo, source_base, build)
        collection["validate_collection_changes"](git("diff", "--name-only", source_base, build).splitlines())
        required_node = required_collection_modules(collection)
    else:
        changed = git("diff", "--name-only", previous, build).splitlines()
        tooling = {"scripts/deploy-account-baota.py", "scripts/baota-account-static-release.py"}
        if (not any(p.startswith("apps/web/src/") for p in changed) or
                any(not p.startswith(("apps/web/src/", "docs/", "tests/")) and p not in tooling for p in changed)):
            raise RuntimeError("frontend_contains_non_static_changes")
    subprocess.run([deploy["local_npm_executable"](), "run", "build:web"], cwd=repo, check=True)
    if git("rev-parse", "HEAD") != build or git("status", "--porcelain"):
        raise RuntimeError("frontend_source_changed_during_build")
    dist = repo / "apps/web/dist"
    with tempfile.TemporaryDirectory(prefix="scoutops-static-") as tmp:
        archive = Path(tmp) / "frontend.tar.gz"
        with tarfile.open(archive, "w:gz") as tar:
            for path in sorted(dist.rglob("*")):
                if path.is_symlink():
                    raise RuntimeError("frontend_dist_symlink")
                if path.is_file():
                    name = path.relative_to(dist).as_posix()
                    if not allowed(name):
                        raise RuntimeError("frontend_dist_unexpected:" + name)
                    if name not in STABLE:
                        tar.add(path, arcname=name, recursive=False)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        root = deploy["PROJECT_ROOT"]
        name = "scoutops-static-" + uuid4().hex + ".tar.gz"
        upload = root + "/runtime/tmp/" + name
        owned = False

        def own_upload():
            nonlocal owned
            owned = True

        with ssh_connection(deploy) as ssh:
            preflight = "from pathlib import Path\nimport json\np=Path(" + repr(root + "/runtime/tmp") + ")\n" \
                "assert p.is_dir() and p.resolve(strict=True)==p\nprint('SCOUTOPS_RESULT='+json.dumps({'status':True}))"
            deploy["remote_python"](ssh, preflight, timeout=15)
            try:
                transfer(ssh, archive, upload, own_upload)
                text = Path(__file__).read_text(encoding="utf-8")
                source = "code=" + repr(text) + "\nargs=" + repr((root, upload, digest, build, previous, required_node)) + r'''
import json,sys
from pathlib import Path
sys.path[:0]=['/www/server/panel','/www/server/panel/class']
import public
module={'__name__':'scoutops_static'}
exec(compile(code,'scoutops_static','exec'),module)
root,upload,digest,build,previous,required_node=args
result=module['install'](Path(root),Path(upload),digest,build,previous,public,module['remote_check'],required_node)
print('SCOUTOPS_RESULT='+json.dumps(result))
'''
                return deploy["remote_python"](ssh, source, timeout=120)
            finally:
                if owned:
                    cleanup = "from pathlib import Path\nimport json\np=Path(" + repr(upload) + ")\n" \
                        "assert p.parent.resolve(strict=True)==p.parent and not p.is_symlink()\n" \
                        "try: p.unlink()\nexcept FileNotFoundError: pass\n" \
                        "print('SCOUTOPS_RESULT='+json.dumps({'status':not p.exists()}))"
                    deploy["remote_python"](ssh, cleanup, timeout=20)
