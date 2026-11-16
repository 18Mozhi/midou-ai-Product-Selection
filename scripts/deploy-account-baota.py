"""Coordinated, no-backup account-scope production release through fixed-host SSH."""

import argparse
import contextlib
import hashlib
from http.client import HTTPSConnection
import json
import pathlib
import re
import runpy
import shlex
import shutil
import tempfile

import paramiko

SOURCES = {
    "package": "account-release-package.py",
    "install": "baota-account-runtime-install.py",
    "stage": "baota-account-release-stage.py",
    "control": "baota-account-cutover-control.py",
    "drain": "baota-account-claim-drain.py",
    "coordinator": "baota-account-release-coordinator.py",
}


def remote_source(scripts, args):
    contents = {key: (scripts / name).read_text(encoding="utf-8") for key, name in SOURCES.items()}
    return "contents=" + repr(contents) + "\nargs=" + repr(args) + r'''
import json
namespaces={}
for name, content in contents.items():
    module={"__name__":"account_release_" + name}
    exec(compile(content, name, "exec"), module)
    namespaces[name]=module
c=namespaces["coordinator"]
steps=c["BaoTaRelease"](args,namespaces)
try:
    with steps.lock():
        result=c["coordinate_account_release"](steps)
except Exception as exc:
    import re
    reason=str(exc)
    result={"status":False,"phase":steps.phase,"reason":reason if re.fullmatch(r"account_[a-z0-9_]+",reason) else type(exc).__name__}
print("SCOUTOPS_RESULT="+json.dumps(result),flush=True)
'''


def extract_result(output):
    lines = [line.removeprefix("SCOUTOPS_RESULT=") for line in output.splitlines() if line.startswith("SCOUTOPS_RESULT=")]
    if len(lines) != 1:
        raise RuntimeError("account_release_no_authoritative_response_check_state_before_retry")
    return json.loads(lines[0])


def transfer_exclusive(ssh, archive, destination):
    with ssh.open_sftp() as sftp:
        with sftp.open(destination, "wxb") as remote, archive.open("rb") as local:
            remote.chmod(0o600)
            shutil.copyfileobj(local, remote, length=1024 * 1024)
            remote.flush()


@contextlib.contextmanager
def project_ssh(deploy):
    with paramiko.SSHClient() as ssh:
        ssh.load_host_keys(str(pathlib.Path.home() / ".ssh" / "known_hosts"))
        ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
        ssh.connect(deploy["HOST"], port=22, username=deploy["SSH_USER"],
                    password=deploy["read_windows_credential"](), allow_agent=False, look_for_keys=False, timeout=12)
        yield ssh


def probe_standalone_crawler(ssh, deploy, scripts):
    root = deploy["PROJECT_ROOT"]
    command = ("cd " + shlex.quote(root + "/backend") + " && " + shlex.quote(deploy["NODE_BIN"]) +
               " --env-file=" + shlex.quote(root + "/config/product_scout.env") + " --input-type=module -")
    source = (scripts / "lib/account-crawler-cutover-preflight.mjs").read_text(encoding="utf-8") + r'''
import mysql from 'mysql2/promise';
const e=process.env;
if(e.DB_HOST!=='127.0.0.1'||e.DB_NAME!=='product_scout'||e.DB_USER!=='product_scout')process.exit(2);
const db=await mysql.createConnection({host:e.DB_HOST,port:Number(e.DB_PORT),user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME,connectTimeout:8000});
try {
 await db.query('START TRANSACTION READ ONLY');
 const [[target]]=await db.query('SELECT DATABASE() db,VERSION() version,CURRENT_USER() account');
 if(target.db!=='product_scout'||!target.version.startsWith('5.7.')||!/^product_scout@[^@]+$/.test(target.account))process.exitCode=2;
 else process.stdout.write(JSON.stringify(await readStandaloneCrawlerCutoverPreflight(db))+'\n');
}finally{await db.rollback();await db.end();}
'''
    stdin, stdout, _stderr = ssh.exec_command(command, timeout=20)
    stdin.write(source)
    stdin.channel.shutdown_write()
    reply = stdout.read().decode()
    if stdout.channel.recv_exit_status():
        raise RuntimeError("account_release_standalone_crawler_probe_failed")
    counts = json.loads(reply)
    if set(counts) != {"running", "leases"} or not all(type(x) is int and x >= 0 for x in counts.values()):
        raise RuntimeError("account_release_standalone_crawler_probe_invalid")
    return counts


