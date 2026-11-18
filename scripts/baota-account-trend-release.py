"""Publish a bounded Worker module overlay through the account release coordinator."""
import base64
import hashlib
import re
import subprocess
import zlib
from pathlib import Path

TARGET = "backend/apps/worker/dist/trend-projection-account-queue.js"
SOURCE = "apps/worker/src/trend-projection-account-queue.ts"
SCHEDULER_FILES = ("queue-scheduler.js", "worker-queue-registry.js")
SCHEDULER_MARKERS = (b"this.nextPollAt", b"pollStaggerSlot")
PRE_STAGGER_SHA256 = {
    "queue-scheduler.js": "189741ab72172b40773d501bfa24c13be157fc751b2f127ca9de007980b8562d",
    "worker-queue-registry.js": "81a51e4891a38f0d040fe44ba64a393f16f467244e16921b4b16d98759178785",
}
STAGGER_RELEASE_SHA = "53e3ee64a65dd4aeaf7f83c2142cc6a7a901f54e"
REPORT_TARGET = "backend/apps/worker/dist/report-export-worker.js"
REPORT_SOURCE = "apps/worker/src/report-export-worker.ts"
REPORT_RUNTIME_BASE = "1b622274a6871d9d1ac3986223359b539a82aa76"
REPORT_SOURCE_BASE = "df30fd5b272fe1a495f9623635df8fd475b2d3c0"
REPORT_OLD = "a376c666b9566b2466c6b741dddd4d74e7c74a8c6c7ed949caa4a04eb9e5d3b6"
REPORT_NEW = "bd7c4f53af7b092776923084d6a551fb49e2e87fcf737a7d58debd42f6ef42f1"
REPORT_PROTECTED = {
    **PRE_STAGGER_SHA256,
    "trend-projection-account-queue.js": "5d46cfb0a50aac48b7c5893d64fa7ce3dc6a4ecc4d3c14694653d12dd0f0cbea",
}
AMAZON_SOURCE_BASE = "3a7b2dd0433e4e3b9bb602f3d5d60001540c83df"
AMAZON_DIR = "backend/apps/api/dist"
AMAZON_BASE_HASHES = {
    "amazon-public-browser-health.js": "5ed95d9c8f2f2e30971cb18efb1e9f6d8c4c00138a082f83a4168f0bf43446ca",
    "amazon-public-recovery.js": "5965405fb97cc177b6df2ee7c8bce6fa1bd7ae9873982eda07e4ba1a3e1313fa",
    "bootstrap/create-provider-adapter-runtime.js": "aa13d5591cd0b36894be95e863fd1302fd99756d7f2c992ba52b960ced7c5006",
    "crawler-runtime-service.js": "910295ac8493df30ee52a21c1ab5ed41a85c659f75fff3ec9aaae6a0966838f0",
    "mysql-crawler-runtime-repository.js": "39134e949194e07874ade1972dfe58230a39948069be63afe736c9044b1ddcb7",
    "pending-source-recovery-policy.js": "13c39242228fe1b140f66c52b539465fa2519ef246ed757229df7d539d0da4aa",
}
AMAZON_AUDIT_SOURCE_BASE = "9a9cb91cf2c30d662c74ab8bbace42fb7dd807b1"
AMAZON_AUDIT_MODULE = "crawler-scheduler-repository.js"
AMAZON_AUDIT_BASE = {AMAZON_AUDIT_MODULE: "af5a234c3f4100c30e9e241c0d277d0013eae810860dd6a061cbaab34f1ed4d8"}
AMAZON_INSTALLED = {
    "amazon-public-browser-health.js": "c86f7b72c16ec20b8d454004906bdcbc4c0c11574ff1cafd5f3ce7f5c74989f1",
    "amazon-public-recovery.js": "4d27d9ace276c75024eb2d3b3467a9cf2f2bedaa6e36ced00f6345747a6d613b",
    "bootstrap/create-provider-adapter-runtime.js": "eeafaf4ab4ee17ef86d5fc696cbcea0040edf98f076f5fa903f60b457af7e934",
    "crawler-runtime-service.js": "2bed639ee4fba8b43de26039341271a142d41a1f6ce14ce68d09f0abca627e20",
    "mysql-crawler-runtime-repository.js": "6fa5c6ce9b931ec0e60d1d7b72902c15e603d39064163ac073eb8804d0370e12",
    "pending-source-recovery-policy.js": "a7f611afa0b7284a3cce385fc515435bb974ba7381d748b99a02fc06d13d8762",
}
COLLECTION_SOURCE_BASE = "ed1b21ce60642ea52d103be7dd9cd18acb5a4c7f"
COLLECTION_BASE = {
    "apps/worker/dist/automatic-source-scheduler.js": "3ea9f8f2381c073e2402b4a26db8696c9287b48108976f4383a878dbc30da802",
    "apps/worker/dist/collection-task-state-machine.js": "1f64059b4c4baa5a5a823e3b8f1b3274b072aec97a4e05ff94d486c6a65edf72",
    "packages/provider-sources/dist/lan-1688-health-adapter.js": "0a5e81e502a1d46fe983c08b347acd3e9b848fad159758408041d9d5233eeda6",
    "packages/provider-sources/dist/lan-1688-image-search.js": "47b1cd820456e6cf5468a21f8998a031dba8333aa928975e81d7e3884e093750",
}
COLLECTION_CANDIDATE = dict(zip(COLLECTION_BASE, (
    "478d1abf0c4a7d796063a69570772167fddba22f1a49fcc6dec46884fa1e7f2b",
    "259dfb16a3ff87a60fdcbffc3e236e6cb6c571a024b64bd4123b058ba4defb3f",
    "ac86d6707cba01d6b059cf20264a5574591649a86b750a277840ce1d369b4c32",
    "8219222c7e4dcc0f398efdc712fd254711cadeee3936085741483313f7e9604f",
)))
COLLECTION_EXECUTOR = "apps/worker/dist/provider-source-executor.js"
COLLECTION_EXECUTOR_BASE = "afc757df47e827503d9150fb07a1ec6756519a3295009cd36e9cb186fc6ec04a"
COLLECTION_EXECUTOR_CANDIDATE = "9b539a3f68ad77017bba88b1bed479482ad2dad21d8ffd66507ba569abdcae45"
RESTART = "/www/server/panel/script/restart_project.py"
MODULE_PHASE = "not_installed"


