"""Run approved live dependency probes on the fixed BaoTa host."""

from __future__ import annotations

import json
import pathlib
import runpy
import shlex
import sys
import uuid
from urllib.parse import quote


def main() -> int:
    probe = sys.argv[1] if len(sys.argv) == 2 else ""
    if probe not in {"mysql", "redis", "api", "file-audit", "local-auth", "mfa", "tenancy", "rbac", "resource-grants", "audit-seed", "theme-preferences"}:
        raise SystemExit("unsupported BaoTa live probe")

    repo = pathlib.Path(__file__).resolve().parents[1]
    deployer = runpy.run_path(str(repo / "scripts" / "deploy-baota.py"))
    request_id = str(uuid.uuid4())
    client = deployer["paramiko"].SSHClient()
    client.set_missing_host_key_policy(deployer["paramiko"].RejectPolicy())
    stage = "host_key"

    try:
        known_hosts = pathlib.Path.home() / ".ssh" / "known_hosts"
        if not known_hosts.is_file():
            raise RuntimeError("verified SSH host key is unavailable")
        client.load_host_keys(str(known_hosts))
        client.connect(
            deployer["HOST"],
            username=deployer["SSH_USER"],
            password=deployer["read_windows_credential"](),
            timeout=15,
        )

        stage = "production_identity"
        identity = deployer["remote_python"](
            client,
            deployer["production_identity_source"](),
            timeout=30,
        )
        if identity.get("build_sha") is None:
            raise RuntimeError("the fixed BaoTa release identity is unavailable")

        stage = "local_probe_source"
        script_path = repo / "scripts" / f"verify-{probe}-live.mjs"
        source = script_path.read_text(encoding="utf-8")
        package_names = ["config"]
        if probe in {"mysql", "api", "file-audit", "local-auth", "mfa", "tenancy", "rbac", "resource-grants", "audit-seed", "theme-preferences"}:
            package_names.append("database")
        if probe == "theme-preferences":
            package_names.append("preferences")
        if probe in {"redis", "api"}:
            package_names.append("redis")
        if probe in {"local-auth", "mfa"}:
            package_names.append("auth")
        if probe == "tenancy":
            package_names.append("tenancy")
        if probe == "rbac":
            package_names.extend(("tenancy", "authorization"))
        if probe == "resource-grants":
            package_names.extend(("authorization", "resource-grants"))
        if probe == "audit-seed":
            package_names.extend(("auth", "audit"))
        if probe == "api":
            package_names.append("api")
        if probe == "file-audit":
            package_names.append("storage")
        for package in package_names:
            import_path = (
                "../apps/api/dist/app.js"
                if package == "api"
                else f"../packages/{package}/dist/index.js"
            )
            candidates = (f"'{import_path}'", f'"{import_path}"')
            old = next((candidate for candidate in candidates if source.count(candidate) == 1), None)
            if old is None:
                raise RuntimeError(f"local live probe import mismatch: {package}")
            remote_path = (
                f"/www/wwwroot/ai选品/backend/apps/api/dist/app.js"
                if package == "api"
                else f"/www/wwwroot/ai选品/backend/packages/{package}/dist/index.js"
            )
            new = json.dumps("file://" + quote(remote_path, safe="/"))
            source = source.replace(old, new, 1)

        if probe in {"local-auth", "mfa"}:
            app_imports = (
                ("../apps/api/dist/mysql-auth-repository.js",)
                if probe == "local-auth"
                else (
                    "../apps/api/dist/mysql-auth-repository.js",
                    "../apps/api/dist/mysql-mfa-repository.js",
                    "../apps/api/dist/mysql-auth-idempotency.js",
                )
            )
            for import_path in app_imports:
                candidates = (f"'{import_path}'", f'"{import_path}"')
                old = next((candidate for candidate in candidates if source.count(candidate) == 1), None)
                if old is None:
                    raise RuntimeError(f"local auth probe import mismatch: {import_path}")
                remote_path = f"/www/wwwroot/ai选品/backend/{import_path.removeprefix('../')}"
                source = source.replace(old, json.dumps("file://" + quote(remote_path, safe="/")), 1)

        if probe == "tenancy":
            import_path = "../apps/api/dist/mysql-tenancy-repository.js"
            candidates = (f"'{import_path}'", f'"{import_path}"')
            old = next((candidate for candidate in candidates if source.count(candidate) == 1), None)
            if old is None:
                raise RuntimeError("local tenancy probe import mismatch")
            remote_path = f"/www/wwwroot/ai选品/backend/{import_path.removeprefix('../')}"
            source = source.replace(old, json.dumps("file://" + quote(remote_path, safe="/")), 1)

        if probe == "rbac":
            for import_path in (
                "../apps/api/dist/mysql-tenancy-repository.js",
                "../apps/api/dist/mysql-authorization-repository.js",
            ):
                candidates = (f"'{import_path}'", f'"{import_path}"')
                old = next((candidate for candidate in candidates if source.count(candidate) == 1), None)
                if old is None:
                    raise RuntimeError("local RBAC probe repository import mismatch")
                remote_path = f"/www/wwwroot/ai选品/backend/{import_path.removeprefix('../')}"
                source = source.replace(old, json.dumps("file://" + quote(remote_path, safe="/")), 1)

        repository_imports = {
            "theme-preferences": ("../apps/api/dist/mysql-ui-preference-repository.js",),
            "resource-grants": (
                "../apps/api/dist/mysql-authorization-repository.js",
                "../apps/api/dist/mysql-resource-grant-repository.js",
            ),
            "audit-seed": ("../apps/api/dist/mysql-audit-repository.js",),
        }
        for import_path in repository_imports.get(probe, ()):
            candidates = (f"'{import_path}'", f'"{import_path}"')
            old = next((candidate for candidate in candidates if source.count(candidate) == 1), None)
            if old is None:
                raise RuntimeError("local live probe repository import mismatch")
            remote_path = f"/www/wwwroot/ai选品/backend/{import_path.removeprefix('../')}"
            source = source.replace(old, json.dumps("file://" + quote(remote_path, safe="/")), 1)

        if probe == "mysql":
            candidates = (
                "await readFile('database/bootstrap/schema_migrations.sql', 'utf8')",
                'await readFile("database/bootstrap/schema_migrations.sql", "utf8")',
            )
            old = next((candidate for candidate in candidates if source.count(candidate) == 1), None)
            if old is None:
                raise RuntimeError("local MySQL bootstrap source mismatch")
            sql = (repo / "database" / "bootstrap" / "schema_migrations.sql").read_text(
                encoding="utf-8"
            )
            source = source.replace(old, json.dumps(sql), 1)

        stage = "remote_probe"
        project_root = deployer["PROJECT_ROOT"]
        backend = f"{project_root}/backend"
        env_file = f"{project_root}/config/product_scout.env"
        target_var = f"SCOUTOPS_{probe.upper().replace('-', '_')}_LIVE_TARGET"
        command = (
            f"cd {shlex.quote(backend)} && "
            f"{target_var}=local "
            f"{shlex.quote(deployer['NODE_BIN'])} "
            f"--env-file={shlex.quote(env_file)} --input-type=module -e {shlex.quote(source)}"
        )
        _, stdout, stderr = client.exec_command(command, timeout=120)
        output = stdout.read().decode("utf-8", "replace")
        errors = stderr.read().decode("utf-8", "replace")
        status = stdout.channel.recv_exit_status()
        if output:
            sys.stdout.write(output)
        if errors:
            sys.stderr.write(errors)
        return status
    except Exception as error:
        print(
            json.dumps(
                {
                    "status": "blocked",
                    "code": "baota_live_probe_unavailable",
                    "message": "The fixed BaoTa live dependency probe could not be completed.",
                    "stage": stage,
                    "error_type": type(error).__name__,
                    "request_id": request_id,
                    "trace_id": request_id,
                }
            ),
            file=sys.stderr,
        )
        return 2
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
