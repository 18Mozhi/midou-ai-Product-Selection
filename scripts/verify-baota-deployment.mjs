import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertBrowserHelperArchive } from "./browser-helper-archive.mjs";

const root = process.cwd();
const id = randomUUID();
const production = process.argv.includes("--production");
const fail = (code, message, status = "failed") => {
  console.error(
    JSON.stringify(
      { module: "M07-03", status, code, message, request_id: id, trace_id: id },
      null,
      2,
    ),
  );
  process.exit(status === "blocked" ? 2 : 1);
};

let manifest;
try {
  manifest = JSON.parse(await readFile(resolve(root, "infra/baota/service-manifest.json"), "utf8"));
} catch {
  fail("manifest_invalid", "infra/baota/service-manifest.json is missing or invalid JSON");
}

if (manifest.schemaVersion !== 4 || manifest.stage !== "production")
  fail("manifest_contract_invalid", "production schemaVersion 4 is required");
if (manifest.target?.host !== "192.168.1.220" || manifest.target?.domain !== "midouai.medouai.com")
  fail("target_contract_invalid", "locked production host or domain is missing");
if (manifest.target?.deployRoot !== "/www/wwwroot/ai选品")
  fail("deploy_root_invalid", "production deploy root must be /www/wwwroot/ai选品");
const expected = [
  "ai选品网站",
  "ai选品",
  "ai选品-python",
  "ai选品数据库",
  "ai选品缓存",
  "ai选品备份",
];
for (const name of expected)
  if (!manifest.objects.some((item) => item.name === name)) fail("panel_object_missing", name);
const nodeProjects = manifest.objects.filter((item) => item.kind === "baota-node-project");
if (
  nodeProjects.length !== 1 ||
  nodeProjects[0]?.name !== "ai选品" ||
  nodeProjects[0]?.processMode !== "foreground" ||
  nodeProjects[0]?.workingDirectory !== "/www/wwwroot/ai选品/backend" ||
  !nodeProjects[0]?.startCommand.startsWith(
    "node --env-file=/www/wwwroot/ai选品/config/product_scout.env ",
  )
)
  fail(
    "single_backend_invalid",
    "exactly one fixed-directory foreground ai选品 backend is required",
  );
const pythonProjects = manifest.objects.filter((item) => item.kind === "baota-python-project");
if (
  pythonProjects.length !== 1 ||
  pythonProjects[0]?.name !== "ai选品-python" ||
  pythonProjects[0]?.workingDirectory !== "/www/wwwroot/ai选品/python" ||
  pythonProjects[0]?.pythonVersion !== "3.12.13" ||
  pythonProjects[0]?.startCommand !==
    "python -m scoutops_crawler --env-file=/www/wwwroot/ai选品/config/product_scout.env"
)
  fail(
    "python_project_invalid",
    "one fixed-directory BaoTa Python 3.12 crawler project with restricted env loading is required",
  );
const commands = manifest.objects
  .flatMap((item) => [item.startCommand, item.buildCommand, item.command])
  .filter(Boolean)
  .join("\n");
if (/systemctl|\bpm2\b|crontab|docker[ -]compose/i.test(commands))
  fail("external_manager_forbidden", "panel-external production manager found");
for (const item of manifest.objects.filter((object) => !object.public && object.port))
  if (item.bind !== "127.0.0.1") fail("private_bind_invalid", item.name);
if (
  manifest.restrictedConfig?.secretValuesInManifest !== false ||
  manifest.restrictedConfig?.browserAllowlist?.join(",") !== "VITE_API_BASE_URL"
)
  fail("restricted_config_invalid", "restricted configuration boundary is missing");
if (!manifest.logging?.managedInBaota || manifest.logging.forbiddenFields.length < 6)
  fail("logging_contract_invalid", "Baota logging and secret exclusions are required");
const nginx = await readFile(resolve(root, "infra/baota/nginx/scoutops.conf.template"), "utf8");
for (const token of [
  "server_name midouai.medouai.com",
  "location /api/",
  "location /open/",
  "location /api/v1/realtime/events",
  "proxy_buffering off",
  "127.0.0.1:4101",
  "include /www/wwwroot/ai选品/config/nginx-spa-routes.conf",
  "error_page 404 /index.html",
  "try_files $uri $uri/ =404",
])
  if (!nginx.includes(token)) fail("nginx_contract_invalid", token);
for (const file of [
  "apps/web/dist/index.html",
  "apps/web/dist/browser-helper/scoutops-browser-helper.zip",
  "apps/api/dist/server.js",
  "apps/worker/dist/index.js",
  "apps/backend/dist/server.js",
  "apps/crawler/scoutops_crawler/__main__.py",
  "scripts/deploy-baota.py",
  "config/env.example",
  "config/schema.json",
])
  await access(resolve(root, file));
