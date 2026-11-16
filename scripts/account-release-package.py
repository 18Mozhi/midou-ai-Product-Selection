"""Assemble the fixed no-backup production package from a verified local build."""

import argparse
import hashlib
import io
import json
import pathlib
import re
import runpy
import subprocess
import tarfile

ENTRYPOINTS = (
    "serve-account-production-cutover.mjs", "run-playwright-crawler.mjs",
    "production-route-catalog.mjs", "verify-production-product.mjs",
    "verify-production-api-coverage.mjs", "verify-production-core-e2e.mjs",
    "run-baota-production-acceptance.mjs", "run-baota-selection-acceptance.mjs",
)
ASSETS = (
    "config/route-catalog.json", "config/api-coverage-metadata.json",
    "infra/baota/production-acceptance-manifest.json", "infra/baota/selection-acceptance-manifest.json",
    "infra/baota/service-manifest.json", "config/env.example", "config/schema.json",
    "database/bootstrap/schema_migrations.sql", "verification/api-operation-evidence.schema.json",
    "docs/openapi.yaml",
)
MIGRATION = "0197_retire_tenancy_roots.up.sql"
HEX40 = re.compile(r"[0-9a-f]{40}")
HEX64 = re.compile(r"[0-9a-f]{64}")
JS_LOAD = re.compile(r"(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)[\"'](\.{1,2}/[^\"']+)[\"']")
BLOCKED_PATHS = {"tests", "__pycache__", "node_modules", ".git", ".cache", "backups"}
MAX_MEMBER_BYTES = 64 * 1024 * 1024
MAX_PACKAGE_BYTES = 512 * 1024 * 1024
MAX_PACKAGE_FILES = 12000


def script_closure(repo):
    scripts = (repo / "scripts").resolve(strict=True)
    result = set()
    remaining = [scripts / name for name in ENTRYPOINTS]
    while remaining:
        item = remaining.pop()
        path = item.resolve(strict=True)
        if path.is_relative_to(repo / "packages") and path.suffix == ".js" and "dist" in path.relative_to(repo).parts:
            if item.is_symlink() or not path.is_file():
                raise RuntimeError("account_release_unexpected_compiled_dependency")
            result.add(path)  # Already added by the fixed workspace dist rule.
            continue
        if not path.is_relative_to(scripts) or path.suffix != ".mjs" or item.is_symlink():
            raise RuntimeError("account_release_unexpected_script_dependency")
        if path in result:
            continue
        if "backup" in path.name or "rehearse-" in path.name:
            raise RuntimeError("account_release_forbidden_script_dependency")
        result.add(path)
        content = path.read_text(encoding="utf-8")
        remaining.extend(path.parent / part for part in JS_LOAD.findall(content))
    return sorted(result)


def payload_members(repo):
    repo = repo.resolve(strict=True)
    result = {}

    def add(source, dest):
        if not source.is_file() or source.is_symlink() or not source.resolve().is_relative_to(repo):
            raise RuntimeError(f"account_release_invalid_payload_member:{dest}")
        if dest in result:
            raise RuntimeError(f"account_release_duplicate_member:{dest}")
        result[dest] = source

    def tree(source, dest):
        if not source.is_dir() or source.is_symlink() or not source.resolve().is_relative_to(repo):
            raise RuntimeError(f"account_release_missing_directory:{dest}")
        for path in sorted(source.rglob("*")):
            rel = path.relative_to(source)
            if BLOCKED_PATHS.intersection(rel.parts) or path.suffix in {".pyc", ".map", ".tsbuildinfo"}:
                continue
            if path.name == ".env" or path.name.startswith(".env.") or path.suffix in {".pem", ".key", ".sqlite", ".sqlite3"}:
                raise RuntimeError(f"account_release_unexpected_sensitive_member:{dest}")
            if path.is_symlink():
                raise RuntimeError(f"account_release_symlink_in_payload:{dest}")
            if path.is_file():
                add(path, f"{dest}/{rel.as_posix()}")

    tree(repo / "apps/web/dist", "frontend")
    for name in ("package.json", "package-lock.json", *ASSETS):
        add(repo / name, f"backend/{name}")
    for group in ("apps", "packages"):
        for manifest in sorted((repo / group).glob("*/package.json")):
            rel = manifest.parent.relative_to(repo).as_posix()
            add(manifest, f"backend/{rel}/package.json")
            if rel == "apps/web":
                continue
            dist = manifest.parent / "dist"
            if dist.is_dir():
                tree(dist, f"backend/{rel}/dist")
    for script in script_closure(repo):
        name = f"backend/{script.relative_to(repo).as_posix()}"
        if script.is_relative_to(repo / "scripts"):
            add(script, name)
        elif name not in result:
            raise RuntimeError(f"account_release_compiled_dependency_not_packaged:{name}")
    tree(repo / "database/migrations", "backend/database/migrations")
    tree(repo / "apps/crawler/scoutops_crawler", "python/scoutops_crawler")
    add(repo / "apps/crawler/pyproject.toml", "python/pyproject.toml")
    for name in ("frontend/index.html", "backend/apps/backend/dist/server.js",
                 "backend/apps/worker/dist/index.js", "python/scoutops_crawler/__main__.py",
                 f"backend/database/migrations/{MIGRATION}"):
        if name not in result:
            raise RuntimeError(f"account_release_required_member_missing:{name}")
    return result


