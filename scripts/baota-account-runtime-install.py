"""Internal, no-backup activation of the 0197 runtime in the fixed BaoTa directories."""

import hashlib
import os
import pathlib
import re
import shutil
import stat
import subprocess

ROOT = pathlib.Path("/www/wwwroot/ai选品")
LAYOUT = ("frontend", "backend", "python")
MIGRATION = "0197_retire_tenancy_roots.up.sql"
PYTHON = "/www/server/pyporject_evn/versions/3.12.13/bin/python3.12"


def canonical_directory(path):
    if path.is_symlink() or path.resolve(strict=True) != path or not path.is_dir():
        raise RuntimeError("account_install_noncanonical_directory")
    return path.stat()


def sha256_file(path):
    if path.is_symlink() or not path.is_file():
        raise RuntimeError("account_install_missing_regular_file")
    sha = hashlib.sha256()
    with path.open("rb") as handle:
        for data in iter(lambda: handle.read(1024 * 1024), b""):
            sha.update(data)
    return sha.hexdigest()


def read_release(path):
    sha256_file(path)
    pairs = [line.split("=", 1) for line in path.read_text(encoding="utf-8").splitlines() if "=" in line]
    fields = dict(pairs)
    if len(fields) != len(pairs):
        raise RuntimeError("account_install_duplicate_release_fields")
    return fields


def check_mounts(root):
    # Bind mounts may report the same st_dev. Check mountpoints before rmtree.
    with open("/proc/self/mountinfo", encoding="utf-8") as source:
        for line in source:
            mount = re.sub(r"\\([0-7]{3})", lambda match: chr(int(match[1], 8)), line.split()[4])
            if any(mount == str(root / name) or mount.startswith(str(root / name) + "/")
                   for name in LAYOUT):
                raise RuntimeError("account_install_live_package_contains_mount")


def check_reusable_node_modules(live_backend, candidate_backend):
    modules = live_backend / "node_modules"
    canonical_directory(modules)
    if sha256_file(live_backend / "package-lock.json") != sha256_file(candidate_backend / "package-lock.json"):
        raise RuntimeError("account_install_dependency_lock_changed")
    entries = []
    for scope in sorted(modules.glob("@*")):
        if not scope.is_dir() or scope.is_symlink():
            raise RuntimeError("account_install_unexpected_node_scope")
        for item in sorted(scope.iterdir()):
            if not item.is_symlink():
                continue
            link = pathlib.Path(os.readlink(item))
            target = item.resolve(strict=True)
            if link.is_absolute() or live_backend not in target.parents:
                raise RuntimeError("account_install_unsafe_workspace_link")
            relative = target.relative_to(live_backend)
            if len(relative.parts) != 2 or relative.parts[0] not in {"apps", "packages"}:
                raise RuntimeError("account_install_unexpected_workspace_link_target")
            candidate = candidate_backend / relative
            if sha256_file(target / "package.json") != sha256_file(candidate / "package.json"):
                raise RuntimeError("account_install_workspace_manifest_changed")
            canonical_directory(candidate)
            entries.append(relative.as_posix())
    if not entries or len(set(entries)) != len(entries):
        raise RuntimeError("account_install_workspace_links_missing_or_aliased")
    sha256_file(modules / "mysql2" / "promise.js")
    return modules


def check_install_layout(stage, expected_build_sha, expected_previous_sha):
    if not all(re.fullmatch(r"[a-f0-9]{40}", value or "") for value in (expected_build_sha, expected_previous_sha)):
        raise RuntimeError("account_install_bad_build_binding")
    if expected_build_sha == expected_previous_sha:
        raise RuntimeError("account_install_same_build_is_not_cutover")
    if stage != ROOT / "runtime/tmp" / ("account-release-" + expected_build_sha):
        raise RuntimeError("account_install_unexpected_stage_path")
    root_device = canonical_directory(ROOT).st_dev
    stage_stat = canonical_directory(stage)
    if stage_stat.st_uid != os.geteuid() or stat.S_IMODE(stage_stat.st_mode) != 0o700:
        raise RuntimeError("account_install_stage_is_not_private")
    for path in [ROOT / "config", ROOT / "runtime/tmp", *(ROOT / n for n in LAYOUT),
                 *(stage / n for n in LAYOUT)]:
        if canonical_directory(path).st_dev != root_device:
            raise RuntimeError("account_install_requires_same_filesystem")
    check_mounts(ROOT)
    source = read_release(stage / "release.env")
    previous = read_release(ROOT / "config/release.env")
    if (source.get("BUILD_SHA") != expected_build_sha or previous.get("BUILD_SHA") != expected_previous_sha or
            source.get("ACCOUNT_SCOPE_MODE") != "retired" or
            source.get("RELEASE_SOURCE_MIGRATION_VERSION") != MIGRATION):
        raise RuntimeError("account_install_release_identity_mismatch")
    return source


