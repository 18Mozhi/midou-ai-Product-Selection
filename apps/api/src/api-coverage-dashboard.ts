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
  }> = [];
  let path: string | null = null;
  let operation: (typeof operations)[number] | null = null;
  for (const line of source.split(/\r?\n/)) {
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
      };
      operations.push(operation);
      continue;
    }
    const capabilityMatch = line.match(/^      x-required-capability:\s*(\S+)\s*$/);
    if (operation && capabilityMatch?.[1]) operation.required_capability = capabilityMatch[1];
  }
  return { paths: [...paths], operations };
}

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
    input.report?.schema_version === 2 &&
    input.report?.catalog_fingerprint === catalogFingerprint &&
    input.report?.path_count === openapi.paths.length &&
    input.report?.operation_count === openapi.operations.length;
  const roles = Array.isArray(input.routeCatalog?.productionAcceptance?.roles)
    ? input.routeCatalog.productionAcceptance.roles
    : [];
  const operations = openapi.operations.map((operation) => {
    const rule = sortedRules.find((candidate) => operation.path.startsWith(candidate.prefix));
    const metadata = rule ?? input.metadata.default;
    const actual = reportCurrent
      ? reportByOperation.get(`${operation.method} ${operation.path}`)
      : undefined;
    const expectedRoles = roles
      .filter(
        (role: any) =>
          !operation.required_capability ||
          !role.forbiddenCapabilities?.includes(operation.required_capability),
      )
      .map((role: any) => role.role);
    return {
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
        `${operation.method} ${operation.path} ${operation.required_capability ?? ""} ${operation.data_source} ${operation.ui_consumers.join(" ")} ${operation.crawler_side_effect}`
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
      ui_consumed: operations.filter((operation) => operation.ui_consumers.length > 0).length,
      crawler_side_effects: operations.filter(
        (operation) => operation.crawler_side_effect !== "none",
      ).length,
    },
    by_outcome: aggregate(operations.map((operation) => operation.outcome)),
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