def release_metadata(identity, version, plan_sha):
    sha = identity.get("local_sha", "")
    if (not HEX40.fullmatch(sha) or sha != identity.get("remote_sha") or
            identity.get("remote_branch") != "main" or
            str(identity.get("repository", "")).lower() != "18mozhi/midou-ai-product-selection" or
            not isinstance(plan_sha, str) or not HEX64.fullmatch(plan_sha) or
            not isinstance(version, str) or not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-zA-Z0-9.-]+)?", version)):
        raise RuntimeError("account_release_invalid_source_identity")
    return {
        "BUILD_SHA": sha, "APP_VERSION": version,
        "RELEASE_SOURCE_LOCAL_SHA": sha, "RELEASE_SOURCE_REMOTE_SHA": sha,
        "RELEASE_SOURCE_REMOTE_BRANCH": "main", "RELEASE_SOURCE_REPOSITORY": identity["repository"],
        "RELEASE_SOURCE_MIGRATION_VERSION": MIGRATION, "ACCOUNT_SCOPE_MODE": "retired",
    }


def build_account_archive(repo, expected_plan_sha, output):
    repo = pathlib.Path(repo).resolve(strict=True)
    deploy = runpy.run_path(str(repo / "scripts/deploy-baota.py"))
    if subprocess.check_output(["git", "status", "--porcelain"], cwd=repo).strip():
        raise RuntimeError("account_release_source_must_be_clean")
    identity = deploy["release_source_identity"](repo)
    deploy["verify_local_source_preflight"](repo)
    subprocess.run([deploy["local_npm_executable"](), "run", "build"], cwd=repo, check=True)
    deploy["verify_local_build_preflight"](repo)
    if (subprocess.check_output(["git", "status", "--porcelain"], cwd=repo).strip() or
            subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo).decode().strip() != identity["local_sha"]):
        raise RuntimeError("account_release_build_changed_source")
    plan_sha = compiled_plan_sha(repo, deploy)
    if plan_sha != expected_plan_sha:
        raise RuntimeError("account_release_package_plan_digest_mismatch")
    return write_account_archive(repo, identity, plan_sha, output)