def report_hashes(action):
    if action == "apply":
        return REPORT_OLD, REPORT_NEW
    if action == "restore":
        return REPORT_NEW, REPORT_OLD
    raise RuntimeError("trend_report_action_invalid")


def prepare_report(target, expected, encoded, digest, read_file, action):
    before, after = report_hashes(action)
    if (expected, digest) != (before, after):
        raise RuntimeError("trend_report_hash_pair_invalid")
    if hashlib.sha256(read_file(target, 65536)).hexdigest() != before:
        raise RuntimeError("trend_report_baseline_changed")
    data = base64.b64decode(encoded, validate=True)
    if not 0 < len(data) < 65536 or hashlib.sha256(data).hexdigest() != after:
        raise RuntimeError("trend_report_payload_invalid")
    protected = {target.with_name(name): read_file(target.with_name(name), 65536)
                 for name in REPORT_PROTECTED}
    if any(hashlib.sha256(value).hexdigest() != REPORT_PROTECTED[path.name]
           for path, value in protected.items()):
        raise RuntimeError("trend_report_protected_module_changed")
    return {target: (data, before, after)}, protected


def prepare_modules(target, expected_module, encoded, digest, scheduler, read_file, rollback=False):
    if rollback and scheduler is None:
        raise RuntimeError("trend_scheduler_manifest_invalid")
    old = read_file(target, 65536)
    if hashlib.sha256(old).hexdigest() != expected_module:
        raise RuntimeError("trend_module_baseline_changed")
    protected = {}
    if scheduler is None:
        entries = [(target, expected_module, encoded, digest, b"SELECT STRAIGHT_JOIN seed.task_id")]
    else:
        if tuple(scheduler) != SCHEDULER_FILES:
            raise RuntimeError("trend_scheduler_manifest_invalid")
        protected[target] = old
        entries = [
            (target.with_name(name), *scheduler[name], marker)
            for name, marker in zip(SCHEDULER_FILES, SCHEDULER_MARKERS)
        ]
    replacements = {}
    for path, before, payload, after, marker in entries:
        prior = old if path == target else read_file(path, 65536)
        if hashlib.sha256(prior).hexdigest() != before:
            raise RuntimeError("trend_module_baseline_changed")
        data = base64.b64decode(payload, validate=True)
        expected_payload = (
            after == PRE_STAGGER_SHA256.get(path.name) and marker not in data
            if rollback else marker in data
        )
        if (not 0 < len(data) < 65536 or hashlib.sha256(data).hexdigest() != after
                or not expected_payload or data == prior):
            raise RuntimeError("trend_candidate_invalid")
        replacements[path] = (data, before, after)
    return replacements, protected


