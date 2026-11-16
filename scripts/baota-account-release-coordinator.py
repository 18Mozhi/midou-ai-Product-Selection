"""Drive the approved, no-backup account cutover on the fixed BaoTa host."""

import contextlib
import io
import json
import os
import pathlib
import re
import select
import subprocess

ROOT = pathlib.Path("/www/wwwroot/ai选品")
NODE = "/www/server/nodejs/v20.19.6/bin/node"
NGINX = "/www/server/nginx/sbin/nginx"
MIGRATION = "0197_retire_tenancy_roots.up.sql"


def check_scope_review(review):
    counts = review.get("scope_counts", {})
    records = review.get("record_counts_by_table_and_reason", {})
    reasons = {"shared", "unassigned", "exclusive_owner"}
    required = {"opportunities", "trend_topics", "trend_signals", "competitors", "raw_evidence",
                "collection_tasks", "score_rules", "cost_rules"}
    if (not re.fullmatch(r"[0-9a-f]{64}", review.get("review_sha256", "")) or
            not counts or not set(counts).issubset(reasons) or not required.issubset(records) or
            not all(isinstance(values, dict) and set(values).issubset(reasons) and
                    all(isinstance(value, str) and value.isdecimal() for value in values.values())
                    for values in [counts, *records.values()])):
        raise RuntimeError("account_release_unverified_scope_review")


def coordinate_account_release(steps):
    """Never launch old runtime after entering the potentially destructive step."""
    steps.stage()
    steps.prepare_dependencies_and_routes()
    steps.journal("prepared")
    apply_entered = False
    try:
        steps.quiesce()
        steps.journal("writers_stopped")
        with steps.database_session() as session:
            review = session.prepare()
            check_scope_review(review["review"])
            steps.journal("applying_database")
            apply_entered = True
            database = session.apply(review)
            steps.journal("database_verified")
            steps.install(database, session.fence)
            steps.journal("runtime_installed")
    except Exception:
        if not apply_entered:
            steps.restore_unchanged_baseline()
            steps.journal("baseline_ready_after_preapply_failure")
        raise
    steps.reload_routes()
    steps.activate()
    steps.journal("runtime_ready")
    steps.cleanup()
    return {"status": True, "phase": "runtime_ready", "build_sha": steps.build_sha,
            "migration_receipts": database["forward"]["receipt"]["applied"]}


class CutoverProcess:
    def __init__(self, process, plan_sha):
        self.process = process
        self.plan_sha = plan_sha

    def receive(self, expected, timeout):
        if not select.select([self.process.stdout], [], [], timeout)[0]:
            raise RuntimeError("account_release_database_response_timeout")
        line = self.process.stdout.readline(1024 * 1024)
        if not line.endswith(b"\n"):
            raise RuntimeError("account_release_database_session_lost")
        value = json.loads(line)
        if value.get("status") != expected:
            raise RuntimeError("account_release_database_response_mismatch")
        return value

    def command(self, action, **values):
        self.process.stdin.write((json.dumps(dict(action=action, **values)) + "\n").encode())
        self.process.stdin.flush()

    def prepare(self):
        self.command("prepare", plan_sha256=self.plan_sha)
        return self.receive("review_required", None)

    def apply(self, review):
        self.command("apply", run_id=review["run_id"], review_sha256=review["review"]["review_sha256"])
        return self.receive("database_verified", None)

    def fence(self):
        self.command("assert_fence")
        self.receive("fenced", 10)