def verify_account_archive(path, expected_build_sha, expected_plan_sha, *, fileobj=None, visit=None):
    if not HEX40.fullmatch(expected_build_sha) or not HEX64.fullmatch(expected_plan_sha):
        raise RuntimeError("account_release_archive_binding_invalid")
    hashes = {}
    manifest = metadata = None
    size = 0
    with tarfile.open(path, mode="r|gz", fileobj=fileobj) as archive:
        for entry in archive:
            path_parts = entry.name.split("/")
            if (not entry.isfile() or entry.name in hashes or len(hashes) >= MAX_PACKAGE_FILES or
                    not 0 <= entry.size <= MAX_MEMBER_BYTES or
                    any(not part or part in {".", ".."} or "\\" in part or ":" in part for part in path_parts) or
                    BLOCKED_PATHS.intersection(path_parts) or
                    path_parts[-1].startswith(".env") or pathlib.PurePosixPath(entry.name).suffix in {".key", ".pem", ".sqlite", ".sqlite3"} or
                    not ((len(path_parts) == 1 and entry.name in {"release.env", "manifest.json"}) or
                         (len(path_parts) > 1 and path_parts[0] in {"backend", "frontend", "python"}))):
                raise RuntimeError("account_release_archive_unsafe_member")
            size += entry.size
            if size > MAX_PACKAGE_BYTES:
                raise RuntimeError("account_release_archive_size_limit")
            with archive.extractfile(entry) as file:
                data = file.read()
            if len(data) != entry.size:
                raise RuntimeError("account_release_archive_short_member")
            hashes[entry.name] = hashlib.sha256(data).hexdigest()
            if visit is not None:
                visit(entry.name, data)
            if entry.name == "manifest.json":
                manifest = json.loads(data)
            if entry.name == "release.env":
                pairs = [line.split("=", 1) for line in data.decode().splitlines()]
                metadata = dict(pairs)
                if len(metadata) != len(pairs):
                    raise RuntimeError("account_release_archive_duplicate_metadata")
    hashes.pop("manifest.json", None)
    if (not isinstance(manifest, dict) or manifest != {
            "schema": 1, "build_sha": expected_build_sha, "plan_sha256": expected_plan_sha,
            "migration": MIGRATION, "files": hashes,
            } or not isinstance(metadata, dict) or metadata != release_metadata({
                "local_sha": expected_build_sha, "remote_sha": expected_build_sha, "remote_branch": "main",
                "repository": metadata.get("RELEASE_SOURCE_REPOSITORY"),
            }, metadata.get("APP_VERSION"), expected_plan_sha)):
        raise RuntimeError("account_release_archive_identity_or_checksum_mismatch")
    required = {
        "frontend/index.html", "backend/apps/backend/dist/server.js", "backend/apps/worker/dist/index.js",
        "backend/scripts/run-account-production-cutover.mjs", "backend/scripts/serve-account-production-cutover.mjs",
        "python/scoutops_crawler/__main__.py",
        f"backend/database/migrations/{MIGRATION}", "release.env",
    }
    if not required.issubset(hashes):
        raise RuntimeError("account_release_archive_required_files_missing")
    return {"build_sha": expected_build_sha, "plan_sha256": expected_plan_sha, "files": len(hashes)}


def write_account_archive(repo, identity, plan_sha, output):
    version = json.loads((repo / "package.json").read_text(encoding="utf-8"))["version"]
    metadata = release_metadata(identity, version, plan_sha)
    members = payload_members(repo)
    hashes = {}

    def append(archive, name, data):
        entry = tarfile.TarInfo(name)
        entry.mode = 0o644
        entry.size = len(data)
        archive.addfile(entry, io.BytesIO(data))
        hashes[name] = hashlib.sha256(data).hexdigest()

    created = False
    try:
        with pathlib.Path(output).open("xb") as handle:
            created = True
            with tarfile.open(fileobj=handle, mode="w:gz") as archive:
                for name, source in sorted(members.items()):
                    append(archive, name, source.read_bytes())
                append(archive, "release.env", "".join(f"{key}={value}\n" for key, value in metadata.items()).encode())
                append(archive, "manifest.json", json.dumps({
                    "schema": 1, "build_sha": metadata["BUILD_SHA"], "plan_sha256": plan_sha,
                    "migration": MIGRATION, "files": hashes,
                }, sort_keys=True, separators=(",", ":")).encode())
        return verify_account_archive(output, metadata["BUILD_SHA"], plan_sha)
    except BaseException:
        if created:
            pathlib.Path(output).unlink()
        raise


def compiled_plan_sha(repo, deploy):
    raw = subprocess.check_output([deploy["local_node_executable"](), "scripts/plan-account-retirement-production.mjs"], cwd=repo)
    plan = json.loads(raw)
    if plan["forward"][-1]["name"] != MIGRATION or plan["target_database"] != "product_scout":
        raise RuntimeError("account_release_plan_contract_invalid")
    return plan["plan_sha256"]


def main():
    parser = argparse.ArgumentParser(description="Audit the built local account-release payload (no SSH)")
    parser.add_argument("--inspect", action="store_true", required=True)
    parser.parse_args()
    repo = pathlib.Path(__file__).resolve().parent.parent
    deploy = runpy.run_path(str(repo / "scripts/deploy-baota.py"))
    plan_sha = compiled_plan_sha(repo, deploy)
    members = payload_members(repo)
    print(json.dumps({"status": "local_payload_inputs_verified", "deployable": False,
                      "files": len(members), "script_files": sum(name.startswith("backend/scripts/") for name in members),
                      "plan_sha256": plan_sha, "target_migration": MIGRATION}))


if __name__ == "__main__":
    main()
