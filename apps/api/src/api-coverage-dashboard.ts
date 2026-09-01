import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const methods = new Set(["get", "post", "put", "patch", "delete"]);

interface CoverageMetadataRule {
  prefix: string;
  dataSource: string;
  uiConsumers: string[];
  crawlerSideEffect: string;
}

interface CoverageMetadata {
  schemaVersion: number;
  source: string;
  default: Omit<CoverageMetadataRule, "prefix">;
  rules: CoverageMetadataRule[];
}

export function parseOpenApiCoverage(source: string) {
  const paths = new Set<string>();
  const operations: Array<{
    path: string;
    method: string;
    required_capability: string | null;
    has_parameters: boolean;
    has_request_body: boolean;
    has_idempotency_key: boolean;
    is_public: boolean;
  }> = [];
  let path: string | null = null;
  let operation: (typeof operations)[number] | null = null;
  for (const line of source.split(/\r?\n/)) {
    if (/^components:\s*$/.test(line)) {
      path = null;
      operation = null;
      continue;
    }
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch?.[1]) {
      path = pathMatch[1];
      paths.add(path);
      operation = null;
      continue;
    }
    const methodMatch = line.match(/^    ([a-z]+):\s*$/);
    if (path && methodMatch?.[1] && methods.has(methodMatch[1])) {
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
    if (operation && capabilityMatch?.[1]) operation.required_capability = capabilityMatch[1];
  }
  return { paths: [...paths], operations };
}

export const apiOperationId = (operation: { method: string; path: string }) =>
  `${operation.method.toLowerCase()}_${operation.path
    .replace(/\{([^}]+)\}/g, "by_$1")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()}`;

const fingerprint = (operations: Array<{ method: string; path: string }>) =>
  createHash("sha256")
    .update(
      operations
        .map((operation) => `${operation.method} ${operation.path}`)
        .sort()
        .join("\n"),
    )
    .digest("hex");

export function apiCoverageFingerprint(openapiSource: string) {
  return fingerprint(parseOpenApiCoverage(openapiSource).operations);
}

