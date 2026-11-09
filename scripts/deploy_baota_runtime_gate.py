"""Internal helpers for the fixed ScoutOps BaoTa full-runtime release."""

from __future__ import annotations

import json
import shlex
import time
from datetime import datetime, timezone


NODE_TERM_ONLY = r'''
import psutil
def live(p):
    try:
        return p.is_running() and p.status() != psutil.STATUS_ZOMBIE
    except psutil.NoSuchProcess:
        return False

def until_exit(p, budget):
    deadline=time.monotonic()+budget
    last_alive=time.monotonic()
    while live(p):
        last_alive=time.monotonic()
        if last_alive>=deadline:
            raise RuntimeError("graceful_node_timeout_pid_"+str(p.pid))
        time.sleep(0.008)
    return last_alive

def node_term_only(get=None,pids=None):
    expected=str(root/"backend")
    candidates=[psutil.Process(p) for p in sorted(set(pids or []))]
    def match(p,mark):
        return p.cwd()==expected and any(x==mark or x==expected+"/"+mark for x in p.cmdline())
    parents=[p for p in candidates if match(p,"apps/backend/dist/server.js")]
    if len(parents)!=1:
        raise RuntimeError("graceful_node_supervisor_identity_mismatch")
    parent=parents[0]
    direct=parent.children()
    workers=[p for p in direct if match(p,"apps/worker/dist/index.js")]
    apis=[p for p in direct if match(p,"apps/api/dist/server.js")]
    if len(workers)!=1 or len(apis)!=1 or len(direct)!=2 or set(p.pid for p in parent.children(recursive=True))!=set(p.pid for p in direct) or set(p.pid for p in candidates)!={parent.pid,workers[0].pid,apis[0].pid}:
        raise RuntimeError("graceful_node_child_identity_mismatch")
    restart=float(parent.environ().get("BACKEND_RESTART_INITIAL_DELAY_MS","1000"))
    if restart<1000 or float(parent.environ().get("BACKEND_RESTART_MAX_DELAY_MS","30000"))<1000:
        raise RuntimeError("graceful_node_restart_window_too_short")
    worker,api=workers[0],apis[0]
    final_drain = globals().get("verify_final_drain")
    if final_drain is not None:
        final_drain(worker)
    worker.terminate()
    last_worker_alive=until_exit(worker,65)
    if time.monotonic()-last_worker_alive>0.15 or set(p.pid for p in parent.children() if live(p))!={api.pid}:
        raise RuntimeError("graceful_node_worker_replacement_detected")
    api.terminate()
    until_exit(api,0.30)
    if time.monotonic()-last_worker_alive>0.60 or any(live(p) for p in parent.children()):
        raise RuntimeError("graceful_node_supervisor_children_remain")
    parent.terminate()
    until_exit(parent,4)
    print("GRACEFUL_NODE=worker_drained,api_exited,supervisor_exited,SIGTERM_only")

def install_node_term_only(model, project_name, expected_command):
    project=model.get_project_find(project_name)
    configured=(project or {}).get("project_config", {}).get("project_script", "")
    if configured.split()!=expected_command.split() or (project or {}).get("path")!=str(root/"backend"):
        raise RuntimeError("graceful_node_baota_command_mismatch")
    model.kill_pids=node_term_only
'''