def require_drained_crawler(counts):
    if counts["running"] or counts["leases"]:
        raise RuntimeError("account_cutover_standalone_crawler_not_drained:" + json.dumps(counts))


def verify_public_retired_pages():
    for path in ("/select-context", "/org-admin/members", "/platform-admin/organizations"):
        connection = HTTPSConnection("midouai.medouai.com", timeout=10)
        try:
            connection.request("GET", path, headers={"Accept": "text/html", "Cache-Control": "no-cache"})
            response = connection.getresponse()
            try:
                if response.status != 404:
                    raise RuntimeError("account_release_public_legacy_page_visible:" + path + ":" + str(response.status))
            finally:
                response.close()
        finally:
            connection.close()


def execute(repo, previous, plan):
    if not re.fullmatch(r"[a-f0-9]{40}", previous) or not re.fullmatch(r"[a-f0-9]{64}", plan):
        raise RuntimeError("account_release_expected_sha_required")
    scripts = repo / "scripts"
    package = runpy.run_path(str(scripts / SOURCES["package"]))
    deploy = runpy.run_path(str(scripts / "deploy-baota.py"))
    with tempfile.TemporaryDirectory(prefix="scoutops-authorized-release-") as temporary:
        archive = pathlib.Path(temporary) / "runtime.tar.gz"
        artifact = package["build_account_archive"](repo, plan, archive)
        build = artifact["build_sha"]
        if build == previous:
            raise RuntimeError("account_release_same_build_not_cutover")
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        with project_ssh(deploy) as ssh:
            actual = deploy["remote_python"](ssh, deploy["production_identity_source"](), timeout=20)
            if actual["build_sha"] != previous or actual["migration_version"] != deploy["DEPLOYMENT_MIGRATION_VERSION"]:
                raise RuntimeError("account_release_live_baseline_changed")
            deploy["verify_production_sha_history"](repo, previous, build)
            require_drained_crawler(probe_standalone_crawler(ssh, deploy, scripts))
            destination = deploy["PROJECT_ROOT"] + "/config/account-upload-" + build + ".tar.gz"
            transfer_exclusive(ssh, archive, destination)
            source = remote_source(scripts, dict(build=build, previous=previous, plan=plan, archive_sha=digest))
            stdin, stdout, stderr = ssh.exec_command(deploy["PANEL_PYTHON"] + " -B -", timeout=None)
            stdin.write(source)
            stdin.channel.shutdown_write()
            result = extract_result(stdout.read().decode())
            if stdout.channel.recv_exit_status() or not result["status"]:
                raise RuntimeError("account_release_formal_failure:" + json.dumps(result))
        health = deploy["verify_public"](build)
        verify_public_retired_pages()
        health["retiredPages"] = True
        return dict(result, health=health)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--execute", action="store_true")
    action.add_argument("--inspect-crawler", action="store_true")
    parser.add_argument("--expected-previous-sha")
    parser.add_argument("--plan-sha256")
    args = parser.parse_args()
    scripts = pathlib.Path(__file__).resolve().parent
    if args.inspect_crawler:
        if args.expected_previous_sha or args.plan_sha256:
            parser.error("--inspect-crawler does not accept release SHA arguments")
        deploy = runpy.run_path(str(scripts / "deploy-baota.py"))
        with project_ssh(deploy) as ssh:
            print(json.dumps(probe_standalone_crawler(ssh, deploy, scripts)))
    else:
        if not args.expected_previous_sha or not args.plan_sha256:
            parser.error("--execute requires both expected SHA arguments")
        print(json.dumps(execute(scripts.parent, args.expected_previous_sha, args.plan_sha256)))


if __name__ == "__main__":
    main()