def prepare_amazon(root, manifest, read_file, collection=None):
    audit = tuple(manifest) == tuple(AMAZON_AUDIT_BASE)
    frozen = AMAZON_AUDIT_BASE if audit else AMAZON_BASE_HASHES
    install_hashes = None
    if collection is not None:
        frozen, install_hashes = collection_hashes(collection)
    if tuple(manifest) != tuple(frozen):
        raise RuntimeError("trend_amazon_manifest_invalid")
    replacements = {}
    for name, (before, encoded, after) in manifest.items():
        if before != frozen[name] or not re.fullmatch(r"[a-f0-9]{64}", after):
            raise RuntimeError("trend_amazon_manifest_invalid")
        if install_hashes is not None and after != install_hashes[name]:
            raise RuntimeError("trend_collection_payload_hash_changed")
        path = root / ("backend" if collection is not None else AMAZON_DIR) / name
        if hashlib.sha256(read_file(path, 131072)).hexdigest() != before:
            raise RuntimeError("trend_amazon_baseline_changed")
        data = zlib.decompress(base64.b64decode(encoded, validate=True))
        if before == after or not 0 < len(data) <= 131072 or hashlib.sha256(data).hexdigest() != after:
            raise RuntimeError("trend_amazon_payload_invalid")
        replacements[path] = (data, before, after)
    worker_dir = (root / REPORT_TARGET).parent
    protect_hashes = {**REPORT_PROTECTED, Path(REPORT_TARGET).name: REPORT_NEW}
    protected = {worker_dir / key: read_file(worker_dir / key, 65536) for key in protect_hashes}
    if any(hashlib.sha256(value).hexdigest() != protect_hashes[path.name] for path, value in protected.items()):
        raise RuntimeError("trend_amazon_protected_module_changed")
    if audit or collection is not None:
        api_hashes = dict(AMAZON_INSTALLED)
        if collection is not None:
            api_hashes[AMAZON_AUDIT_MODULE] = "425611f474a67f26a7a3138a456def5652fa77872099337a89535dbb6fb40e33"
        for name, digest in api_hashes.items():
            path = root / AMAZON_DIR / name
            data = read_file(path, 131072)
            if hashlib.sha256(data).hexdigest() != digest:
                raise RuntimeError("trend_amazon_protected_module_changed")
            protected[path] = data
    if collection in ("executor", "executor_restore"):
        for name, digest in COLLECTION_CANDIDATE.items():
            path = root / "backend" / name
            data = read_file(path, 131072)
            if hashlib.sha256(data).hexdigest() != digest:
                raise RuntimeError("trend_collection_prerequisite_changed")
            protected[path] = data
    return replacements, protected


