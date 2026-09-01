import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const production = process.argv.includes("--production"),
  runId = randomUUID(),
  manifest = JSON.parse(await readFile("infra/baota/selection-acceptance-manifest.json", "utf8"));
const stop = (code, message, blocked = false) => {
  console.error(
    JSON.stringify(
      {
        module: "M07-06",
        status: blocked ? "blocked" : "failed",
        code,
        message,
        request_id: runId,
        trace_id: runId,
      },
      null,
      2,
    ),
  );
  process.exit(blocked ? 2 : 1);
};
const abort = (code, message, blocked = false) => {
  const error = new Error(message);
  error.acceptance = {
    module: "M07-06",
    status: blocked ? "blocked" : "failed",
    code,
    message,
    request_id: runId,
    trace_id: runId,
  };
  error.exitCode = blocked ? 2 : 1;
  throw error;
};
if (
  manifest.module !== "M07-06" ||
  manifest.productionManager !== "baota" ||
  manifest.topology !== "single_host_huizhou" ||
  manifest.backupServerUsed !== false ||
  manifest.task?.daemon !== false ||
  manifest.task?.timeoutSeconds !== 240 ||
  manifest.journey?.deadlineMs !== 180000 ||
  manifest.journey?.acceptedVisibleMs !== 15000 ||
  manifest.memberBoundary?.sessionContextRequired !== true ||
  manifest.memberBoundary?.exactlyOneActiveOrganization !== true ||
  manifest.memberBoundary?.providerConfigurationTouchedByMember !== false
)
  stop("selection_manifest_invalid", "M07-06 宝塔有限任务或 180 秒验收合同漂移。");
