import { randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = process.cwd();
const policy = JSON.parse(await readFile(resolve(root, "verification/security-gate.json"), "utf8"));
const runId = randomUUID();
const findings = [];
const checks = [];
const add = (check, file, line, code) => findings.push({ check, file, line, code });
const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean);
const sourceFiles = tracked.filter(
  (file) =>
    file !== "config/env.example" &&
    policy.sourceRoots.some((base) => file === base || file.startsWith(`${base}/`)) &&
    !policy.excludedSegments.some((part) => `/${file}/`.includes(part)),
);

function record(id, before) {
  checks.push({
    id,
    status: findings.length === before ? "passed" : "failed",
    findings: findings.length - before,
  });
}
let before = findings.length;
const audit = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  cwd: root,
  shell: true,
  encoding: "utf8",
  timeout: 120000,
});
let auditJson;
try {
  auditJson = JSON.parse(audit.stdout || "{}");
} catch {
  add("dependency-vulnerabilities", "package-lock.json", 1, "audit_output_invalid");
}
if (audit.status !== 0)
  add("dependency-vulnerabilities", "package-lock.json", 1, "audit_command_failed");
const counts = auditJson?.metadata?.vulnerabilities ?? {};
if (
  (counts.high ?? 0) > policy.dependencyAudit.maximumHigh ||
  (counts.critical ?? 0) > policy.dependencyAudit.maximumCritical
)
  add("dependency-vulnerabilities", "package-lock.json", 1, "audit_threshold_exceeded");
record("dependency-vulnerabilities", before);

before = findings.length;
for (const file of tracked) {
  const lower = file.toLowerCase();
  if (file === "config/env.example") continue;
  if (
    policy.trackedSecretFilePatterns.some(
      (pattern) => lower === pattern || lower.endsWith(pattern) || lower.includes(`/${pattern}`),
    )
  )
    add("tracked-secret-files", file, 1, "tracked_secret_file");
}
record("tracked-secret-files", before);