def collection_hashes(action):
    if action == "apply":
        return COLLECTION_BASE, COLLECTION_CANDIDATE
    if action == "restore":
        return COLLECTION_CANDIDATE, COLLECTION_BASE
    if action in ("executor", "executor_restore"):
        before, after = COLLECTION_EXECUTOR_BASE, COLLECTION_EXECUTOR_CANDIDATE
        if action == "executor_restore":
            before, after = after, before
        return {COLLECTION_EXECUTOR: before}, {COLLECTION_EXECUTOR: after}
    raise RuntimeError("trend_collection_manifest_invalid")


def install(root, expected_runtime, expected_module, build, encoded, digest, scheduler=None, rollback=False,
            report_action=None, amazon_modules=None, collection=None):
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
    if report_action is not None and (expected_runtime != REPORT_RUNTIME_BASE or scheduler is not None or rollback):
        raise RuntimeError("trend_report_manifest_invalid")
    if amazon_modules is not None and (expected_runtime != REPORT_RUNTIME_BASE or scheduler is not None
                                       or rollback or report_action is not None):
        raise RuntimeError("trend_amazon_manifest_invalid")
    target = root / (REPORT_TARGET if report_action is not None else TARGET)
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

        if amazon_modules is not None:
            folders = [root / AMAZON_DIR, root / AMAZON_DIR / "bootstrap"]
            if collection is not None:
                folders += [(root / "backend" / n).parent for n in COLLECTION_BASE]
            for folder in folders:
                if not folder.is_dir() or folder.resolve(strict=True) != folder:
                    raise RuntimeError("trend_unsafe_directory")
            replacements, protected_modules = prepare_amazon(root, amazon_modules, read_file, collection)
        elif report_action is not None:
            replacements, protected_modules = prepare_report(
                target, expected_module, encoded, digest, read_file, report_action
            )
        else:
            replacements, protected_modules = prepare_modules(
                target, expected_module, encoded, digest, scheduler, read_file, rollback
            )
        protected.update(protected_modules)
        local = "http://127.0.0.1:4101"
        domain = "https://midouai.medouai.com"
        pids = processes()
        if not pids.get("api") or not pids.get("worker") or not ready(local):
            raise RuntimeError("trend_baseline_not_ready")
        staged, replaced = {}, []
        # Keep original bytes only in memory, to unwind a partial write before restart.
        originals = {path: read_file(path, 131072) for path in replacements} if amazon_modules is not None else {}
        try:
            for path, (incoming, _, _) in replacements.items():
                metadata = path.stat()
                fd, scratch = tempfile.mkstemp(prefix=".trend-release-", dir=str(path.parent))
                staged[path] = scratch
                with os.fdopen(fd, "wb") as stream:
                    stream.write(incoming)
                    stream.flush()
                    os.fchown(stream.fileno(), metadata.st_uid, metadata.st_gid)
                    os.fchmod(stream.fileno(), metadata.st_mode & 0o777)
                    os.fsync(stream.fileno())
            # Install the scheduler before the registry that opts in. Do not
            # restart on a partial install; either version accepts either input.
            for path, scratch in staged.items():
                os.replace(scratch, path)
                replaced.append(path)
                MODULE_PHASE = "installing"
            MODULE_PHASE = "installed"
        except Exception:
            for path in reversed(replaced) if amazon_modules is not None else ():
                metadata = path.stat()
                fd, scratch = tempfile.mkstemp(prefix=".trend-release-", dir=str(path.parent))
                staged[path] = scratch
                with os.fdopen(fd, "wb") as stream:
                    stream.write(originals[path])
                    stream.flush()
                    os.fchown(stream.fileno(), metadata.st_uid, metadata.st_gid)
                    os.fchmod(stream.fileno(), metadata.st_mode & 0o777)
                    os.fsync(stream.fileno())
                os.replace(scratch, path)
            if amazon_modules is not None:
                MODULE_PHASE = "not_installed"
            raise
        finally:
            for scratch in staged.values():
                if os.path.exists(scratch):
                    os.unlink(scratch)

        def modules_match():
            return all(read_file(path, 131072 if amazon_modules is not None else 65536) == item[0] for path, item in replacements.items())

        if not modules_match():
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
        if (after["python"] != pids["python"] or not modules_match()
                or any(read_file(p, 262144) != b for p, b in protected.items())):
            raise RuntimeError("trend_unexpected_runtime_change")
        receipt = {"status": True, "overlay_sha": build, "runtime_base_sha": expected_runtime,
                   "restarted": "ai选品", "node_before": pids, "node_after": after}
        if amazon_modules is not None:
            receipt.update(modules={str(path.relative_to(root / ("backend" if collection is not None else AMAZON_DIR))): {"previous": item[1], "installed": item[2]}
                                    for path, item in replacements.items()},
                           preserved_modules={p.name: hashlib.sha256(b).hexdigest() for p,b in protected_modules.items()})
        elif report_action is not None:
            receipt.update(report_action=report_action, module=target.name, module_sha256=digest,
                           previous_module_sha256=expected_module, preserved_modules=REPORT_PROTECTED)
        elif scheduler is None:
            receipt.update(module_sha256=digest, previous_module_sha256=expected_module)
        else:
            receipt.update(
                modules={path.name: {"previous": item[1], "installed": item[2]}
                         for path, item in replacements.items()},
                preserved_trend_sha256=expected_module, scheduler_rollback=rollback,
            )
        return receipt


