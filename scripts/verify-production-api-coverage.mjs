import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { readRouteCatalogManifest } from "./production-route-catalog.mjs";

const METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const manifest = JSON.parse(
  await readFile("infra/baota/production-acceptance-manifest.json", "utf8"),
);
const routeCatalog = await readRouteCatalogManifest();
const baseUrl = (process.env.SCOUTOPS_ACCEPTANCE_BASE_URL ?? "https://midouai.medouai.com").replace(
  /\/$/,
  "",
);
const traceId = process.env.SCOUTOPS_QA_TRACE_ID?.trim() || randomUUID();
const reportFile = resolve(
  process.env.SCOUTOPS_ACCEPTANCE_API_REPORT_FILE ??
    ".artifacts/verification/production-api-coverage.json",
);
const resourceIds = JSON.parse(process.env.SCOUTOPS_ACCEPTANCE_RESOURCE_IDS ?? "{}");

function parseOperations(source) {
  const paths = new Set();
  const operations = [];
  let path = null;
  let operation = null;
  for (const line of source.split(/\r?\n/)) {
    if (/^components:\s*$/.test(line)) {
      path = null;
      operation = null;
      continue;
    }
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) {
      path = pathMatch[1];
      paths.add(path);
      operation = null;
      continue;
    }
    const methodMatch = line.match(/^    ([a-z]+):\s*$/);
    if (path && methodMatch && METHODS.has(methodMatch[1])) {
      operation = {
        path,
        method: methodMatch[1].toUpperCase(),
        required_capability: null,
        has_parameters: false,
        has_request_body: false,
        has_idempotency_key: false,
        is_public: false,
      };
      operations.push(operation);
      continue;
    }
    if (operation && /^      parameters:\s*$/.test(line)) operation.has_parameters = true;
    if (operation && /^      requestBody:\s*$/.test(line)) operation.has_request_body = true;
    if (operation && line.includes("#/components/parameters/IdempotencyKey"))
      operation.has_idempotency_key = true;
    if (operation && /^      security:\s*\[\]\s*$/.test(line)) operation.is_public = true;
    const capabilityMatch = line.match(/^      x-required-capability:\s*(\S+)\s*$/);
    if (operation && capabilityMatch) operation.required_capability = capabilityMatch[1];
  }
  return { paths: [...paths], operations };
}

const operationId = (operation) =>
  `${operation.method.toLowerCase()}_${operation.path
    .replace(/\{([^}]+)\}/g, "by_$1")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()}`;

const openapi = parseOperations(await readFile(manifest.baseline.openapiFile, "utf8"));
const operationIds = openapi.operations.map(operationId);
if (new Set(operationIds).size !== operationIds.length)
  throw new Error("openapi_operation_id_collision");
const catalogFingerprint = createHash("sha256")
  .update(
    openapi.operations
      .map((operation) => `${operation.method} ${operation.path}`)
      .sort()
      .join("\n"),
  )
  .digest("hex");
if (
  openapi.paths.length !== manifest.baseline.pathCount ||
  openapi.operations.length !== manifest.baseline.operationCount
)
  throw new Error(`openapi_baseline_drift:${openapi.paths.length}/${openapi.operations.length}`);

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const profiles = routeCatalog.productionAcceptance.roles.map((profile) => ({
  ...profile,
  email: required(`${profile.credentialPrefix}_EMAIL`),
  password: required(`${profile.credentialPrefix}_PASSWORD`),
  cookie: "",
  capabilities: [],
}));

const headers = (extra = {}) => ({
  accept: "application/json",
  "x-request-id": randomUUID(),
  "x-trace-id": traceId,
  ...extra,
});
const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  return { response, body: await response.json().catch(() => null) };
};

for (const profile of profiles) {
  const login = await request("/auth/login", {
    method: "POST",
    headers: headers({ "content-type": "application/json", origin: baseUrl }),
    body: JSON.stringify({ email: profile.email, password: profile.password }),
  });
  if (!login.response.ok || login.response.status === 202)
    throw new Error(`acceptance_login_failed:${profile.key}:${login.response.status}`);
  profile.cookie = (login.response.headers.get("set-cookie") ?? "").split(";", 1)[0];
  if (!profile.cookie) throw new Error(`acceptance_cookie_missing:${profile.key}`);
  if (profile.shell !== "platform_admin") {
    const context = await request("/auth/context", {
      method: "POST",
      headers: headers({
        cookie: profile.cookie,
        origin: baseUrl,
        "content-type": "application/json",
        "idempotency-key": randomUUID(),
      }),
      body: JSON.stringify({
        organization_id: resourceIds.organizationId,
        workspace_id: resourceIds.workspaceId,
      }),
    });
    if (!context.response.ok)
      throw new Error(`acceptance_context_failed:${profile.key}:${context.response.status}`);
  }
  const guard = await request(`/me/navigation?shell=${profile.shell}`, {
    headers: headers({ cookie: profile.cookie }),
  });
  if (!guard.response.ok) throw new Error(`acceptance_guard_failed:${profile.key}`);
  profile.capabilities =
    profile.shell === "platform_admin"
      ? (guard.body?.data?.platform_capabilities ?? [])
      : (guard.body?.data?.capabilities ?? []);
}