PYTHON_TERM_ONLY = r'''
import time, psutil
def python_term_only(pids=None):
    approved={str(root/"python"),str(rollback/"python")}
    processes=[]
    for pid in set(pids or []):
        try:
            p=psutil.Process(pid)
            if p.status()!=psutil.STATUS_ZOMBIE: processes.append(p)
        except psutil.NoSuchProcess:
            pass
    if not processes:
        return
    targets=[p for p in processes if p.cwd() in approved and "scoutops_crawler" in p.cmdline() and "-m" in p.cmdline()]
    if len(targets)!=1:
        raise RuntimeError("graceful_python_process_identity_mismatch")
    target=targets[0]
    descendants=target.children(recursive=True)
    if set(p.pid for p in processes)-{target.pid}-set(p.pid for p in descendants):
        raise RuntimeError("graceful_python_unrelated_process_detected")
    target.terminate()
    _,alive=psutil.wait_procs([target]+descendants, timeout=65)
    if any(p.is_running() and p.status()!=psutil.STATUS_ZOMBIE for p in alive):
        raise RuntimeError("graceful_python_timeout_no_force")
    print("GRACEFUL_PYTHON=exited,SIGTERM_only")

PythonModel.kill_pids=staticmethod(python_term_only)

def fixed_python_manager():
    row=public.M("sites").where("name=?", (v["python_project"],)).find()
    if not row or row.get("project_type")!="Python" or row.get("path")!=str(root/"python"):
        raise RuntimeError("Python project identity or path mismatch")
    return PythonModel()

def stop_python_project():
    panel_ok(fixed_python_manager().only_stop_main_project(v["python_project"]), "stop Python gracefully")

def start_python_project():
    request=public.dict_obj(); request.name=v["python_project"]; request.project_name=v["python_project"]
    panel_ok(fixed_python_manager().StartProject(request), "start Python")

def restart_python_project():
    stop_python_project()
    start_python_project()
'''


# The witness is read-only, naturally processed by the new Worker. A lease and
# successful completion must belong to the same active-scope task after the gate began.
COLLECTION_WITNESS = r'''
const fs = require("node:fs"), mysql = require("mysql2/promise"), e = process.env;
const [root, sha, migration, since] = process.argv.slice(1);
if (process.cwd() !== root + "/backend" || e.BUILD_SHA !== sha ||
    e.NODE_ENV !== "production" || e.DB_HOST !== "127.0.0.1" ||
    e.DB_NAME !== "product_scout" || e.DB_USER !== "product_scout") {
  throw Error("release_witness_identity_mismatch");
}
const marker = root + "/runtime/verification/collection-claims.pause";
function assertResumed() {
  try { fs.lstatSync(marker); } catch (err) { if (err.code === "ENOENT") return; throw err; }
  throw Error("release_claims_still_paused");
}
(async () => {
  assertResumed();
  const c = await mysql.createConnection({host:e.DB_HOST,port:Number(e.DB_PORT||3306),
    user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME,connectTimeout:4000,dateStrings:true});
  try {
    await c.query("START TRANSACTION READ ONLY");
    // Match the Worker mysql2 Date binding for DATETIME columns. MySQL NOW()
    // can use a different session timezone and admit pre-release evidence.
    const [[clock]] = await c.query({sql:"SELECT CAST(? AS DATETIME(3)) observed_at, (SELECT COUNT(*) FROM schema_migrations WHERE name=?) migration",timeout:3500},[new Date(),migration]);
    if (clock.migration !== 1) throw Error("release_migration_not_verified");
    let result = false;
    if (since) {
      const [[row]] = await c.query({sql:"SELECT EXISTS (SELECT 1 FROM collection_tasks t JOIN organizations o ON o.id=t.organization_id AND o.status='active' JOIN workspaces w ON w.id=t.workspace_id AND w.organization_id=o.id AND w.status='active' WHERE t.status IN ('succeeded','completed_with_warnings') AND t.available_result_count>0 AND t.finished_at>=? AND EXISTS (SELECT 1 FROM collection_task_events ev WHERE ev.task_id=t.id AND ev.organization_id=t.organization_id AND ev.workspace_id=t.workspace_id AND ev.event_type='collection.task.leased' AND ev.actor_type='worker' AND ev.occurred_at>=? AND ev.occurred_at<=t.finished_at) LIMIT 1) witnessed",timeout:4500},[since,since]);
      result = row.witnessed === 1;
    }
    assertResumed();
    console.log(JSON.stringify({claimsResumed:true,migration:clock.migration,observedAt:clock.observed_at,witnessed:result}));
  } finally {
    await c.rollback();
    await c.end();
  }
})().catch(error => {
  console.error(/^release_[a-z_]+$/.test(error.message) ? error.message : "release_witness_query_failed");
  process.exitCode=1;
});
'''