def validate_changes(changed, scheduler=False, rollback=False):
    exact = {SOURCE, "scripts/baota-account-trend-release.py", "scripts/deploy-account-baota.py",
             "scripts/baota-account-static-release.py"}
    required = {SOURCE}
    if scheduler:
        required = {"apps/worker/src/" + name[:-3] + ".ts" for name in SCHEDULER_FILES}
        exact.update(required)
    if rollback:
        if not scheduler:
            raise RuntimeError("trend_scheduler_manifest_invalid")
        # Restored files may be identical to the base runtime. The caller
        # separately requires a change to both files relative to the stagger release.
        required = set()
    if not required.issubset(changed) or any(
        p not in exact and not p.startswith(("apps/web/src/", "docs/", "tests/")) for p in changed
    ):
        raise RuntimeError("trend_release_contains_other_runtime_changes")


def validate_report_changes(changed):
    exact = {REPORT_SOURCE, "scripts/baota-account-trend-release.py", "scripts/deploy-account-baota.py"}
    if REPORT_SOURCE not in changed or any(p not in exact and not p.startswith(("docs/", "tests/")) for p in changed):
        raise RuntimeError("trend_report_contains_other_runtime_changes")


def build_report_restore(repo):
    return subprocess.check_output(["node", "--input-type=module", "-e", r"""
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
const source=execFileSync('git',['show',process.argv[1]+':'+process.argv[2]],{encoding:'utf8'});
process.stdout.write(ts.transpileModule(source,{fileName:'report-export-worker.ts',
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,sourceMap:true}}).outputText);
""", REPORT_RUNTIME_BASE, REPORT_SOURCE], cwd=repo)


def validate_amazon_changes(changed, audit=False):
    frozen = AMAZON_AUDIT_BASE if audit else AMAZON_BASE_HASHES
    modules = {"apps/api/src/" + name.removesuffix(".js") + ".ts" for name in frozen}
    exact = modules | {"scripts/baota-account-trend-release.py", "scripts/deploy-account-baota.py"}
    if not modules.issubset(changed) or any(p not in exact and not p.startswith(("docs/", "tests/")) for p in changed):
        raise RuntimeError("trend_amazon_contains_other_runtime_changes")


def collection_sources():
    return {n.replace("/dist/", "/src/").removesuffix(".js") + ".ts" for n in COLLECTION_BASE}