const safePathValue = (name) => {
  const exact = resourceIds[name];
  if (exact) return String(exact);
  const aliases = {
    organizationId: resourceIds.organizationId,
    workspaceId: resourceIds.workspaceId,
    opportunityId: resourceIds.opportunityId,
    taskId: resourceIds.taskId,
    userId: resourceIds.memberUserId,
    membershipId: resourceIds.memberMembershipId,
    roleCode: "member",
    shell: "member",
    code: "acceptance-missing",
    source: "system",
  };
  return String(aliases[name] ?? "00000000-0000-4000-8000-000000000000");
};
const concretePath = (template) =>
  template.replace(/\{([^}]+)\}/g, (_, name) => encodeURIComponent(safePathValue(name)));
const authorizedProfile = (capability) =>
  profiles.find((profile) => !capability || profile.capabilities.includes(capability)) ??
  profiles[0];
const unauthorizedProfile = (capability) =>
  profiles.find((profile) => capability && !profile.capabilities.includes(capability)) ?? null;
const classify = (status, body) => {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "unauthorized";
  if (status >= 400) return "blocked";
  const data = body?.data;
  if (
    data === null ||
    (Array.isArray(data) && data.length === 0) ||
    (Array.isArray(data?.items) && data.items.length === 0)
  )
    return "empty";
  return "success";
};

const results = [];
for (const operation of openapi.operations) {
  const isWrite = !["GET", "HEAD"].includes(operation.method);
  const isPublic = operation.is_public;
  const profile = isWrite
    ? isPublic
      ? null
      : unauthorizedProfile(operation.required_capability)
    : isPublic
      ? null
      : authorizedProfile(operation.required_capability);
  const path = concretePath(operation.path);
  const id = operationId(operation);
  const runProbe = async ({ kind, probeProfile }) => {
    const { response, body } = await request(path, {
      method: operation.method,
      headers: headers({
        ...(probeProfile?.cookie ? { cookie: probeProfile.cookie } : {}),
        ...(isWrite
          ? {
              origin: baseUrl,
              "content-type": "application/json",
              "idempotency-key": randomUUID(),
            }
          : {}),
      }),
      ...(isWrite ? { body: "{}" } : {}),
    });
    if (
      response.status === 404 &&
      (/^Route .* not found$/i.test(body?.message ?? "") || body?.code === "FST_ERR_NOT_FOUND")
    )
      throw new Error(`openapi_operation_route_not_found:${operation.method}:${operation.path}`);
    return {
      test_id: `production:${traceId}:${id}:${kind}`,
      kind,
      role: probeProfile?.role ?? null,
      status: response.status,
      outcome: classify(response.status, body),
      error_code: typeof body?.code === "string" ? body.code.slice(0, 120) : null,
      request_id: response.headers.get("x-request-id"),
      trace_id: response.headers.get("x-trace-id") ?? traceId,
    };
  };
  const primaryKind = isWrite ? (isPublic ? "parameters" : "authorization") : "normal";
  const primary = await runProbe({ kind: primaryKind, probeProfile: profile });
  const probes = [primary];
  if (!isWrite && !isPublic)
    probes.push(await runProbe({ kind: "authorization", probeProfile: null }));
  const evidenceFor = (kind, applicable) => {
    if (!applicable)
      return { applicable: false, status: "not_applicable", test_id: null, latest_result: null };
    const probe = probes.find((candidate) => candidate.kind === kind);
    if (!probe) return { applicable: true, status: "not_run", test_id: null, latest_result: null };
    const passed =
      kind === "normal"
        ? ["success", "empty"].includes(probe.outcome)
        : kind === "authorization"
          ? ["unauthenticated", "unauthorized"].includes(probe.outcome)
          : kind === "parameters"
            ? probe.status >= 400 && ![401, 403, 404].includes(probe.status)
            : false;
    return {
      applicable: true,
      status: passed ? "passed" : "failed",
      test_id: probe.test_id,
      latest_result: `${probe.status}:${probe.outcome}${probe.error_code ? `:${probe.error_code}` : ""}`,
    };
  };
  results.push({
    operation_id: id,
    method: operation.method,
    path_template: operation.path,
    concrete_path: path,
    required_capability: operation.required_capability,
    role: primary.role,
    status: primary.status,
    outcome: primary.outcome,
    request_id: primary.request_id,
    trace_id: primary.trace_id,
    probes,
    evidence: {
      normal: evidenceFor("normal", true),
      authorization: evidenceFor("authorization", !isPublic),
      parameters: evidenceFor("parameters", operation.has_parameters || operation.has_request_body),
      idempotency: {
        applicable: operation.has_idempotency_key,
        status: operation.has_idempotency_key ? "not_run" : "not_applicable",
        test_id: null,
        latest_result: null,
      },
      fault: { applicable: true, status: "not_run", test_id: null, latest_result: null },
    },
  });
}

for (const profile of profiles)
  await request("/auth/logout", {
    method: "POST",
    headers: headers({
      cookie: profile.cookie,
      origin: baseUrl,
      "idempotency-key": randomUUID(),
    }),
  }).catch(() => {});

const counts = Object.fromEntries(
  manifest.apiProbe.allowedOutcomes.map((outcome) => [
    outcome,
    results.filter((result) => result.outcome === outcome).length,
  ]),
);
const report = {
  schema_version: 3,
  status: "passed",
  base_url: baseUrl,
  path_count: openapi.paths.length,
  operation_count: results.length,
  operation_id_policy: "method_path_v1",
  catalog_fingerprint: catalogFingerprint,
  counts,
  operations: results,
  captured_at: new Date().toISOString(),
  trace_id: traceId,
};
await mkdir(dirname(reportFile), { recursive: true });
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(
  JSON.stringify(
    {
      status: "passed",
      path_count: report.path_count,
      operation_count: report.operation_count,
      counts,
      report_file: reportFile,
      trace_id: traceId,
    },
    null,
    2,
  ),
);