def witness_command(root: str, node: str, sha: str, migration: str, since: str) -> str:
    argv = [
        node, f"--env-file={root}/config/product_scout.env",
        f"--env-file={root}/config/release.env", "-e", COLLECTION_WITNESS,
        root, sha, migration, since,
    ]
    return f"cd {shlex.quote(root + '/backend')} && {shlex.join(argv)}"


def claims_command(root: str, node: str, action: str, owner: str = "") -> str:
    if action not in {"status", "pause", "resume"} or (action == "status") == bool(owner):
        raise ValueError("invalid release claim maintenance action")
    argv = [node, f"--env-file={root}/config/product_scout.env",
            f"--env-file={root}/config/release.env", "scripts/collection-claim-maintenance.mjs", action]
    if owner:
        argv.append(owner)
    return f"cd {shlex.quote(root + '/backend')} && {shlex.join(argv)}"


DRAIN_PROBE = r'''
const fs=require("node:fs"), mysql=require("mysql2/promise"), e=process.env;
const path=require("node:path");
const [root, owner, workerStartedMs] = process.argv.slice(1);
if(e.DB_HOST!=="127.0.0.1" || e.DB_NAME!=="product_scout" || e.DB_USER!=="product_scout") throw Error("release_drain_identity_mismatch");
function assertOwner() {
  const file=root+"/runtime/verification/collection-claims.pause";
  if(!fs.lstatSync(file).isFile() || JSON.parse(fs.readFileSync(file,"utf8")).maintenanceId!==owner) throw Error("release_drain_owner_mismatch");
}
function readWorkerActivity() {
  const file=path.resolve(root+"/backend",e.WORKER_SCHEDULER_STATE_FILE || "./runtime/worker-scheduler.json");
  if(![path.resolve(root,"runtime"),path.resolve(root,"backend","runtime")].some(base=>file.startsWith(base+path.sep)) ||
      fs.realpathSync(file)!==file) throw Error("release_worker_snapshot_path_invalid");
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try {
    const stat=fs.fstatSync(fd);
    if(!stat.isFile() || stat.size<1 || stat.size>1024*1024) throw Error("release_worker_snapshot_invalid");
    const data=JSON.parse(fs.readFileSync(fd,"utf8"));
    const tick=Number(e.WORKER_SCHEDULER_TICK_MS||250);
    const observed=Date.parse(data.observed_at);
    const age=Date.now()-observed;
    if(!Number.isInteger(tick)||tick<100||tick>5000||!Number.isFinite(age)||age<0||
        age>Math.max(2000,tick*3)||observed<Number(workerStartedMs||0))
      throw Error("release_worker_snapshot_stale");
    const count=n=>Number.isSafeInteger(n)&&n>=0;
    if(data.status!=="running" || !Array.isArray(data.queues) ||
       !data.queues.some(q=>q.name==="trend_projection") ||
       !data.queues.some(q=>q.name==="collection_tasks") ||
       new Set(data.queues.map(q=>q.name)).size!==data.queues.length ||
       !data.queues.every(q=>typeof q.name==="string"&&count(q.active_runs)) ||
       !count(data.active_runs)||data.active_runs!==data.queues.reduce((n,q)=>n+q.active_runs,0))
      throw Error("release_worker_snapshot_invalid");
    return { worker_active: data.active_runs,
      intelligence_active: data.queues.find(q=>q.name==="trend_projection").active_runs };
  } finally {fs.closeSync(fd);}
}
const leasedTables=[
  ["trend_projection_jobs","'leased'"],
  ["opportunity_refresh_jobs","'leased','running'"],
  ...["outbox_events","opportunity_score_jobs","opportunity_profit_jobs",
      "competitor_snapshot_jobs","sourcing_projection_jobs","ai_analysis_requests",
      "approval_escalation_jobs","automation_executions","report_exports","webhook_deliveries",
      "automatic_selection_evaluations"].map(table=>[table,"'leased'"]),
];
(async()=>{
  assertOwner();
  const c=await mysql.createConnection({host:e.DB_HOST,port:Number(e.DB_PORT||3306),user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME,connectTimeout:4000});
  try {
    await c.query("START TRANSACTION READ ONLY");
    const sql = "SELECT (SELECT COUNT(*) FROM collection_tasks WHERE status IN ('leased','running','parsing','validating','persisted')) in_flight," +
      "(SELECT COUNT(*) FROM crawler_scheduler_leases WHERE expires_at>LEAST(NOW(3),CAST(? AS DATETIME(3)))) scheduler_leases," +
      "(SELECT COUNT(*) FROM crawler_profile_leases WHERE expires_at>LEAST(NOW(3),CAST(? AS DATETIME(3)))) profile_leases," +
      "(SELECT COUNT(*) FROM browser_collection_jobs WHERE status='leased') browser_leased," +
      "(" + leasedTables.map(([table,status])=>"(SELECT COUNT(*) FROM "+table+
        " WHERE status IN ("+status+") AND (lease_expires_at IS NULL OR lease_expires_at>LEAST(NOW(3),CAST(? AS DATETIME(3)))))").join("+") +
      ") business_leases";
    const now=new Date();
    const [[d]]=await c.query({sql,timeout:4000},Array(2+leasedTables.length).fill(now));
    assertOwner();
    console.log(JSON.stringify({...d,...readWorkerActivity()}));
  } finally {try {await c.rollback();} finally {await c.end();}}
})().catch(error=>{console.error(/^release_[a-z_]+$/.test(error.message)?error.message:"release_drain_probe_failed");process.exitCode=1;});
'''