for (const archive of [
  "apps/web/public/browser-helper/scoutops-browser-helper.zip",
  "apps/web/dist/browser-helper/scoutops-browser-helper.zip",
])
  try {
    await assertBrowserHelperArchive(resolve(root, archive), root);
  } catch (error) {
    fail(
      "browser_helper_archive_stale",
      `${archive}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
const deployer = await readFile(resolve(root, "scripts/deploy-baota.py"), "utf8");
if (
  !deployer.includes('PROJECT_ROOT = "/www/wwwroot/ai选品"') ||
  !deployer.includes("TemporaryDirectory") ||
  /git (pull|clone|checkout)/.test(deployer)
)
  fail(
    "local_upload_contract_invalid",
    "deployment must build locally, upload a bounded runtime package and clean temporary artifacts",
  );
if (
  !deployer.includes('shutil.chown(runtime, user="root", group="www")') ||
  !deployer.includes("os.chmod(runtime, 0o2770)") ||
  !deployer.includes('shutil.chown(destination, user="root", group="www")') ||
  !deployer.includes("os.chmod(destination, 0o2770)")
)
  fail(
    "runtime_permission_contract_invalid",
    "BaoTa runtime and fixed writable subdirectories must be root:www with setgid group write",
  );
if (
  !deployer.includes('shutil.chown(config, user="root", group="www")') ||
  !deployer.includes("os.chmod(config, 0o750)") ||
  !deployer.includes('shutil.chown(env_file, user="root", group="www")') ||
  !deployer.includes('shutil.chown(release_file, user="root", group="www")')
)
  fail(
    "restricted_config_permission_contract_invalid",
    "BaoTa restricted config must stay root:www so www-managed Node and Python projects can read 0640 environment files",
  );

if (!production) {
  console.log(
    JSON.stringify(
      {
        module: "M07-03",
        status: "preflight_passed",
        production_deployed: manifest.productionDeployed === true,
        objects: expected.length,
        request_id: id,
        trace_id: id,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const evidencePath = resolve(root, manifest.productionEvidence.path);
let evidence;
try {
  evidence = JSON.parse(await readFile(evidencePath, "utf8"));
} catch {
  fail(
    "production_evidence_missing",
    `Run the Baota deployment and write sanitized evidence to ${manifest.productionEvidence.path}`,
    "blocked",
  );
}
if (manifest.productionDeployed !== true || manifest.deploymentStatus !== "healthy")
  fail(
    "production_not_signed",
    "manifest is not signed as a healthy production deployment",
    "blocked",
  );
if (
  evidence.schemaVersion !== 2 ||
  evidence.target?.host !== manifest.target.host ||
  evidence.target?.domain !== manifest.target.domain ||
  evidence.target?.deployRoot !== manifest.target.deployRoot
)
  fail("production_evidence_target_invalid", "production evidence target mismatch");
const gitHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
if (gitHead.status !== 0 || evidence.release?.commit !== gitHead.stdout.trim())
  fail(
    "production_release_mismatch",
    "production evidence must identify the current Git commit",
    "blocked",
  );
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (
  evidence.release?.appVersion !== packageJson.version ||
  !/^[a-f0-9]{64}$/.test(evidence.release?.configFingerprint ?? "") ||
  typeof evidence.release?.migrationVersion !== "string" ||
  !evidence.release.migrationVersion.endsWith(".up.sql")
)
  fail(
    "production_release_identity_invalid",
    "version, config fingerprint or migration identity is invalid",
  );
if (
  !Array.isArray(evidence.panelObjects) ||
  expected.some((name) => !evidence.panelObjects.includes(name))
)
  fail("production_panel_objects_incomplete", "Baota object inventory is incomplete");
if (
  evidence.dependencies?.mysqlVersion !== "5.7" ||
  evidence.dependencies?.mysqlCharset !== "utf8mb4" ||
  evidence.dependencies?.redisLocalOnly !== true
)
  fail("production_dependencies_invalid", "MySQL 5.7/utf8mb4 or local Redis evidence missing");
if (
  ![
    evidence.health?.live,
    evidence.health?.ready,
    evidence.health?.version,
    evidence.runtime?.backend,
    evidence.runtime?.worker,
    evidence.runtime?.python,
    evidence.logging?.panelVisible,
    evidence.logging?.rotationConfigured,
    evidence.logging?.secretScanPassed,
  ].every(Boolean)
)
  fail(
    "production_health_incomplete",
    "backend runtime, worker heartbeat, Python heartbeat or logging evidence is incomplete",
  );
if (!Number.isFinite(Date.parse(evidence.capturedAt)))
  fail("production_evidence_time_invalid", "capturedAt must be an ISO date-time");
console.log(
  JSON.stringify(
    {
      module: "M07-03",
      status: "passed",
      production_deployed: true,
      release: evidence.release,
      request_id: id,
      trace_id: id,
    },
    null,
    2,
  ),
);