const aggregate = (values: string[]) =>
  Object.entries(
    values.reduce<Record<string, number>>((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));

export function buildApiCoverageDashboard(input: {
  openapiSource: string;
  routeCatalog: any;
  metadata: CoverageMetadata;
  report?: any;
  reportInvalid?: boolean;
  query?: string;
  status?: string;
  now?: Date;
}) {
  const openapi = parseOpenApiCoverage(input.openapiSource);
  const operationIds = openapi.operations.map(apiOperationId);
  if (new Set(operationIds).size !== operationIds.length)
    throw new Error("api_coverage_operation_id_collision");
  if (input.metadata.schemaVersion !== 1 || !Array.isArray(input.metadata.rules))
    throw new Error("api_coverage_metadata_invalid");
  const sortedRules = [...input.metadata.rules].sort(
    (left, right) => right.prefix.length - left.prefix.length,
  );
  const catalogFingerprint = fingerprint(openapi.operations);
  const reportOperations = Array.isArray(input.report?.operations) ? input.report.operations : [];
  const reportByOperation = new Map<string, any>(
    reportOperations.map(
      (item: any) => [`${item.method} ${item.path_template}`, item] as [string, any],
    ),
  );
  const reportCurrent =
    input.report?.schema_version === 3 &&
    input.report?.operation_id_policy === "method_path_v1" &&
    input.report?.catalog_fingerprint === catalogFingerprint &&
    input.report?.path_count === openapi.paths.length &&
    input.report?.operation_count === openapi.operations.length;
  const roles = Array.isArray(input.routeCatalog?.productionAcceptance?.roles)
    ? input.routeCatalog.productionAcceptance.roles
    : [];
  const operations = openapi.operations.map((operation) => {
    const rule = sortedRules.find((candidate) => operation.path.startsWith(candidate.prefix));
    const metadata = rule ?? input.metadata.default;
    const operationId = apiOperationId(operation);
    const candidate = reportCurrent
      ? reportByOperation.get(`${operation.method} ${operation.path}`)
      : undefined;
    const actual = candidate?.operation_id === operationId ? candidate : undefined;
    const applicable = {
      normal: true,
      authorization: !operation.is_public,
      parameters: operation.has_parameters || operation.has_request_body,
      idempotency: operation.has_idempotency_key,
      fault: true,
    };
    const evidence = Object.fromEntries(
      Object.entries(applicable).map(([key, isApplicable]) => {
        const item = actual?.evidence?.[key];
        return [
          key,
          item && item.applicable === isApplicable
            ? item
            : {
                applicable: isApplicable,
                status: isApplicable ? "not_run" : "not_applicable",
                test_id: null,
                latest_result: null,
              },
        ];
      }),
    );
    const expectedRoles = roles
      .filter(
        (role: any) =>
          !operation.required_capability ||
          !role.forbiddenCapabilities?.includes(operation.required_capability),
      )
      .map((role: any) => role.role);
    return {
      operation_id: operationId,
      method: operation.method,
      path: operation.path,
      required_capability: operation.required_capability,
      expected_roles: expectedRoles,
      data_source: metadata.dataSource,
      ui_consumers: metadata.uiConsumers,
      crawler_side_effect: metadata.crawlerSideEffect,
      verification_role: actual?.role ?? null,
      http_status: actual?.status ?? null,
      outcome: actual?.outcome ?? "not_run",
      request_id: actual?.request_id ?? null,
      trace_id: actual?.trace_id ?? null,
      evidence,
    };
  });
  const query = String(input.query ?? "")
    .trim()
    .toLocaleLowerCase();
  const status = String(input.status ?? "").trim();
  const filtered = operations.filter(
    (operation) =>
      (!status || operation.outcome === status) &&
      (!query ||
        `${operation.operation_id} ${operation.method} ${operation.path} ${operation.required_capability ?? ""} ${operation.data_source} ${operation.ui_consumers.join(" ")} ${operation.crawler_side_effect}`
          .toLocaleLowerCase()
          .includes(query)),
  );
  const byRole = roles.map((role: any) => {
    const actual = operations.filter((operation) => operation.verification_role === role.role);
    return {
      key: role.role,
      expected_allowed: operations.filter((operation) =>
        operation.expected_roles.includes(role.role),
      ).length,
      verified: actual.length,
      success: actual.filter((operation) => operation.outcome === "success").length,
      empty: actual.filter((operation) => operation.outcome === "empty").length,
      blocked: actual.filter((operation) =>
        ["blocked", "unauthenticated"].includes(operation.outcome),
      ).length,
      unauthorized: actual.filter((operation) => operation.outcome === "unauthorized").length,
    };
  });
  const verified = operations.filter((operation) => operation.outcome !== "not_run").length;
  const capturedAt = reportCurrent ? input.report.captured_at : null;
  const now = input.now ?? new Date();
  const evidenceDimensions = ["normal", "authorization", "parameters", "idempotency", "fault"].map(
    (key) => {
      const values = operations.map((operation) => operation.evidence[key]);
      const applicableCount = values.filter((item) => item.applicable).length;
      const passed = values.filter((item) => item.status === "passed").length;
      return {
        key,
        applicable: applicableCount,
        passed,
        failed: values.filter((item) => item.status === "failed").length,
        not_run: values.filter((item) => item.status === "not_run").length,
        not_applicable: values.filter((item) => item.status === "not_applicable").length,
        coverage_percent: applicableCount
          ? Math.round((passed * 10000) / applicableCount) / 100
          : 100,
      };
    },
  );
  const evidenceApplicable = evidenceDimensions.reduce((total, item) => total + item.applicable, 0);
  const evidencePassed = evidenceDimensions.reduce((total, item) => total + item.passed, 0);
  return {
    domain: "api_coverage",
    report_status: reportCurrent
      ? "current"
      : input.reportInvalid
        ? "invalid"
        : input.report
          ? "outdated"
          : "missing",
    catalog_fingerprint: catalogFingerprint,
    summary: {
      paths: openapi.paths.length,
      operations: operations.length,
      verified,
      coverage_percent: operations.length
        ? Math.round((verified * 10000) / operations.length) / 100
        : 0,
      evidence_applicable: evidenceApplicable,
      evidence_passed: evidencePassed,
      evidence_coverage_percent: evidenceApplicable
        ? Math.round((evidencePassed * 10000) / evidenceApplicable) / 100
        : 100,
      ui_consumed: operations.filter((operation) => operation.ui_consumers.length > 0).length,
      crawler_side_effects: operations.filter(
        (operation) => operation.crawler_side_effect !== "none",
      ).length,
    },
    by_outcome: aggregate(operations.map((operation) => operation.outcome)),
    evidence_dimensions: evidenceDimensions,
    by_role: byRole,
    by_data_source: aggregate(operations.map((operation) => operation.data_source)),
    by_ui_consumer: aggregate(
      operations.flatMap((operation) =>
        operation.ui_consumers.length ? operation.ui_consumers : ["unmapped"],
      ),
    ),
    by_crawler_side_effect: aggregate(operations.map((operation) => operation.crawler_side_effect)),
    operations: filtered.slice(0, 300),
    total_filtered: filtered.length,
    captured_at: capturedAt,
    age_seconds: capturedAt
      ? Math.max(0, Math.floor((now.getTime() - new Date(capturedAt).getTime()) / 1000))
      : null,
    observed_at: now.toISOString(),
  };
}

export async function readApiCoverageDashboard(input: {
  openapiFile: string;
  routeCatalogFile: string;
  metadataFile: string;
  reportFile: string;
  query?: string;
  status?: string;
  now?: Date;
}) {
  const [openapiSource, routeCatalogSource, metadataSource, reportSource] = await Promise.all([
    readFile(input.openapiFile, "utf8"),
    readFile(input.routeCatalogFile, "utf8"),
    readFile(input.metadataFile, "utf8"),
    readFile(input.reportFile, "utf8").catch(() => ""),
  ]);
  let report: any;
  let reportInvalid = false;
  if (reportSource) {
    try {
      report = JSON.parse(reportSource);
    } catch {
      reportInvalid = true;
    }
  }
  return buildApiCoverageDashboard({
    openapiSource,
    routeCatalog: JSON.parse(routeCatalogSource),
    metadata: JSON.parse(metadataSource),
    ...(report === undefined ? {} : { report }),
    ...(reportInvalid ? { reportInvalid } : {}),
    ...(input.query === undefined ? {} : { query: input.query }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.now === undefined ? {} : { now: input.now }),
  });
}
