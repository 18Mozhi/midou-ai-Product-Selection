"""Reusable, no-backup writer drain from the fixed BaoTa baseline runtime gate."""

import json
import subprocess
import time
import uuid


WORKER_SNAPSHOT = r'''
const fs=require("node:fs"), e=process.env;
const path=require("node:path");
function readWorkerActivity(root, workerStartedMs) {
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
    return { observed_at: data.observed_at, worker_active: data.active_runs,
      intelligence_active: data.queues.find(q=>q.name==="trend_projection").active_runs };
  } finally {fs.closeSync(fd);}
}
'''

DRAIN_PROBE = WORKER_SNAPSHOT + r'''
const mysql=require("mysql2/promise");
const [root, owner, workerStartedMs] = process.argv.slice(1);
if(e.DB_HOST!=="127.0.0.1" || e.DB_NAME!=="product_scout" || e.DB_USER!=="product_scout") throw Error("release_drain_identity_mismatch");
function assertOwner() {
  const file=root+"/runtime/verification/collection-claims.pause";
  if(!fs.lstatSync(file).isFile() || JSON.parse(fs.readFileSync(file,"utf8")).maintenanceId!==owner) throw Error("release_drain_owner_mismatch");
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
    const {worker_active, intelligence_active}=readWorkerActivity(root,workerStartedMs);
    console.log(JSON.stringify({...d,worker_active,intelligence_active}));
  } finally {try {await c.rollback();} finally {await c.end();}}
})().catch(error=>{console.error(/^release_[a-z_]+$/.test(error.message)?error.message:"release_drain_probe_failed");process.exitCode=1;});
'''

ACTIVE_PROBE = WORKER_SNAPSHOT + r'''
const [root, build, workerStartedMs] = process.argv.slice(1);
if (e.BUILD_SHA!==build || e.ACCOUNT_SCOPE_MODE!=="retired" ||
    e.RELEASE_SOURCE_MIGRATION_VERSION!=="0197_retire_tenancy_roots.up.sql")
  throw Error("account_release_worker_env_identity_mismatch");
console.log(JSON.stringify(readWorkerActivity(root,workerStartedMs)));
'''


DRAIN_KEYS = frozenset({"in_flight", "scheduler_leases", "profile_leases", "browser_leased",
                        "business_leases", "worker_active", "intelligence_active"})


def verify_collection_drained(probe, *, attempts=65, sleep=time.sleep):
    consecutive = 0
    for index in range(attempts):
        state = probe()
        if set(state) != DRAIN_KEYS or any(type(value) is not int or value < 0 for value in state.values()):
            raise RuntimeError("account_release_drain_sample_invalid")
        consecutive = consecutive + 1 if all(value == 0 for value in state.values()) else 0
        if consecutive == 4:
            return
        if index + 1 < attempts:
            sleep(2)
    raise RuntimeError("account_release_worker_drain_timeout")