if (!production) {
  console.log(
    JSON.stringify(
      {
        module: "M07-06",
        status: "preflight_passed",
        production_verified: false,
        request_id: runId,
        trace_id: runId,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const baseRaw = process.env.SELECTION_ACCEPTANCE_BASE_URL ?? "https://midouai.medouai.com";
let base;
try {
  base = new URL(baseRaw);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw 0;
} catch {
  stop(
    "selection_base_url_invalid",
    "SELECTION_ACCEPTANCE_BASE_URL 必须是无路径、账号或片段的 HTTPS 根地址。",
    true,
  );
}
const email = process.env.SELECTION_ACCEPTANCE_EMAIL?.trim(),
  password = process.env.SELECTION_ACCEPTANCE_PASSWORD,
  inputKind = process.env.SELECTION_ACCEPTANCE_INPUT_KIND ?? "keyword",
  inputValue = process.env.SELECTION_ACCEPTANCE_INPUT_VALUE?.trim() ?? "portable blender",
  evidenceFile = resolve(
    process.env.SELECTION_ACCEPTANCE_EVIDENCE_FILE ??
      ".artifacts/verification/selection-acceptance-production-evidence.json",
  );
if (!email || !password)
  stop(
    "selection_member_credentials_missing",
    "在宝塔受限任务环境注入专用普通 member 验收账号。",
    true,
  );
if (
  !["keyword", "asin", "product_url"].includes(inputKind) ||
  !inputValue ||
  inputValue.length > 200
)
  stop("selection_input_invalid", "修正宝塔任务中的真实验收输入。", true);
const headers = (extra = {}) => ({
  accept: "application/json",
  "x-request-id": randomUUID(),
  "x-trace-id": runId,
  ...extra,
});
const request = async (path, options = {}) => {
  const response = await fetch(new URL(`/api/v1${path}`, base), {
      ...options,
      signal: AbortSignal.timeout(15000),
    }),
    body = await response.json().catch(() => null);
  return { response, body };
};
let cookie = "";
try {
  const login = await request("/auth/login", {
    method: "POST",
    headers: headers({ "content-type": "application/json", origin: base.origin }),
    body: JSON.stringify({ email, password }),
  });
  if (!login.response.ok || login.response.status === 202)
    abort("selection_member_login_failed", "专用普通 member 账号登录失败或启用了 MFA。", true);
  cookie = (login.response.headers.get("set-cookie") ?? "").split(";", 1)[0];
  if (!cookie) abort("selection_member_cookie_missing", "登录未返回受限会话。", true);
  const memberships = await request("/org/memberships", { headers: headers({ cookie }) }),
    organizations =
      memberships.body?.data?.filter(
        (item) => item?.status === "active" && item?.membership_status === "active",
      ) ?? [];
  if (!memberships.response.ok || organizations.length !== 1)
    abort("selection_member_tenancy_invalid", "验收账号必须且只能属于一个有效验收组织。", true);
  const organization = organizations[0];
  const workspaceList = await request(`/org/${organization.id}/workspaces`, {
      headers: headers({ cookie }),
    }),
    workspaces = workspaceList.body?.data?.filter((item) => item?.status === "active") ?? [],
    workspace =
      workspaces.find((item) => item.id === organization.default_workspace_id) ??
      (workspaces.length === 1 ? workspaces[0] : null);
  if (!workspaceList.response.ok || !workspace)
    abort("selection_member_workspace_invalid", "验收账号没有唯一可选择的有效工作区。", true);
  const selected = await request("/auth/context", {
    method: "POST",
    headers: headers({
      cookie,
      origin: base.origin,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    }),
    body: JSON.stringify({ organization_id: organization.id, workspace_id: workspace.id }),
  });
  if (
    !selected.response.ok ||
    selected.body?.data?.organization?.id !== organization.id ||
    selected.body?.data?.workspace?.id !== workspace.id
  )
    abort(
      "selection_member_context_failed",
      "专用普通 member 会话无法选择验收组织和工作区。",
      true,
    );
  const guard = await request("/me/navigation?shell=member", { headers: headers({ cookie }) }),
    g = guard.body?.data,
    allCapabilities = [...(g?.capabilities ?? []), ...(g?.platform_capabilities ?? [])];
  if (
    !guard.response.ok ||
    g?.roles?.length !== 1 ||
    g.roles[0] !== "member" ||
    g.platform_roles?.length ||
    !["task:create", "opportunity:read", "opportunity:decide"].every((x) =>
      g.capabilities?.includes(x),
    ) ||
    ["provider:configure", "collection:replay", "platform:operate", "platform:superadmin"].some(
      (x) => allCapabilities.includes(x),
    )
  )
    abort(
      "selection_member_boundary_invalid",
      "验收账号必须是无平台权限的普通 member，并具备任务创建、机会读取和决策权限。",
      true,
    );
  const started = Date.now(),
    create = await request("/selection-journeys", {
      method: "POST",
      headers: headers({
        cookie,
        origin: base.origin,
        "content-type": "application/json",
        "idempotency-key": randomUUID(),
      }),
      body: JSON.stringify({ input_kind: inputKind, input_value: inputValue }),
    }),
    createApiMs = Date.now() - started;
  if (!create.response.ok || create.response.status !== 202)
    abort("selection_create_failed", create.body?.error?.code ?? "真实选品任务创建失败。", true);
  if (createApiMs > 3000)
    abort("selection_create_slow", `创建 API ${createApiMs}ms 超过 3000ms。`, true);
  let journey = create.body.data;
  const visible = await request(`/selection-journeys/${journey.id}`, {
      headers: headers({ cookie }),
    }),
    acceptedVisibleMs = Date.now() - started;
  if (!visible.response.ok || !visible.body?.data || acceptedVisibleMs > 15000)
    abort(
      "selection_acceptance_visibility_failed",
      `已接收/排队状态在 ${acceptedVisibleMs}ms 后仍不可见。`,
      true,
    );
  journey = visible.body.data;
  const finalStates = new Set(["result_ready", "succeeded_empty", "blocked", "failed"]);
  while (!finalStates.has(journey.state) && Date.now() - started <= 180000) {
    await new Promise((r) => setTimeout(r, 2000));
    const polled = await request(`/selection-journeys/${journey.id}`, {
      headers: headers({ cookie }),
    });
    if (!polled.response.ok)
      abort("selection_poll_failed", polled.body?.error?.code ?? "真实任务状态读取失败。", true);
    journey = polled.body.data;
  }
  const terminalMs = Date.now() - started;
  if (!finalStates.has(journey.state) || terminalMs > 180000)
    abort("selection_terminal_timeout", `真实终态 ${terminalMs}ms 超过 180000ms。`, true);
  const evidenceViewed = journey.first_result
    ? Boolean(journey.first_result.raw_evidence_id && journey.first_result.canonical_url)
    : Boolean(
        journey.task_status && (journey.state === "succeeded_empty" || journey.blocked_reason),
      );
  if (!evidenceViewed)
    abort("selection_evidence_missing", "终态没有可验证原始证据或明确空/受阻任务证据。", true);
  const decision = await request(`/selection-journeys/${journey.id}/decisions`, {
    method: "POST",
    headers: headers({
      cookie,
      origin: base.origin,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    }),
    body: JSON.stringify({
      action: "observe",
      reason: "M07-06 生产真实选品验收：保留结果并继续观察。",
    }),
  });
  if (
    !decision.response.ok ||
    decision.response.status !== 201 ||
    decision.body?.data?.state !== "decided" ||
    !decision.body.data.decision
  )
    abort("selection_decision_failed", decision.body?.error?.code ?? "审计决策未保存。", true);
  const decided = decision.body.data;
  const version = await request("/health/version", { headers: headers() }),
    buildSha = version.body?.data?.build_sha;
  if (!version.response.ok || !/^[a-f0-9]{40}$/.test(buildSha ?? ""))
    abort("selection_build_identity_missing", "生产版本健康检查缺少 Git build SHA。", true);
  const evidence = {
    schemaVersion: 1,
    module: "M07-06",
    manager: "baota",
    topology: "single_host_huizhou",
    backupServerUsed: false,
    buildSha,
    journeyId: decided.id,
    taskId: decided.task_id,
    opportunityId: decided.opportunity_id,
    inputKind,
    inputSha256: createHash("sha256").update(inputValue).digest("hex"),
    providerCode: decided.provider_code,
    memberRole: "member",
    memberCapabilities: g.capabilities,
    providerConfigurationTouchedByMember: false,
    createApiMs,
    acceptedVisibleMs,
    terminalMs,
    terminalState: journey.state,
    taskStatus: journey.task_status,
    decisionAction: decided.decision.action,
    decisionRecorded: true,
    evidenceViewed: true,
    rawEvidenceId: journey.first_result?.raw_evidence_id ?? null,
    blockedReason: journey.blocked_reason,
    requestId: create.body.request_id,
    traceId: create.body.trace_id,
    capturedAt: new Date().toISOString(),
  };
  await mkdir(dirname(evidenceFile), { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(evidenceFile, 0o600);
  console.log(
    JSON.stringify(
      {
        module: "M07-06",
        status: "passed",
        journey_id: evidence.journeyId,
        terminal_state: evidence.terminalState,
        terminal_ms: evidence.terminalMs,
        decision_recorded: true,
        evidence_file: evidenceFile,
        request_id: evidence.requestId,
        trace_id: evidence.traceId,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const payload = error?.acceptance ?? {
    module: "M07-06",
    status: "blocked",
    code: "selection_acceptance_dependency_failed",
    message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
    request_id: runId,
    trace_id: runId,
  };
  console.error(JSON.stringify(payload, null, 2));
  process.exitCode = error?.exitCode ?? 2;
} finally {
  if (cookie)
    await request("/auth/logout", {
      method: "POST",
      headers: headers({ cookie, origin: base.origin, "idempotency-key": randomUUID() }),
    }).catch(() => {});
}