def prepare_runtime_dependencies(stage, build_sha, previous_sha):
    check_install_layout(stage, build_sha, previous_sha)
    check_reusable_node_modules(ROOT / "backend", stage / "backend")
    package = stage / "python"
    source = (package / "pyproject.toml").read_text(encoding="utf-8")
    if not re.search(r'^dependencies\s*=\s*\["curl-cffi==0\.7\.4"\]\s*$', source, re.MULTILINE):
        raise RuntimeError("account_install_unexpected_python_dependency_contract")
    target = package / ".runtime-deps"
    if target.is_symlink():
        raise RuntimeError("account_install_unsafe_python_dependency_path")
    if not target.exists():
        installed = subprocess.run([PYTHON, "-m", "pip", "install", "--no-input", "--no-cache-dir",
                                    "--disable-pip-version-check", "--only-binary=:all:",
                                    "--target", str(target), "curl-cffi==0.7.4"],
                                   capture_output=True, timeout=180)
        if installed.returncode:
            raise RuntimeError("account_install_python_dependencies_failed")
    canonical_directory(target / "curl_cffi")
    probe = subprocess.run([PYTHON, "-B", "-c",
                            "import sys; sys.path.insert(0,sys.argv[1]); import curl_cffi; "
                            "assert curl_cffi.__version__ == '0.7.4'; from curl_cffi import requests",
                            str(target)], capture_output=True, timeout=30)
    if probe.returncode:
        raise RuntimeError("account_install_python_dependency_probe_failed")
    return {"status": "dependencies_verified", "node_dependency_mode": "reuse_matching_lock"}


def install_fixed_runtime(stage, build_sha, previous_sha, database, assert_writers_stopped):
    # The coordinator supplies this result directly from the fenced connection;
    # this module has no command line and accepts no remote/user-provided report.
    if (database.get("status") != "database_verified" or
            database.get("forward", {}).get("receipt", {}).get("applied") != 121 or
            database.get("forward", {}).get("preservation", {}).get("status") != "matched" or
            database.get("forward", {}).get("ownership", {}).get("tenancy_schema", {}).get("status") != "retired"):
        raise RuntimeError("account_install_requires_verified_database_cutover")
    check_install_layout(stage, build_sha, previous_sha)
    assert_writers_stopped()
    # The Node dependency tree is moved, never copied. Relative workspace
    # links become valid again when the prepared backend takes the fixed path.
    previous_modules = check_reusable_node_modules(ROOT / "backend", stage / "backend")
    target_modules = stage / "backend/node_modules"
    if target_modules.exists() or target_modules.is_symlink():
        raise RuntimeError("account_install_stage_dependency_collision")
    # The staged crawler must have passed its import probe; no shared Python install.
    canonical_directory(stage / "python/.runtime-deps/curl_cffi")
    assert_writers_stopped()
    previous_modules.rename(target_modules)
    for folder in ("backend", "python", "frontend"):
        assert_writers_stopped()
        fixed = ROOT / folder
        shutil.rmtree(fixed)
        (stage / folder).rename(fixed)
    previous_config = ROOT / "config/release.env"
    incoming_config = stage / "release.env"
    owner = previous_config.stat()
    os.chown(incoming_config, owner.st_uid, owner.st_gid)
    incoming_config.chmod(0o640)
    incoming_config.replace(previous_config)
    if read_release(previous_config).get("BUILD_SHA") != build_sha:
        raise RuntimeError("account_install_release_readback_failed")
    return {"status": "runtime_installed", "build_sha": build_sha}