class BaselineClaimDrain:
    def __init__(self, root, node):
        self.root = root
        self.backend = root / "backend"
        self.command = [node, "--env-file=" + str(root / "config/product_scout.env"),
                        "--env-file=" + str(root / "config/release.env")]
        self.owner = str(uuid.uuid4())
        self.pause_attempted = False

    def read_json(self, arguments, failure):
        result = subprocess.run([*self.command, *arguments], cwd=str(self.backend),
                                capture_output=True, timeout=20)
        if result.returncode:
            raise RuntimeError(failure)
        try:
            output = json.loads(result.stdout)
        except ValueError:
            raise RuntimeError(failure) from None
        if not isinstance(output, dict):
            raise RuntimeError(failure)
        return output

    def claim_action(self, action):
        entry = self.backend / "scripts/collection-claim-maintenance.mjs"
        if not entry.is_file() or entry.resolve() != entry:
            raise RuntimeError("account_release_baseline_claim_tool_missing")
        args = [str(entry), action]
        if action != "status":
            args.append(self.owner)
        result = self.read_json(args, "account_release_claim_control_failed")
        if (set(result) != {"action", "paused", "maintenanceId"} or result["action"] != action or
                type(result["paused"]) is not bool):
            raise RuntimeError("account_release_claim_control_invalid")
        return result

    def pause(self):
        if self.claim_action("status")["paused"]:
            raise RuntimeError("account_release_collection_already_paused")
        # A command can complete remotely even if its response is unreadable:
        # record the attempt first, then reconcile our exact owner on unwind.
        self.pause_attempted = True
        result = self.claim_action("pause")
        if result["paused"] is not True or result["maintenanceId"] != self.owner:
            raise RuntimeError("account_release_collection_pause_unverified")

    def resume_owned(self):
        if not self.pause_attempted:
            return
        status = self.claim_action("status")
        if status["paused"]:
            if status["maintenanceId"] != self.owner:
                raise RuntimeError("account_release_collection_pause_owner_changed")
            result = self.claim_action("resume")
            if result["paused"] or result["maintenanceId"] != self.owner:
                raise RuntimeError("account_release_collection_resume_unverified")
        self.pause_attempted = False

    def worker_identities(self):
        import psutil

        matches = []
        entry = "apps/worker/dist/index.js"
        for proc in psutil.process_iter(["cmdline", "cwd", "create_time", "status"]):
            info = proc.info
            if (info["cwd"] == str(self.backend) and info["status"] != psutil.STATUS_ZOMBIE
                    and any(x in {entry, str(self.backend / entry)} for x in info["cmdline"] or [])):
                matches.append((proc.pid, int(info["create_time"] * 1000)))
        return matches

    def sample(self):
        if self.worker_identities() != self.worker_baseline:
            raise RuntimeError("account_release_worker_identity_changed")
        sample = self.read_json(
            ["-e", DRAIN_PROBE, str(self.root), self.owner, str(self.worker_baseline[0][1])],
            "account_release_worker_drain_probe_failed",
        )
        if self.worker_identities() != self.worker_baseline:
            raise RuntimeError("account_release_worker_identity_changed")
        return sample

    def drain(self):
        self.worker_baseline = self.worker_identities()
        if len(self.worker_baseline) != 1:
            raise RuntimeError("account_release_worker_identity_unverified")
        verify_collection_drained(self.sample)

    def verify_final(self):
        sample = self.sample()
        if set(sample) != DRAIN_KEYS or any(type(value) is not int or value != 0 for value in sample.values()):
            raise RuntimeError("account_release_worker_not_drained_at_stop")

    def active_sample(self, build, identity):
        import psutil

        proc = psutil.Process(identity[0])
        env = proc.environ()
        if env.get("BUILD_SHA") != build or env.get("ACCOUNT_SCOPE_MODE") != "retired":
            raise RuntimeError("account_release_worker_process_scope_mismatch")
        result = self.read_json(
            ["-e", ACTIVE_PROBE, str(self.root), build, str(identity[1])],
            "account_release_worker_snapshot_not_ready",
        )
        if self.worker_identities() != [identity]:
            raise RuntimeError("account_release_worker_identity_changed")
        stamp = result.get("observed_at")
        if not isinstance(stamp, str) or not stamp:
            raise RuntimeError("account_release_worker_snapshot_not_ready")
        return stamp

    def verify_active(self, build, *, attempts=20, sleep=time.sleep):
        import psutil

        first = None
        for index in range(attempts):
            workers = self.worker_identities()
            if len(workers) == 1:
                try:
                    stamp = self.active_sample(build, workers[0])
                except psutil.NoSuchProcess:
                    first = None
                except RuntimeError as error:
                    if str(error) != "account_release_worker_snapshot_not_ready":
                        raise
                    first = None
                else:
                    if first and first[0] == workers[0] and stamp > first[1]:
                        return
                    first = (workers[0], stamp)
            else:
                first = None
            if index + 1 < attempts:
                sleep(2)
        raise RuntimeError("account_release_worker_activation_unverified")
