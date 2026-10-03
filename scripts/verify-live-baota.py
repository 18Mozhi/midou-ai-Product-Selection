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
    if probe not in {"mysql", "redis"}:
        raise SystemExit("probe must be mysql or redis")

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
        package_names = ["config", "database" if probe == "mysql" else "redis"]
        for package in package_names:
            candidates = (
                f"'../packages/{package}/dist/index.js'",
                f'"../packages/{package}/dist/index.js"',
            )
            old = next((candidate for candidate in candidates if source.count(candidate) == 1), None)
            if old is None:
                raise RuntimeError(f"local live probe import mismatch: {package}")
            remote_path = f"/www/wwwroot/ai选品/backend/packages/{package}/dist/index.js"
            new = json.dumps("file://" + quote(remote_path, safe="/"))
            source = source.replace(old, new, 1)

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
        target_var = f"SCOUTOPS_{probe.upper()}_LIVE_TARGET"
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
