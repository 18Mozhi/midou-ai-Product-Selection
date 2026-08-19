import { createHash, randomUUID } from "node:crypto";
import {
  BUILTIN_PROVIDER_SOURCES,
  parseProductSupplyCsv,
  type BuiltinSourceDefinition,
} from "@scoutops/provider-sources";
import {
  ALIBABA_1688_BROWSER_PARSER_VERSION,
  parse1688BrowserRunResult,
} from "@scoutops/provider-sources";
import { ProviderAdapterFailure, type ProviderRawRecord } from "@scoutops/provider-adapters";

export class ProviderSourceServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "ProviderSourceServiceError";
  }
}
export interface ProvisionedSource {
  id: string;
  code: string;
  status: "draft" | "disabled" | "enabled";
  version: number;
  schedule_minutes: number;
  timeout_ms: number;
  retry_limit: number;
  updated_at: string;
  last_success: {
    task_id: string;
    status: "succeeded" | "succeeded_empty";
    available_result_count: number;
    finished_at: string;
  } | null;
}
export interface ProviderSourceCatalogItem extends BuiltinSourceDefinition {
  provisioned: ProvisionedSource | null;
}
export interface ProviderSourceReplay {
  id: string;
  task_id: string;
  provider_id: string;
  source_code: string;
  status: string;
  item_count: number;
  error_code: string | null;
  request_id: string;
  trace_id: string;
  created_at: string;
  updated_at: string;
}
export interface ParserSampleCandidate {
  browser_job_id: string;
  organization_id: string;
  workspace_id: string;
  captured_at: string;
  item_count: number;
  parser_version: string;
  snapshots: unknown;
}
export interface ParserSample {
  id: string;
  provider_id: string;
  browser_job_id: string;
  name: string;
  baseline_parser_version: string;
  last_replay_status: "never" | "passed" | "changed" | "failed";
  last_replay_at: string | null;
  created_at: string;
}
export interface ParserSampleReplay {
  id: string;
  sample_id: string;
  provider_id: string;
  parser_version: string;
  status: "passed" | "changed" | "failed";
  diff: Array<{ path: string; before: unknown; after: unknown }>;
  error_code: string | null;
  request_id: string;
  trace_id: string;
  created_at: string;
}
export interface ProviderSourceRepository {
  listProvisioned(codes: string[]): Promise<ProvisionedSource[]>;
  syncCatalog(input: { definitions: readonly BuiltinSourceDefinition[]; now: Date }): Promise<{
    inserted: number;
    updated: number;
    automatic_enabled: number;
    status: "synced" | "waiting_for_platform_admin";
  }>;
  provision(input: {
    definition: BuiltinSourceDefinition;
    providerId: string;
    actorId: string;
    route: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<ProvisionedSource>;
  replay(input: {
    providerId: string;
    sourceCode: string;
    organizationId: string;
    workspaceId: string;
    target: Record<string, unknown>;
    inputSha256: string;
    runId: string;
    taskId: string;
    subqueryId: string;
    actorId: string;
    route: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<ProviderSourceReplay>;
  refresh(input: {
    organizationId: string;
    workspaceId: string;
    actorId: string;
    route: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<{ task_id: string; source_count: number; status: "scheduled" }>;
  updateConfiguration(input: {
    providerId: string;
    scheduleMinutes: number;
    timeoutMs: number;
    retryLimit: number;
    status: "disabled" | "enabled";
    expectedVersion: number;
    reason: string;
    actorId: string;
    route: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<ProvisionedSource>;
  parserSampleOverview(
    providerId: string,
  ): Promise<{ samples: ParserSample[]; candidates: Omit<ParserSampleCandidate, "snapshots">[] }>;
  parserSampleByOperation(
    actorId: string,
    route: string,
    idempotencyKey: string,
  ): Promise<ParserSample | null>;
  parserReplayByOperation(
    actorId: string,
    route: string,
    idempotencyKey: string,
  ): Promise<ParserSampleReplay | null>;
  parserSampleCandidate(
    providerId: string,
    browserJobId: string,
  ): Promise<ParserSampleCandidate | null>;
  createParserSample(input: {
    sampleId: string;
    providerId: string;
    browserJobId: string;
    organizationId: string;
    workspaceId: string;
    name: string;
    inputSha256: string;
    snapshots: unknown;
    baselineOutput: unknown;
    baselineOutputSha256: string;
    parserVersion: string;
    actorId: string;
    route: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<ParserSample>;
  loadParserSample(
    providerId: string,
    sampleId: string,
  ): Promise<{
    sample: ParserSample;
    snapshots: unknown;
    baselineOutput: unknown;
    providerCode: string;
    parserVersion: string;
  } | null>;
  recordParserReplay(input: {
    runId: string;
    sampleId: string;
    providerId: string;
    parserVersion: string;
    status: "passed" | "changed" | "failed";
    outputSha256: string | null;
    diff: Array<{ path: string; before: unknown; after: unknown }>;
    errorCode: string | null;
    actorId: string;
    route: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<ParserSampleReplay>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const source = (code: string) => {
  const result = BUILTIN_PROVIDER_SOURCES.find((item) => item.code === code);
  if (!result)
    throw new ProviderSourceServiceError("provider_source_not_found", 404, "刷新首批来源目录。");
  return result;
};
const stable = (value: unknown): string => {
  if (value === undefined) return '"[undefined]"';
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
    .join(",")}}`;
};
const hash = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const projection = (records: ProviderRawRecord[]) =>
  records.map((record) => {
    const payload = record.payload as Record<string, unknown>;
    return {
      external_id: record.externalId,
      observed_at: record.observedAt,
      evidence_ref: record.evidenceRef,
      canonical_url: payload.canonical_url,
      fields: payload.fields,
      source_paths: payload.source_paths,
    };
  });
const changes = (
  before: unknown,
  after: unknown,
  path = "$",
  result: Array<{ path: string; before: unknown; after: unknown }> = [],
) => {
  if (result.length >= 200 || stable(before) === stable(after)) return result;
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    for (const key of [
      ...new Set([...Object.keys(before as object), ...Object.keys(after as object)]),
    ].sort())
      changes(
        (before as Record<string, unknown>)[key],
        (after as Record<string, unknown>)[key],
        `${path}.${key}`,
        result,
      );
    return result;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    for (
      let index = 0;
      index < Math.max(before.length, after.length) && result.length < 200;
      index += 1
    )
      changes(before[index], after[index], `${path}[${index}]`, result);
    return result;
  }
  result.push({ path, before, after });
  return result;
};
export class ProviderSourceService {
  constructor(
    private readonly repository: ProviderSourceRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async list(): Promise<ProviderSourceCatalogItem[]> {
    const provisioned = await this.repository.listProvisioned(
      BUILTIN_PROVIDER_SOURCES.map((item) => item.code),
    );
    return BUILTIN_PROVIDER_SOURCES.map((item) => ({
      ...item,
      provisioned: provisioned.find((value) => value.code === item.code) ?? null,
    }));
  }
  ensureCatalog() {
    return this.repository.syncCatalog({ definitions: BUILTIN_PROVIDER_SOURCES, now: this.now() });
  }
  updateConfiguration(
    providerId: string,
    value: {
      schedule_minutes?: unknown;
      timeout_ms?: unknown;
      retry_limit?: unknown;
      status?: unknown;
      expected_version?: unknown;
      reason?: unknown;
    },
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ) {
    if (!uuid.test(providerId))
      throw new ProviderSourceServiceError("provider_id_invalid", 400, "刷新来源目录后重试。");
    const scheduleMinutes = Number(value?.schedule_minutes),
      timeoutMs = Number(value?.timeout_ms),
      retryLimit = Number(value?.retry_limit),
      expectedVersion = Number(value?.expected_version),
      status = String(value?.status ?? ""),
      reason = String(value?.reason ?? "").trim();
    if (!Number.isInteger(scheduleMinutes) || scheduleMinutes < 1 || scheduleMinutes > 10080)
      throw new ProviderSourceServiceError(
        "provider_schedule_invalid",
        400,
        "采集频率必须为 1–10080 分钟。",
      );
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000)
      throw new ProviderSourceServiceError(
        "provider_timeout_invalid",
        400,
        "超时时间必须为 1000–120000 毫秒。",
      );
    if (!Number.isInteger(retryLimit) || retryLimit < 0 || retryLimit > 10)
      throw new ProviderSourceServiceError("provider_retry_invalid", 400, "重试次数必须为 0–10。");
    if (!["disabled", "enabled"].includes(status))
      throw new ProviderSourceServiceError(
        "provider_status_invalid",
        400,
        "状态只能选择启用或停用。",
      );
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
      throw new ProviderSourceServiceError("provider_version_invalid", 400, "刷新来源版本后重试。");
    if (reason.length < 2 || reason.length > 500)
      throw new ProviderSourceServiceError(
        "provider_reason_invalid",
        400,
        "填写 2–500 字的变更原因。",
      );
    return this.repository.updateConfiguration({
      providerId,
      scheduleMinutes,
      timeoutMs,
      retryLimit,
      status: status as "disabled" | "enabled",
      expectedVersion,
      reason,
      route: `/platform/provider-sources/${providerId}/configuration`,
      ...context,
      now: this.now(),
    });
  }
  provision(
    code: string,
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ) {
    const definition = source(code);
    return this.repository.provision({
      definition,
      providerId: randomUUID(),
      route: `/platform/provider-sources/${code}/provision`,
      ...context,
      now: this.now(),
    });
  }
  replay(
    providerId: string,
    value: {
      organization_id?: unknown;
      workspace_id?: unknown;
      query?: unknown;
      csv_text?: unknown;
    },
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ) {
    if (!uuid.test(providerId))
      throw new ProviderSourceServiceError("provider_id_invalid", 400, "刷新首批来源目录。");
    if (
      !uuid.test(String(value?.organization_id ?? "")) ||
      !uuid.test(String(value?.workspace_id ?? ""))
    )
      throw new ProviderSourceServiceError(
        "provider_source_scope_invalid",
        400,
        "选择有效的组织与工作区。",
      );
    let target: Record<string, unknown>;
    if (value.query !== undefined && value.csv_text !== undefined)
      throw new ProviderSourceServiceError(
        "provider_source_target_invalid",
        400,
        "query 与 csv_text 只能提交一种。",
      );
    if (value.query !== undefined) {
      if (typeof value.query !== "string" || !value.query.trim() || value.query.length > 200)
        throw new ProviderSourceServiceError(
          "provider_source_query_invalid",
          400,
          "关键词需要 1–200 字符。",
        );
      target = { query: value.query.trim() };
    } else if (value.csv_text !== undefined) {
      if (typeof value.csv_text !== "string")
        throw new ProviderSourceServiceError(
          "provider_source_csv_invalid",
          400,
          "CSV 内容格式无效。",
        );
      try {
        parseProductSupplyCsv(value.csv_text, 20);
      } catch (error) {
        throw new ProviderSourceServiceError(
          "provider_source_csv_invalid",
          400,
          error instanceof Error ? error.message : "按固定表头修正 CSV。",
        );
      }
      target = { csv_text: value.csv_text };
    } else
      throw new ProviderSourceServiceError(
        "provider_source_target_invalid",
        400,
        "提交关键词或 CSV 内容。",
      );
    const serialized = JSON.stringify(target);
    return this.repository.replay({
      providerId,
      sourceCode: "",
      organizationId: String(value.organization_id),
      workspaceId: String(value.workspace_id),
      target,
      inputSha256: createHash("sha256").update(serialized).digest("hex"),
      runId: randomUUID(),
      taskId: randomUUID(),
      subqueryId: randomUUID(),
      route: `/platform/provider-sources/${providerId}/replays`,
      ...context,
      now: this.now(),
    });
  }
  refresh(
    value: { organization_id?: unknown; workspace_id?: unknown },
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ) {
    const organizationId = String(value?.organization_id ?? ""),
      workspaceId = String(value?.workspace_id ?? "");
    if (!uuid.test(organizationId) || !uuid.test(workspaceId))
      throw new ProviderSourceServiceError(
        "provider_source_scope_invalid",
        400,
        "重新选择组织和工作区后再刷新热点。",
      );
    return this.repository.refresh({
      organizationId,
      workspaceId,
      route: "/provider-sources/refresh",
      ...context,
      now: this.now(),
    });
  }
  parserSamples(providerId: string) {
    if (!uuid.test(providerId))
      throw new ProviderSourceServiceError("provider_id_invalid", 400, "刷新来源目录后重试。");
    return this.repository.parserSampleOverview(providerId);
  }
  async createParserSample(
    providerId: string,
    value: { browser_job_id?: unknown; name?: unknown },
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ) {
    const browserJobId = String(value?.browser_job_id ?? ""),
      name = String(value?.name ?? "").trim(),
      route = `/platform/provider-sources/${providerId}/parser-samples`;
    if (!uuid.test(providerId) || !uuid.test(browserJobId))
      throw new ProviderSourceServiceError(
        "parser_sample_target_invalid",
        400,
        "选择一条真实登录采集候选。",
      );
    const previous = await this.repository.parserSampleByOperation(
      context.actorId,
      route,
      context.idempotencyKey,
    );
    if (previous) return previous;
    if (name.length < 2 || name.length > 120)
      throw new ProviderSourceServiceError(
        "parser_sample_name_invalid",
        400,
        "样本名称需要 2–120 个字符。",
      );
    const candidate = await this.repository.parserSampleCandidate(providerId, browserJobId);
    if (!candidate)
      throw new ProviderSourceServiceError(
        "parser_sample_candidate_not_found",
        404,
        "先完成一条带截图、DOM 与结构化快照的真实登录采集。",
      );
    if (candidate.parser_version !== ALIBABA_1688_BROWSER_PARSER_VERSION)
      throw new ProviderSourceServiceError(
        "parser_sample_parser_unavailable",
        409,
        "该采集证据的解析版本与当前 1688 合同不一致，请重新采集。",
      );
    let baseline: unknown;
    try {
      baseline = projection(
        parse1688BrowserRunResult({
          status: "succeeded",
          error_code: null,
          snapshots: candidate.snapshots,
        }),
      );
    } catch (error) {
      if (error instanceof ProviderAdapterFailure)
        throw new ProviderSourceServiceError(
          "parser_sample_invalid",
          409,
          "该采集结果未通过当前 1688 结构化合同，不能固定为样本。",
        );
      throw error;
    }
    return this.repository.createParserSample({
      sampleId: randomUUID(),
      providerId,
      browserJobId,
      organizationId: candidate.organization_id,
      workspaceId: candidate.workspace_id,
      name,
      inputSha256: hash(candidate.snapshots),
      snapshots: candidate.snapshots,
      baselineOutput: baseline,
      baselineOutputSha256: hash(baseline),
      parserVersion: candidate.parser_version,
      route,
      ...context,
      now: this.now(),
    });
  }
  async replayParserSample(
    providerId: string,
    sampleId: string,
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ) {
    if (!uuid.test(providerId) || !uuid.test(sampleId))
      throw new ProviderSourceServiceError(
        "parser_sample_target_invalid",
        400,
        "刷新固定样本后重试。",
      );
    const route = `/platform/provider-sources/${providerId}/parser-samples/${sampleId}/replays`,
      previous = await this.repository.parserReplayByOperation(
        context.actorId,
        route,
        context.idempotencyKey,
      );
    if (previous) return previous;
    const loaded = await this.repository.loadParserSample(providerId, sampleId);
    if (!loaded)
      throw new ProviderSourceServiceError("parser_sample_not_found", 404, "刷新固定样本后重试。");
    if (
      loaded.providerCode !== "1688_search" ||
      loaded.parserVersion !== ALIBABA_1688_BROWSER_PARSER_VERSION
    )
      throw new ProviderSourceServiceError(
        "parser_sample_parser_unavailable",
        409,
        "先发布与当前来源版本匹配的解析器。",
      );
    let output: unknown = null,
      status: "passed" | "changed" | "failed" = "failed",
      diff: Array<{ path: string; before: unknown; after: unknown }> = [],
      errorCode: string | null = null;
    try {
      output = projection(
        parse1688BrowserRunResult({
          status: "succeeded",
          error_code: null,
          snapshots: loaded.snapshots,
        }),
      );
      diff = changes(loaded.baselineOutput, output);
      status = diff.length ? "changed" : "passed";
    } catch (error) {
      if (!(error instanceof ProviderAdapterFailure)) throw error;
      errorCode = error.code;
    }
    return this.repository.recordParserReplay({
      runId: randomUUID(),
      sampleId,
      providerId,
      parserVersion: loaded.parserVersion,
      status,
      outputSha256: output === null ? null : hash(output),
      diff,
      errorCode,
      route,
      ...context,
      now: this.now(),
    });
  }
}