def drain_argv(root: str, node: str, owner: str) -> list[str]:
    return [node, f"--env-file={root}/config/product_scout.env", "-e", DRAIN_PROBE, root, owner]


def drain_command(root: str, node: str, owner: str) -> str:
    return f"cd {shlex.quote(root + '/backend')} && {shlex.join(drain_argv(root, node, owner))}"


DRAIN_KEYS = frozenset({"in_flight", "scheduler_leases", "profile_leases", "browser_leased",
                        "business_leases", "worker_active", "intelligence_active"})


def verify_collection_drained(probe, *, attempts=65, sleep=time.sleep):
    consecutive = 0
    for index in range(attempts):
        state = probe()
        if set(state) != DRAIN_KEYS or any(type(value) is not int or value < 0 for value in state.values()):
            raise RuntimeError("release_drain_sample_invalid")
        consecutive = consecutive + 1 if all(value == 0 for value in state.values()) else 0
        if consecutive == 4:
            return
        if index + 1 < attempts:
            sleep(2)
    raise RuntimeError(f"release_worker_drain_timeout: {json.dumps(state, sort_keys=True)}")


def verify_after_claims_resume(health, witness, *, duration=600, interval=5, max_gap=20,
                               monotonic=time.monotonic, sleep=time.sleep):
    """One uninterrupted window; absence of real collection progress is not success."""
    first = witness("")
    if first.get("claimsResumed") is not True or first.get("migration") != 1 or not first.get("observedAt"):
        raise RuntimeError("release_resume_baseline_not_verified")
    since = first["observedAt"]
    start = monotonic()
    previous = start
    samples = 0
    witnessed = False
    while True:
        health()
        state = witness(since)
        if state.get("claimsResumed") is not True or state.get("migration") != 1:
            raise RuntimeError("release_claim_resume_or_migration_changed")
        now = monotonic()
        if now - previous > max_gap:
            raise RuntimeError("release_observation_gap_exceeded")
        samples += 1
        previous = now
        witnessed = witnessed or state.get("witnessed") is True
        if now - start >= duration:
            if not witnessed:
                raise RuntimeError("release_no_post_resume_collection_result")
            return {"claimsResumed": True, "samples": samples, "seconds": round(now - start, 2),
                    "collectionResult": True, "verifiedAt": datetime.now(timezone.utc).isoformat()}
        sleep(interval)

