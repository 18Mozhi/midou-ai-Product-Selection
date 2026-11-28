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

ACCOUNT_RELEASE_BASELINE_MIGRATION = "0076_collection_backlog_cancellation.up.sql"

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
    suffix=bool(args.get("interrupted"))
    with steps.lock(allow_existing=suffix):
        if args.get("runtime_recovery"):
            result=c["coordinate_installed_runtime_recovery"](steps,args["interrupted"],args["interrupted_plan"])
        elif suffix:
            result=c["coordinate_evidence_suffix"](steps,args["interrupted"],args["interrupted_plan"])
        else:
            result=c["coordinate_account_release"](steps)
except Exception as exc:
    import re
    reason=str(exc)
    result={"status":False,"phase":steps.phase,"reason":reason if re.fullmatch(r"account_[A-Za-z0-9_]+",reason) else type(exc).__name__}
print("SCOUTOPS_RESULT="+json.dumps(result),flush=True)
'''


def extract_result(output):
    lines = [line.removeprefix("SCOUTOPS_RESULT=") for line in output.splitlines() if line.startswith("SCOUTOPS_RESULT=")]
    if len(lines) != 1:
        raise RuntimeError("account_release_no_authoritative_response_check_state_before_retry")
    return json.loads(lines[0])


def transfer_exclusive(ssh, archive, destination, on_open=lambda: None):
    with ssh.open_sftp() as sftp:
        with archive.open("rb") as local, sftp.open(destination, "wxb") as remote:
            on_open()
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


def evidence_suffix_identity(repo, previous, plan, interrupted, interrupted_plan, records):
    import subprocess
    if (not re.fullmatch(r"[a-f0-9]{40}", interrupted or "") or interrupted == previous
            or not re.fullmatch(r"[a-f0-9]{64}", interrupted_plan or "") or interrupted_plan == plan
            or not re.fullmatch(r"[1-9][0-9]{0,19}", records or "")):
        raise RuntimeError("account_release_evidence_suffix_identity_invalid")
    names = subprocess.check_output(["git", "diff", "--name-only", interrupted, "HEAD", "--",
                                     "database/migrations"], cwd=repo, text=True).splitlines()
    expected = ["database/migrations/0190_evidence_account_scope." + direction + ".sql"
                for direction in ("down", "up")]
    # Never change an acknowledged receipt or any other pending script in this recovery.
    if names != expected or subprocess.run(
        ["git", "merge-base", "--is-ancestor", interrupted, "HEAD"], cwd=repo,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ).returncode:
        raise RuntimeError("account_release_evidence_suffix_migration_drift")
    return dict(interrupted=interrupted, interrupted_plan=interrupted_plan, sealed_records=records)


def runtime_recovery_identity(repo, previous, plan, interrupted, interrupted_plan, records):
    import subprocess
    if (not re.fullmatch(r"[a-f0-9]{40}", previous or "") or
            not re.fullmatch(r"[a-f0-9]{40}", interrupted or "") or interrupted == previous or
            not re.fullmatch(r"[a-f0-9]{64}", interrupted_plan or "") or interrupted_plan == plan or
            not re.fullmatch(r"[1-9][0-9]{0,19}", records or "")):
        raise RuntimeError("account_release_runtime_recovery_identity_invalid")
    if (subprocess.run(["git", "merge-base", "--is-ancestor", previous, "HEAD"], cwd=repo,
                       capture_output=True).returncode or
            subprocess.check_output(["git", "diff", "--name-only", previous, "HEAD", "--",
                                     "database/migrations", "packages/database/src/account-release-receipts.ts"],
                                    cwd=repo).strip()):
        raise RuntimeError("account_release_runtime_recovery_migration_drift")
    return dict(interrupted=interrupted, interrupted_plan=interrupted_plan, sealed_records=records,
                runtime_recovery=True)


def execute(repo, previous, plan, suffix=None):
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
            migration = package["MIGRATION"] if (suffix or {}).get("runtime_recovery") else ACCOUNT_RELEASE_BASELINE_MIGRATION
            if actual["build_sha"] != previous or actual["migration_version"] != migration:
                raise RuntimeError("account_release_live_baseline_changed")
            deploy["verify_production_sha_history"](repo, previous, build)
            require_drained_crawler(probe_standalone_crawler(ssh, deploy, scripts))
            destination = deploy["PROJECT_ROOT"] + "/config/account-upload-" + build + ".tar.gz"
            transfer_exclusive(ssh, archive, destination)
            source = remote_source(scripts, dict(build=build, previous=previous, plan=plan, archive_sha=digest,
                                                  **(suffix or {})))
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
    action.add_argument("--amazon-cookie-session", action="store_true")
    action.add_argument("--amazon-cookie-session-frontend", action="store_true")
    action.add_argument("--inspect-crawler", action="store_true")
    action.add_argument("--continue-evidence-suffix", action="store_true")
    action.add_argument("--recover-retired-runtime", action="store_true")
    action.add_argument("--frontend-only", action="store_true")
    action.add_argument("--collection-controls-node", action="store_true")
    action.add_argument("--collection-controls-node-rollback", action="store_true")
    action.add_argument("--collection-executor-only", action="store_true")
    action.add_argument("--collection-executor-rollback", action="store_true")
    action.add_argument("--collection-browser-only", action="store_true")
    action.add_argument("--collection-browser-rollback", action="store_true")
    action.add_argument("--collection-executor-lock-only", action="store_true")
    action.add_argument("--collection-executor-lock-rollback", action="store_true")
    action.add_argument("--collection-evidence-only", action="store_true")
    action.add_argument("--collection-evidence-rollback", action="store_true")
    action.add_argument("--collection-rank-only", action="store_true")
    action.add_argument("--collection-rank-rollback", action="store_true")
    action.add_argument("--collection-detail-only", action="store_true")
    action.add_argument("--collection-detail-rollback", action="store_true")
    action.add_argument("--collection-detail-canonical-only", action="store_true")
    action.add_argument("--collection-detail-canonical-rollback", action="store_true")
    action.add_argument("--collection-lan-rate-only", action="store_true")
    action.add_argument("--collection-lan-rate-rollback", action="store_true")
    action.add_argument("--collection-lan-health-only", action="store_true")
    action.add_argument("--collection-lan-health-rollback", action="store_true")
    action.add_argument("--collection-model-hold-only", action="store_true")
    action.add_argument("--collection-model-hold-rollback", action="store_true")
    action.add_argument("--collection-search-ready-only", action="store_true")
    action.add_argument("--collection-search-ready-rollback", action="store_true")
    action.add_argument("--collection-maintenance-bootstrap", action="store_true")
    action.add_argument("--collection-dual-health-only", action="store_true")
    action.add_argument("--collection-dual-health-rollback", action="store_true")
    action.add_argument("--collection-manual-frame-only", action="store_true")
    action.add_argument("--collection-manual-frame-rollback", action="store_true")
    action.add_argument("--collection-viewport-evidence-only", action="store_true")
    action.add_argument("--collection-viewport-evidence-rollback", action="store_true")
    action.add_argument("--collection-screenshot-wait-only", action="store_true")
    action.add_argument("--collection-screenshot-wait-rollback", action="store_true")
    action.add_argument("--collection-capture-trace-only", action="store_true")
    action.add_argument("--collection-capture-trace-rollback", action="store_true")
    action.add_argument("--collection-checkpoint-only", action="store_true")
    action.add_argument("--collection-checkpoint-rollback", action="store_true")
    action.add_argument("--collection-sponsored-empty-only", action="store_true")
    action.add_argument("--collection-sponsored-empty-rollback", action="store_true")
    action.add_argument("--collection-python-transport-only", action="store_true")
    action.add_argument("--collection-python-transport-rollback", action="store_true")
    action.add_argument("--collection-relation-key-only", action="store_true")
    action.add_argument("--collection-relation-key-rollback", action="store_true")
    action.add_argument("--collection-delivery-ready-only", action="store_true")
    action.add_argument("--collection-delivery-ready-rollback", action="store_true")
    action.add_argument("--collection-delivery-observe-only", action="store_true")
    action.add_argument("--collection-delivery-observe-rollback", action="store_true")
    action.add_argument("--collection-manual-waf-only", action="store_true")
    action.add_argument("--collection-manual-waf-rollback", action="store_true")
    action.add_argument("--collection-handoff-routes-only", action="store_true")
    action.add_argument("--collection-handoff-routes-rollback", action="store_true")
    action.add_argument("--collection-handoff-only", action="store_true")
    action.add_argument("--collection-handoff-rollback", action="store_true")
    action.add_argument("--collection-delivery-daily-only", action="store_true")
    action.add_argument("--collection-delivery-daily-rollback", action="store_true")
    action.add_argument("--collection-controls-frontend", action="store_true")
    action.add_argument("--trend-projection-only", action="store_true")
    action.add_argument("--scheduler-stagger-only", action="store_true")
    action.add_argument("--scheduler-rollback-only", action="store_true")
    action.add_argument("--report-worker-only", action="store_true")
    action.add_argument("--amazon-health-api-only", action="store_true")
    action.add_argument("--amazon-health-audit-only", action="store_true")
    action.add_argument("--report-worker-rollback-only", action="store_true")
    parser.add_argument("--expected-previous-sha")
    parser.add_argument("--expected-module-sha256")
    parser.add_argument("--expected-scheduler-sha256")
    parser.add_argument("--expected-registry-sha256")
    parser.add_argument("--plan-sha256")
    parser.add_argument("--interrupted-build-sha")
    parser.add_argument("--interrupted-plan-sha256")
    parser.add_argument("--sealed-records")
    args = parser.parse_args()
    scripts = pathlib.Path(__file__).resolve().parent
    suffix_args = (args.interrupted_build_sha, args.interrupted_plan_sha256, args.sealed_records)
    if not (args.continue_evidence_suffix or args.recover_retired_runtime) and any(suffix_args):
        parser.error("interruption arguments require a cutover recovery action")
    if args.amazon_cookie_session or args.amazon_cookie_session_frontend:
        cookie = runpy.run_path(str(scripts / "baota-amazon-cookie-release.py"))
        if (args.expected_previous_sha != cookie["RUNTIME_BASE"] or
                args.expected_module_sha256 != cookie["BASE_HASHES"][cookie["ENGINE"]] or args.plan_sha256):
            parser.error("Cookie release requires exact runtime/engine baseline; no migrations")
        print(json.dumps(cookie["publish"](scripts.parent, deploy=runpy.run_path(str(scripts / "deploy-baota.py")),
              ssh_connection=project_ssh, transfer=transfer_exclusive,
              frontend_only=args.amazon_cookie_session_frontend)))
        return
    scheduler_only = args.scheduler_stagger_only or args.scheduler_rollback_only
    report_action = "apply" if args.report_worker_only else "restore" if args.report_worker_rollback_only else None
    collection = "apply" if args.collection_controls_node else "restore" if args.collection_controls_node_rollback else None
    if args.collection_executor_only or args.collection_executor_rollback:
        collection = "executor" if args.collection_executor_only else "executor_restore"
    if args.collection_browser_only or args.collection_browser_rollback:
        collection = "browser" if args.collection_browser_only else "browser_restore"
    if args.collection_executor_lock_only or args.collection_executor_lock_rollback:
        collection = "executor_lock" if args.collection_executor_lock_only else "executor_lock_restore"
    if args.collection_evidence_only or args.collection_evidence_rollback:
        collection = "evidence" if args.collection_evidence_only else "evidence_restore"
    if args.collection_rank_only or args.collection_rank_rollback:
        collection = "rank" if args.collection_rank_only else "rank_restore"
    if args.collection_detail_only or args.collection_detail_rollback:
        collection = "detail" if args.collection_detail_only else "detail_restore"
    if args.collection_detail_canonical_only or args.collection_detail_canonical_rollback:
        collection = "detail_canonical" if args.collection_detail_canonical_only else "detail_canonical_restore"
    if args.collection_lan_rate_only or args.collection_lan_rate_rollback:
        collection = "lan_rate" if args.collection_lan_rate_only else "lan_rate_restore"
    if args.collection_lan_health_only or args.collection_lan_health_rollback:
        collection = "lan_health" if args.collection_lan_health_only else "lan_health_restore"
    if args.collection_model_hold_only or args.collection_model_hold_rollback:
        collection = "model_hold" if args.collection_model_hold_only else "model_hold_restore"
    if args.collection_delivery_daily_only or args.collection_delivery_daily_rollback:
        collection = "delivery_daily" if args.collection_delivery_daily_only else "delivery_daily_restore"
    if args.collection_handoff_only or args.collection_handoff_rollback:
        collection = "handoff" if args.collection_handoff_only else "handoff_restore"
    if args.collection_handoff_routes_only or args.collection_handoff_routes_rollback:
        collection = "handoff_routes" if args.collection_handoff_routes_only else "handoff_routes_restore"
    if args.collection_manual_waf_only or args.collection_manual_waf_rollback:
        collection = "manual_waf" if args.collection_manual_waf_only else "manual_waf_restore"
    if args.collection_delivery_observe_only or args.collection_delivery_observe_rollback:
        collection = "delivery_observe" if args.collection_delivery_observe_only else "delivery_observe_restore"
    if args.collection_delivery_ready_only or args.collection_delivery_ready_rollback:
        collection = "delivery_ready" if args.collection_delivery_ready_only else "delivery_ready_restore"
    if args.collection_search_ready_only or args.collection_search_ready_rollback:
        collection = "search_ready" if args.collection_search_ready_only else "search_ready_restore"
    if args.collection_relation_key_only or args.collection_relation_key_rollback:
        collection = "relation_key" if args.collection_relation_key_only else "relation_key_restore"
    if args.collection_python_transport_only or args.collection_python_transport_rollback:
        collection = "python_transport" if args.collection_python_transport_only else "python_transport_restore"
    if args.collection_sponsored_empty_only or args.collection_sponsored_empty_rollback:
        collection = "sponsored_empty" if args.collection_sponsored_empty_only else "sponsored_empty_restore"
    if args.collection_checkpoint_only or args.collection_checkpoint_rollback:
        collection = "checkpoint" if args.collection_checkpoint_only else "checkpoint_restore"
    if args.collection_dual_health_only or args.collection_dual_health_rollback:
        collection = "dual_health" if args.collection_dual_health_only else "dual_health_restore"
    if args.collection_maintenance_bootstrap:
        collection = "maintenance_bootstrap"
    if args.collection_capture_trace_only or args.collection_capture_trace_rollback:
        collection = "capture_trace" if args.collection_capture_trace_only else "capture_trace_restore"
    if args.collection_screenshot_wait_only or args.collection_screenshot_wait_rollback:
        collection = "screenshot_wait" if args.collection_screenshot_wait_only else "screenshot_wait_restore"
    if args.collection_viewport_evidence_only or args.collection_viewport_evidence_rollback:
        collection = "viewport_evidence" if args.collection_viewport_evidence_only else "viewport_evidence_restore"
    if args.collection_manual_frame_only or args.collection_manual_frame_rollback:
        collection = "manual_frame" if args.collection_manual_frame_only else "manual_frame_restore"
    worker_only = (args.trend_projection_only or scheduler_only or report_action is not None
                   or args.amazon_health_api_only or args.amazon_health_audit_only or collection is not None)
    if args.expected_module_sha256 and not worker_only:
        parser.error("--expected-module-sha256 requires a Worker module release")
    scheduler_hashes = (args.expected_scheduler_sha256, args.expected_registry_sha256)
    if scheduler_only != bool(all(scheduler_hashes)) or (
        not scheduler_only and any(scheduler_hashes)
    ):
        parser.error("Scheduler releases require both expected scheduler and registry hashes")
    if worker_only:
        if args.plan_sha256 or not args.expected_previous_sha or not args.expected_module_sha256:
            parser.error("Worker module releases require expected base and module hashes and do not execute migrations")
        deploy = runpy.run_path(str(scripts / "deploy-baota.py"))
        trend = runpy.run_path(str(scripts / "baota-account-trend-release.py"))
        scheduler = dict(zip(trend["SCHEDULER_FILES"], scheduler_hashes)) if scheduler_only else None
        print(json.dumps(trend["publish"](scripts.parent, args.expected_previous_sha, args.expected_module_sha256,
                                         deploy, project_ssh, scheduler, args.scheduler_rollback_only, report_action,
                                         args.amazon_health_api_only, args.amazon_health_audit_only, collection)))
    elif args.frontend_only or args.collection_controls_frontend:
        if args.plan_sha256:
            parser.error("--frontend-only does not execute migrations")
        deploy = runpy.run_path(str(scripts / "deploy-baota.py"))
        static = runpy.run_path(str(scripts / "baota-account-static-release.py"))
        if args.collection_controls_frontend:
            modules = runpy.run_path(str(scripts / "baota-account-trend-release.py"))
            if args.expected_previous_sha != modules["REPORT_RUNTIME_BASE"]:
                parser.error("Collection controls require their pinned runtime baseline")
        else:
            modules = None
        print(json.dumps(static["deploy_static"](scripts.parent, args.expected_previous_sha,
                                                deploy, project_ssh, transfer_exclusive, modules)))
    elif args.inspect_crawler:
        if args.expected_previous_sha or args.plan_sha256:
            parser.error("--inspect-crawler does not accept release SHA arguments")
        deploy = runpy.run_path(str(scripts / "deploy-baota.py"))
        with project_ssh(deploy) as ssh:
            print(json.dumps(probe_standalone_crawler(ssh, deploy, scripts)))
    else:
        if not args.expected_previous_sha or not args.plan_sha256:
            parser.error("--execute requires both expected SHA arguments")
        identity = (runtime_recovery_identity if args.recover_retired_runtime
                    else evidence_suffix_identity if args.continue_evidence_suffix else None)
        suffix = identity(scripts.parent, args.expected_previous_sha, args.plan_sha256,
                          *suffix_args) if identity else None
        print(json.dumps(execute(scripts.parent, args.expected_previous_sha, args.plan_sha256, suffix)))


if __name__ == "__main__":
    main()