def validate_collection_changes(changed):
    source = collection_sources()
    web = {"apps/web/src/components/ProviderAdapterCenter.vue", "apps/web/src/source-1688-operator-action.ts"}
    executor = COLLECTION_EXECUTOR.replace("/dist/", "/src/").removesuffix(".js") + ".ts"
    exact = source | web | {executor, "scripts/deploy-account-baota.py", "scripts/baota-account-trend-release.py",
                            "scripts/baota-account-static-release.py"}
    if not (source | web).issubset(changed) or any(
        n not in exact and not n.startswith(("docs/", "tests/")) for n in changed
    ):
        raise RuntimeError("trend_collection_contains_other_runtime_changes")


def build_collection_restore(repo, name):
    source = name.replace("/dist/", "/src/").removesuffix(".js") + ".ts"
    return subprocess.check_output(["node", "--input-type=module", "-e", r"""
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
const file=process.argv[2];
const data=execFileSync('git',['show',process.argv[1]+':'+file],{encoding:'utf8'});
process.stdout.write(ts.transpileModule(data,{fileName:file.split('/').at(-1),compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,sourceMap:true}}).outputText);
""", COLLECTION_SOURCE_BASE, source], cwd=repo)


def publish(repo, previous, expected_module, deploy, ssh_connection, scheduler_expected=None, rollback=False,
            report_action=None, amazon=False, amazon_audit=False, collection=None):
    if not re.fullmatch(r"[a-f0-9]{40}", previous or "") or not re.fullmatch(r"[a-f0-9]{64}", expected_module or ""):
        raise RuntimeError("trend_release_requires_expected_sha256_and_base_sha")
    if collection is not None:
        route, _ = collection_hashes(collection)
        key = COLLECTION_EXECUTOR if collection in ("executor", "executor_restore") else "apps/worker/dist/collection-task-state-machine.js"
        if (previous != REPORT_RUNTIME_BASE or expected_module != route[key]
                or amazon or amazon_audit or scheduler_expected is not None or rollback or report_action is not None):
            raise RuntimeError("trend_collection_manifest_invalid")
    amazon = amazon or amazon_audit
    amazon_expected = AMAZON_AUDIT_BASE[AMAZON_AUDIT_MODULE] if amazon_audit else AMAZON_BASE_HASHES["amazon-public-browser-health.js"]
    if amazon and (previous != REPORT_RUNTIME_BASE or expected_module != amazon_expected
                   or scheduler_expected is not None or rollback or report_action is not None):
        raise RuntimeError("trend_amazon_manifest_invalid")
    if rollback and scheduler_expected is None:
        raise RuntimeError("trend_scheduler_manifest_invalid")
    if report_action is not None and (previous != REPORT_RUNTIME_BASE or scheduler_expected is not None
                                     or rollback or expected_module != report_hashes(report_action)[0]):
        raise RuntimeError("trend_report_manifest_invalid")
    if scheduler_expected is not None and (
        tuple(scheduler_expected) != SCHEDULER_FILES or any(
            not re.fullmatch(r"[a-f0-9]{64}", sha or "") for sha in scheduler_expected.values()
        )
    ):
        raise RuntimeError("trend_scheduler_manifest_invalid")

    def git(*args):
        return subprocess.check_output(["git", *args], cwd=repo).decode().strip()

    sha = git("rev-parse", "HEAD")
    if (git("status", "--porcelain") or deploy["normalize_github_repository"](git("remote", "get-url", "origin")).lower()
            != deploy["EXPECTED_GITHUB_REPOSITORY"].lower()
            or git("ls-remote", "--exit-code", "origin", "refs/heads/main") != sha + "\trefs/heads/main"):
        raise RuntimeError("trend_release_requires_clean_approved_main")
    deploy["verify_production_sha_history"](repo, previous, sha)
    if collection is not None:
        deploy["verify_production_sha_history"](repo, COLLECTION_SOURCE_BASE, sha)
        validate_collection_changes(git("diff", "--name-only", COLLECTION_SOURCE_BASE, sha).splitlines())
    elif amazon:
        source_base = AMAZON_AUDIT_SOURCE_BASE if amazon_audit else AMAZON_SOURCE_BASE
        deploy["verify_production_sha_history"](repo, source_base, sha)
        validate_amazon_changes(git("diff", "--name-only", source_base, sha).splitlines(), amazon_audit)
    elif report_action is not None:
        deploy["verify_production_sha_history"](repo, REPORT_SOURCE_BASE, sha)
        validate_report_changes(git("diff", "--name-only", REPORT_SOURCE_BASE, sha).splitlines())
    else:
        validate_changes(git("diff", "--name-only", previous, sha).splitlines(), scheduler_expected is not None, rollback)
    if rollback:
        deploy["verify_production_sha_history"](repo, STAGGER_RELEASE_SHA, sha)
        validate_changes(git("diff", "--name-only", STAGGER_RELEASE_SHA, sha).splitlines(), scheduler=True)
    for job in (("build:worker", "build:provider-sources") if collection is not None else
                ("build:api" if amazon else "build:worker",)):
        subprocess.run([deploy["local_npm_executable"](), "run", job], cwd=repo, check=True)
    if git("rev-parse", "HEAD") != sha or git("status", "--porcelain"):
        raise RuntimeError("trend_release_source_changed_during_build")
    module_path = repo / (REPORT_TARGET if report_action is not None else TARGET).removeprefix("backend/")
    amazon_modules = None
    if collection is not None:
        amazon_modules = {}
        before_hashes, after_hashes = collection_hashes(collection)
        for name, before in before_hashes.items():
            restored = build_collection_restore(repo, name)
            original = COLLECTION_EXECUTOR_BASE if name == COLLECTION_EXECUTOR else COLLECTION_BASE[name]
            if hashlib.sha256(restored).hexdigest() != original:
                raise RuntimeError("trend_collection_restore_build_differs")
            data = restored if collection in ("restore", "executor_restore") else (repo / name).read_bytes()
            after = hashlib.sha256(data).hexdigest()
            if after != after_hashes[name]:
                raise RuntimeError("trend_collection_build_differs")
            amazon_modules[name] = (before, base64.b64encode(zlib.compress(data)).decode(), after)
    elif amazon:
        amazon_modules = {}
        for name, before in (AMAZON_AUDIT_BASE if amazon_audit else AMAZON_BASE_HASHES).items():
            data = (repo / "apps/api/dist" / name).read_bytes()
            after = hashlib.sha256(data).hexdigest()
            if before == after or not 0 < len(data) <= 131072:
                raise RuntimeError("trend_amazon_payload_invalid")
            amazon_modules[name] = (before, base64.b64encode(zlib.compress(data)).decode(), after)
    module = b"" if amazon_modules is not None else build_report_restore(repo) if report_action == "restore" else module_path.read_bytes()
    if report_action is not None and hashlib.sha256(module).hexdigest() != report_hashes(report_action)[1]:
        raise RuntimeError("trend_report_build_differs")
    scheduler = None
    if scheduler_expected is not None:
        if hashlib.sha256(module).hexdigest() != expected_module:
            raise RuntimeError("trend_protected_build_differs")
        scheduler = {}
        for name, before in scheduler_expected.items():
            payload = module_path.with_name(name).read_bytes()
            after = hashlib.sha256(payload).hexdigest()
            if rollback and after != PRE_STAGGER_SHA256[name]:
                raise RuntimeError("trend_rollback_build_differs")
            scheduler[name] = (before, base64.b64encode(payload).decode(), after)
        module = b""
    args = (deploy["PROJECT_ROOT"], previous, expected_module, sha, base64.b64encode(module).decode(),
            hashlib.sha256(module).hexdigest(), scheduler, rollback, report_action, amazon_modules, collection)
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