const contentByFile = new Map();
for (const file of sourceFiles) {
  try {
    contentByFile.set(file, await readFile(resolve(root, file), "utf8"));
  } catch {
    /* binary files are covered by filename policy */
  }
}
before = findings.length;
const secretPatterns = [
  /[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)\s*=\s*(?!['"]?(?:change-me|replace-me|test|mock|development|\$\{|$))[A-Za-z0-9_+/=-]{16,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /\b(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{16,}/g,
];
for (const [file, content] of contentByFile)
  for (const pattern of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) add("hardcoded-secret-signatures", file, 1, "secret_signature");
  }
record("hardcoded-secret-signatures", before);

const webFiles = [...contentByFile].filter(([file]) => file.startsWith("apps/web/src/"));
before = findings.length;
for (const [file, content] of webFiles)
  for (const [code, pattern] of [
    ["v_html", /\bv-html\b/],
    ["inner_html", /\.innerHTML\s*=/],
    ["document_write", /document\.write\s*\(/],
    ["dynamic_code", /(?:\beval|new Function)\s*\(/],
  ])
    if (pattern.test(content)) add("browser-dangerous-sinks", file, 1, code);
record("browser-dangerous-sinks", before);

before = findings.length;
for (const [file, content] of webFiles) {
  const localStorageCount = [...content.matchAll(/localStorage\./g)].length;
  const localStorageUses = [
    ...content.matchAll(/(?:window\.)?localStorage\.(getItem|setItem|removeItem)\(([^)\n]*)\)/g),
  ];
  const themePreferenceOnly =
    file === "apps/web/src/design/theme.ts" &&
    localStorageCount === 2 &&
    localStorageUses.length === 2 &&
    localStorageUses.some((match) => match[1] === "getItem") &&
    localStorageUses.some((match) => match[1] === "setItem") &&
    localStorageUses.every((match) => {
      const argumentsText = match[2].replace(/\s/g, "");
      return match[1] === "getItem"
        ? argumentsText === "themeStorageKey"
        : argumentsText === "themeStorageKey,theme";
    });
  const selectionJourneyProgressOnly =
    file === "apps/web/src/components/SelectionJourney.vue" &&
    localStorageCount === 6 &&
    localStorageUses.length === 6 &&
    content.includes('progressStorageKey = "scoutops.selection-journey.active-id"') &&
    content.includes("journeyIdPattern = /^[0-9a-f]{8}-") &&
    localStorageUses.filter((match) => match[1] === "getItem").length === 1 &&
    localStorageUses.filter((match) => match[1] === "setItem").length === 1 &&
    localStorageUses.filter((match) => match[1] === "removeItem").length === 4 &&
    localStorageUses.every((match) => {
      const argumentsText = match[2].replace(/\s/g, "");
      return match[1] === "setItem"
        ? argumentsText === "progressStorageKey,next.id"
        : argumentsText === "progressStorageKey";
    });
  if (localStorageCount > 0 && !themePreferenceOnly && !selectionJourneyProgressOnly)
    add("browser-sensitive-storage", file, 1, "local_storage_forbidden");
  const sessionUses = [...content.matchAll(/sessionStorage\.(?:getItem|setItem)\(([^\n]*)/g)];
  const notificationCursorOnly =
    file === "apps/web/src/components/NotificationCenter.vue" &&
    sessionUses.every((match) => match[1].includes("scoutops:last-event-id"));
  const realtimeMetricsOnly =
    file === "apps/web/src/realtime-client-metrics.ts" &&
    sessionUses.length === 2 &&
    content.includes('const storageKey = "scoutops:realtime-client-metrics"') &&
    sessionUses.every((match) => match[1].replace(/\s/g, "").startsWith("storageKey"));
  if (sessionUses.length && !notificationCursorOnly && !realtimeMetricsOnly)
    add("browser-sensitive-storage", file, 1, "session_storage_not_allowlisted");
}
record("browser-sensitive-storage", before);

before = findings.length;
for (const [file, content] of webFiles)
  for (const match of content.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/g))
    if (!/rel=["'][^"']*noopener[^"']*noreferrer[^"']*["']/.test(match[0]))
      add("external-link-opener", file, 1, "noopener_noreferrer_required");
record("external-link-opener", before);

const joinedApi = [...contentByFile]
  .filter(([file]) => file.startsWith("apps/api/src/") || file.startsWith("apps/worker/src/"))
  .map(([, content]) => content)
  .join("\n");
before = findings.length;
if (/\.query\s*\(\s*`[^`]*\$\{/.test(joinedApi) || /\.execute\s*\(\s*`[^`]*\$\{/.test(joinedApi))
  add("parameterized-sql-contract", "apps", 1, "sql_template_interpolation");
record("parameterized-sql-contract", before);

before = findings.length;
const apiContent = [...contentByFile]
  .filter(([file]) => file.startsWith("apps/api/src/"))
  .map(([, content]) => content)
  .join("\n");
if (
  !/SameSite=Strict/.test(apiContent) ||
  !/(assertOrigin|origin_forbidden|origin_not_allowed)/.test(apiContent)
)
  add("csrf-origin-contract", "apps/api/src", 1, "csrf_contract_missing");
record("csrf-origin-contract", before);

before = findings.length;
const webhookWorker = contentByFile.get("apps/worker/src/webhook-delivery-worker.ts") ?? "";
if (
  !/(dnsLookup|lookup)/.test(webhookWorker) ||
  !/(private|loopback|127|169.*254|192.*168)/i.test(webhookWorker) ||
  !/lookup:/.test(webhookWorker)
)
  add(
    "ssrf-webhook-contract",
    "apps/worker/src/webhook-delivery-worker.ts",
    1,
    "ssrf_dns_and_pinned_address_guard_missing",
  );
record("ssrf-webhook-contract", before);

before = findings.length;
if (/multipart|addContentTypeParser/.test(apiContent))
  add("upload-surface-contract", "apps/api/src", 1, "unreviewed_upload_surface");
record("upload-surface-contract", before);

before = findings.length;
const nginx = contentByFile.get("infra/baota/nginx/scoutops.conf.template") ?? "";
for (const header of [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-Frame-Options",
])
  if (!nginx.includes(header))
    add(
      "baota-edge-headers",
      "infra/baota/nginx/scoutops.conf.template",
      1,
      `missing_${header.toLowerCase()}`,
    );
if (!nginx.includes("server_tokens off"))
  add("baota-edge-headers", "infra/baota/nginx/scoutops.conf.template", 1, "server_tokens_enabled");
record("baota-edge-headers", before);

const status = findings.length ? "failed" : "passed";
const report = {
  module_id: policy.moduleId,
  status,
  run_id: runId,
  trace_id: runId,
  checks,
  findings,
  audit: { high: counts.high ?? null, critical: counts.critical ?? null },
  finished_at: new Date().toISOString(),
};
const reportDir = resolve(root, process.env.VERIFY_REPORT_DIR || ".artifacts/verification");
await mkdir(reportDir, { recursive: true });
const reportFile = resolve(reportDir, `security-${runId}.json`);
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report, report_file: relative(root, reportFile) }, null, 2));
if (findings.length) process.exit(1);