class BaoTaRelease:
    def __init__(self, args, parts):
        self.parts = parts
        self.build_sha = args["build"]
        self.previous = args["previous"]
        self.plan = args["plan"]
        self.archive_sha = args["archive_sha"]
        self.upload = ROOT / "config" / ("account-upload-" + self.build_sha + ".tar.gz")
        self.log = ROOT / "config/account-release-state.json"
        self.inc = ROOT / "config/nginx-spa-routes.conf"
        self.site = pathlib.Path("/www/server/panel/vhost/nginx/midouai.medouai.com.conf")
        self.phase = "before_stage"

    def _panel(self, action):
        namespace = self.parts["control"]
        sha = self.build_sha if action == "activate" else self.previous if action == "resume_baseline" else None
        source = namespace["writer_control_source"](action, sha,
                                                    self.baseline if action == "resume_baseline" else None)
        std = io.StringIO()
        with contextlib.redirect_stdout(std):
            exec(source, {})
        result = next((line.split("=", 1)[1] for line in reversed(std.getvalue().splitlines())
                       if line.startswith("SCOUTOPS_RESULT=")), None)
        if not result:
            raise RuntimeError("account_release_baota_result_missing")
        return json.loads(result)

    @contextlib.contextmanager
    def lock(self):
        import fcntl

        path = ROOT / "config/account-release.lock"
        for root in (ROOT, ROOT / "config"):
            self.parts["install"]["canonical_directory"](root)
            if root.stat().st_uid != os.geteuid() or root.stat().st_mode & 0o022:
                raise RuntimeError("account_release_untrusted_root")
        fd = os.open(str(path), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "r+b") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if self.log.exists() or self.log.is_symlink():
                raise RuntimeError("account_release_existing_state_requires_reconciliation")
            yield

    def journal(self, phase):
        with self.log.open("xb" if self.phase == "before_stage" else "ab") as file:
            file.write((json.dumps({"phase": phase, "build_sha": self.build_sha, "plan_sha": self.plan}) + "\n").encode())
            file.flush()
            os.fsync(file.fileno())
        self.log.chmod(0o600)
        self.phase = phase

    def stage(self):
        checked = self._panel("inspect")
        if any(checked["backup_tasks"].values()) or not all(checked["panel_methods"].values()):
            raise RuntimeError("account_release_baota_preflight_failed")
        self.baseline = {"node": bool(checked["after"]["writers"]["node"] and checked["after"]["node_listener"]),
                         "python": bool(checked["after"]["writers"]["python"])}
        if not self.baseline["node"]:
            raise RuntimeError("account_release_baseline_node_not_observed")
        self.stage_path, _ = self.parts["stage"]["stage_verified_account_runtime"](
            self.upload, self.build_sha, self.plan, self.archive_sha,
            self.parts["package"]["verify_account_archive"],
        )

    def prepare_dependencies_and_routes(self):
        self.parts["install"]["prepare_runtime_dependencies"](self.stage_path, self.build_sha, self.previous)
        self.parts["install"]["sha256_file"](self.site)
        self.parts["install"]["sha256_file"](self.inc)
        if self.site.read_text(encoding="utf-8").count("include " + str(self.inc) + ";") != 1:
            raise RuntimeError("account_release_nginx_include_not_managed")
        route_file = self.stage_path / "backend/config/route-catalog.json"
        routes = json.loads(route_file.read_text(encoding="utf-8"))["routes"]
        patterns, fallback = [], 0
        for route in routes:
            path = route["path"]
            if route.get("acceptance") == "fallback":
                fallback += 1
                continue
            if not re.fullmatch(r"/(?:[a-zA-Z0-9_:/.-]+)?", path):
                raise RuntimeError("account_release_invalid_route_pattern")
            pattern = "/".join("[^/]+" if item.startswith(":") else re.escape(item).replace(r"\-", "-")
                               for item in path.split("/"))
            patterns.append(pattern if path == "/" else pattern + "/?")
        if fallback != 1 or not patterns or len(set(patterns)) != len(patterns):
            raise RuntimeError("account_release_invalid_route_catalog")
        self.routes = "location ~ ^(?:" + "|".join(sorted(patterns)) + ")$ {\n    try_files /index.html =404;\n}\n"
        self.nginx("-t")

    def nginx(self, *args):
        result = subprocess.run([NGINX, *args], capture_output=True, timeout=30)
        if result.returncode:
            raise RuntimeError("account_release_nginx_check_failed")

    def quiesce(self):
        self._panel("quiesce")

    def restore_unchanged_baseline(self):
        proof = r'''
import mysql from 'mysql2/promise';
const e=process.env, lock='scoutops:account-retirement:production';
if(e.DB_HOST!=='127.0.0.1'||e.DB_NAME!=='product_scout'||e.DB_USER!=='product_scout')process.exit(1);
const db=await mysql.createConnection({host:e.DB_HOST,port:Number(e.DB_PORT),database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
try {
 const [[guard]]=await db.query('SELECT GET_LOCK(?,0) acquired',[lock]);
 if(Number(guard.acquired)!==1)throw new Error('fence');
 const [[state]]=await db.query(`SELECT (SELECT COUNT(*) FROM schema_migrations WHERE SUBSTRING(name,1,4) BETWEEN '0080' AND '0197') applied,
 (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME IN ('organizations','workspaces')) roots,
 (SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cost_rule_approvals' AND COLUMN_NAME='approval_role') legacy_enum`);
 if(Number(state.applied)!==0||Number(state.roots)!==2||state.legacy_enum!=="enum('selection_manager','organization_admin')")throw new Error('cannot resume');
}finally{await db.end();}
'''
        result = subprocess.run([NODE, "--env-file=" + str(ROOT / "config/product_scout.env"),
                                 "--input-type=module", "-e", proof], cwd=str(ROOT / "backend"),
                                capture_output=True, timeout=30)
        if result.returncode:
            raise RuntimeError("account_release_legacy_resume_schema_not_verified")
        self._panel("resume_baseline")

    def assert_stopped(self):
        current = self._panel("inspect")
        if (any(current["after"]["writers"].values()) or current["after"]["node_listener"] or
                any(current["backup_tasks"].values())):
            raise RuntimeError("account_release_runtime_writers_reappeared")

    @contextlib.contextmanager
    def database_session(self):
        self.assert_stopped()
        backend = self.stage_path / "backend"
        modules = backend / "node_modules"
        if modules.exists() or modules.is_symlink():
            raise RuntimeError("account_release_candidate_node_modules_collision")
        modules.symlink_to(ROOT / "backend/node_modules", target_is_directory=True)
        process = None
        try:
            process = subprocess.Popen([NODE, "--env-file=" + str(ROOT / "config/product_scout.env"),
                str(backend / "scripts/serve-account-production-cutover.mjs"), "--fenced-stdio"],
                cwd=str(backend), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            session = CutoverProcess(process, self.plan)
            session.receive("fenced", 30)
            modules.unlink()  # mysql2 is loaded; do not leave this link for installation.
            yield session
            session.command("release")
            if process.wait(timeout=30):
                raise RuntimeError("account_release_database_session_exit_failed")
        finally:
            if modules.is_symlink():
                modules.unlink()
            if process is not None:
                process.stdin.close()
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
                process.stdout.close()

    def install(self, database, fence):
        def proof():
            self.assert_stopped()
            fence()
        self.parts["install"]["install_fixed_runtime"](self.stage_path, self.build_sha, self.previous, database, proof)

    def reload_routes(self):
        previous = self.inc.read_bytes()
        self.inc.write_text(self.routes, encoding="utf-8")
        try:
            self.nginx("-t")
            self.nginx("-s", "reload")
        except Exception:
            self.inc.write_bytes(previous)
            raise

    def activate(self):
        result = self._panel("activate")
        if result.get("account_routes_verified") is not True:
            raise RuntimeError("account_release_node_scope_proof_missing")

    def cleanup(self):
        (self.stage_path / "manifest.json").unlink()
        self.stage_path.rmdir()
        self.upload.unlink()
