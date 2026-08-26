<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ApiClientError,
  createApiClient,
  rethrowUnexpectedError,
  type ApiRequestOptions,
} from "../api-client";
import { useAuditedReason } from "../use-audited-reason";
import AuditedReasonDialog from "./AuditedReasonDialog.vue";
import OrganizationApprovalPanel from "./OrganizationApprovalPanel.vue";
import OrganizationMemberPanel from "./OrganizationMemberPanel.vue";
import OrganizationRolePanel from "./OrganizationRolePanel.vue";
import OrganizationTeamPanel from "./OrganizationTeamPanel.vue";
import OrganizationWorkspacePanel from "./OrganizationWorkspacePanel.vue";
import "../organization-admin.css";
const props = defineProps<{
    apiBaseUrl: string;
    routePath: string;
    organizationId: string;
  }>(),
  request = createApiClient(props.apiBaseUrl),
  requestTimeoutMs = 12_000,
  state = ref("loading"),
  data = ref<any>(null),
  summary = ref<any>(null),
  notice = ref(""),
  noticeKind = ref<"info" | "success" | "error">("info"),
  requestId = ref(""),
  busy = ref(false),
  refreshing = ref(false),
  secret = ref(""),
  form = ref<any>({ reason: "" }),
  invitationResults = ref<Array<{ email: string; status: "success" | "error"; message: string }>>(
    [],
  ),
  memberRoles = ref<Record<string, string>>({}),
  memberQuery = ref(""),
  memberStatus = ref(""),
  memberRole = ref(""),
  memberTeam = ref(""),
  memberSort = ref("name_asc"),
  memberPage = ref(1),
  invitationTab = ref<"pending" | "expired">("pending"),
  auditFilters = ref({ action: "", outcome: "", resource_type: "" }),
  resourceGrantPage = ref(1),
  resourceGrantStatus = ref("all"),
  resourceGrantForm = ref<any>({
    workspace_id: "",
    resource_type: "opportunity",
    resource_id: "",
    grantee_membership_id: "",
    actions: ["opportunity:read"],
    reason: "",
    expires_at: "",
  });
let loadSequence = 0;
const {
  request: auditedReasonRequest,
  open: auditedReasonOpen,
  ask: askAuditedReason,
  submit: submitAuditedReason,
  cancel: cancelAuditedReason,
} = useAuditedReason();
const view = computed(() =>
    props.routePath === "/org-admin" ? "summary" : props.routePath.split("/").pop() || "summary",
  ),
  title = computed(
    () =>
      (
        ({
          summary: "治理概览",
          members: "成员与邀请",
          roles: "角色与权限",
          workspaces: "工作区管理",
          teams: "团队管理",
          approvals: "审批模板",
          data: "组织数据",
          tokens: "组织 Token",
          audit: "组织审计",
        }) as any
      )[view.value] || "治理概览",
  ),
  subtitle = computed(() =>
    view.value === "workspaces"
      ? "创建和维护当前组织的数据边界，安全归档不再使用的工作区。"
      : view.value === "teams"
        ? "维护当前组织的团队、负责人、默认流程与成员协作关系。"
        : "管理当前组织的成员、权限、工作区和审计记录。",
  );
async function api(path: string, init: ApiRequestOptions = {}) {
  if (init.signal) return request<any>(path, init);
  const controller = new AbortController(),
    requestId = crypto.randomUUID(),
    timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await request<any>(path, {
      ...init,
      signal: controller.signal,
      requestId,
      traceId: requestId,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new ApiClientError(
        408,
        "organization_request_timeout",
        "blocked",
        "组织后台请求超时。",
        "检查网络或服务状态后重试。",
        requestId,
        requestId,
        { cause: error },
      );
    if (error instanceof TypeError)
      throw new ApiClientError(
        503,
        "organization_network_unavailable",
        "blocked",
        "网络连接不可用。",
        "恢复网络连接后重新刷新。",
        requestId,
        requestId,
        { cause: error },
      );
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
function applyFailure(error: unknown, pageFailure: boolean) {
  const failure = error instanceof ApiClientError ? error : null;
  requestId.value = failure?.requestId ?? "";
  noticeKind.value = "error";
  const userMessage =
    failure?.kind === "conflict"
      ? "数据已被其他操作更新，请先刷新并确认最新内容。"
      : failure?.userMessage;
  notice.value = failure
    ? failure.actionHint && failure.actionHint !== userMessage
      ? `${userMessage} ${failure.actionHint}`
      : (userMessage ?? "请求未完成。")
    : "稍后重试。";
  if (pageFailure)
    state.value = failure?.kind === "conflict" ? "conflict" : (failure?.kind ?? "error");
}
function validateHttps(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  input.setCustomValidity("Logo 地址必须以 https:// 开头，或保持为空。");
}
function clearFieldValidity(event: Event) {
  (event.currentTarget as HTMLInputElement).setCustomValidity("");
}
async function readView(currentView: string) {
  if (currentView === "summary") {
    const [profile, workspaces] = await Promise.all([
      api("/org/admin/profile"),
      api("/org/admin/workspaces"),
    ]);
    return {
      value: { ...profile.data, workspace_options: workspaces.data },
      requestId: profile.request_id,
    };
  }
  if (currentView === "audit") {
    const response = await api(auditPath());
    return { value: response.data, requestId: response.request_id };
  }
  if (currentView === "data") {
    const response = await api("/org/admin/data");
    return { value: response.data, requestId: response.request_id };
  }
  if (currentView === "roles") {
    const grantPath = `/org/${props.organizationId}/resource-grants?page=${resourceGrantPage.value}&limit=20${
        resourceGrantStatus.value === "all" ? "" : `&status=${resourceGrantStatus.value}`
      }`,
      [
        roles,
        authorization,
        members,
        workspaces,
        grants,
        grantTargets,
        activeGrants,
        expiredGrants,
        revokedGrants,
      ] = await Promise.all([
        api("/org/admin/roles"),
        api("/me/authorization"),
        api("/org/admin/members"),
        api("/org/admin/workspaces"),
        api(grantPath),
        api(`/org/${props.organizationId}/resource-grant-targets`),
        api(`/org/${props.organizationId}/resource-grants?page=1&limit=1&status=active`),
        api(`/org/${props.organizationId}/resource-grants?page=1&limit=1&status=expired`),
        api(`/org/${props.organizationId}/resource-grants?page=1&limit=1&status=revoked`),
      ]);
    return {
      value: {
        roles: roles.data,
        authorization: authorization.data,
        members: members.data.items ?? [],
        workspaces: workspaces.data,
        grants: grants.data,
        grant_meta: grants.meta,
        grant_counts: {
          active: Number((activeGrants.meta as any)?.total ?? 0),
          expired: Number((expiredGrants.meta as any)?.total ?? 0),
          revoked: Number((revokedGrants.meta as any)?.total ?? 0),
        },
        grant_targets: grantTargets.data,
      },
      requestId: roles.request_id,
    };
  }
  if (currentView === "workspaces") {
    const response = await api("/org/admin/workspaces");
    return {
      value: { workspaces: response.data },
      requestId: response.request_id,
    };
  }
  if (currentView === "teams") {
    const [teams, members] = await Promise.all([
      api("/org/admin/teams"),
      api("/org/admin/members"),
    ]);
    return {
      value: { teams: teams.data, members: members.data.items ?? [] },
      requestId: teams.request_id,
    };
  }
  const response = await api(`/org/admin/${currentView}`);
  return { value: response.data, requestId: response.request_id };
}
async function load(options: { background?: boolean; preserveNotice?: boolean } = {}) {
  const sequence = ++loadSequence,
    currentView = view.value,
    background = Boolean(options.background && summary.value && data.value);
  refreshing.value = background;
  if (!background) state.value = "loading";
  if (!options.preserveNotice) {
    notice.value = "";
    noticeKind.value = "info";
  }
  try {
    const [summaryResponse, viewResponse] = await Promise.all([
      api("/org/admin/summary"),
      readView(currentView),
    ]);
    if (sequence !== loadSequence) return;
    summary.value = summaryResponse.data;
    data.value = viewResponse.value;
    requestId.value = viewResponse.requestId;
    if (currentView === "summary") {
      form.value = {
        name: data.value.name,
        logo_url: data.value.logo_url ?? "",
        timezone: data.value.timezone,
        data_retention_days: data.value.data_retention_days,
        default_workspace_id: data.value.default_workspace_id,
        reason: "",
      };
    }
    if (currentView === "members") {
      if (!form.value.role_code)
        form.value = {
          emails: form.value.emails ?? form.value.email ?? "",
          role_code: "member",
          reason: form.value.reason ?? "",
        };
      for (const member of data.value?.items ?? [])
        if (!memberRoles.value[member.id])
          memberRoles.value[member.id] = member.roles?.[0] ?? "member";
    }
    if (currentView === "roles") {
      const existing = resourceGrantForm.value,
        workspaceId =
          existing.workspace_id ||
          data.value?.authorization?.workspace_id ||
          data.value?.workspaces?.[0]?.id ||
          "";
      resourceGrantForm.value = {
        ...existing,
        workspace_id: workspaceId,
        expires_at: existing.expires_at || defaultGrantExpiry(),
      };
    }
    state.value = (
      Array.isArray(data.value) ? data.value.length : Object.keys(data.value ?? {}).length
    )
      ? "ready"
      : "empty";
  } catch (error) {
    if (sequence !== loadSequence) return;
    const failure = error instanceof ApiClientError ? error : null,
      mustReplacePage = !background || ["expired", "forbidden"].includes(failure?.kind ?? "");
    applyFailure(error, mustReplacePage);
    rethrowUnexpectedError(error);
  } finally {
    if (sequence === loadSequence) refreshing.value = false;
  }
}
function auditPath() {
  const query = new URLSearchParams({ limit: "50" });
  if (auditFilters.value.action.trim()) query.set("action", auditFilters.value.action.trim());
  if (auditFilters.value.outcome) query.set("outcome", auditFilters.value.outcome);
  if (auditFilters.value.resource_type.trim())
    query.set("resource_type", auditFilters.value.resource_type.trim());
  return `/organizations/${props.organizationId}/audit-events?${query}`;
}
async function submit(
  path: string,
  value: any,
  method = "POST",
  options: { preserveForm?: boolean } = {},
) {
  if (busy.value) return;
  busy.value = true;
  try {
    const response = await api(path, { method, body: JSON.stringify(value) }),
      result = response.data,
      writeRequestId = response.request_id;
    secret.value = result?.secret ?? "";
    if (!options.preserveForm) form.value = { reason: "" };
    await load({ background: true, preserveNotice: true });
    noticeKind.value = "success";
    notice.value = secret.value
      ? "Token 明文仅显示这一次，请立即保存到受限位置。"
      : "操作已完成并写入审计。";
    requestId.value = writeRequestId;
    if (result?.secret) secret.value = result.secret;
    return true;
  } catch (error) {
    applyFailure(
      error,
      error instanceof ApiClientError && ["expired", "forbidden"].includes(error.kind),
    );
    rethrowUnexpectedError(error);
    return false;
  } finally {
    busy.value = false;
  }
}
async function inviteMembers() {
  if (busy.value) return;
  const rawEmails = String(form.value.emails ?? "")
      .split(/[\n,;]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    emails = [...new Set(rawEmails)],
    role_code = String(form.value.role_code ?? ""),
    reason = String(form.value.reason ?? "").trim(),
    validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
  invitationResults.value = [];
  if (!emails.length || !role_code || !reason || reason.length > 500) {
    noticeKind.value = "error";
    notice.value = "请填写邮箱、角色和 1–500 个字符的邀请原因。";
    return;
  }
  const invalid = emails.filter((value) => !validEmail(value)),
    accepted = emails.filter(validEmail);
  invitationResults.value = invalid.map((email) => ({
    email,
    status: "error" as const,
    message: "邮箱格式无效",
  }));
  busy.value = true;
  let lastWriteRequestId = "";
  try {
    for (const email of accepted) {
      try {
        const response = await api("/org/admin/invitations", {
          method: "POST",
          body: JSON.stringify({ email, role_code, reason }),
        });
        lastWriteRequestId = response.request_id;
        invitationResults.value.push({ email, status: "success", message: "已创建待投递邀请" });
      } catch (error) {
        const failure = error instanceof ApiClientError ? error : null;
        invitationResults.value.push({
          email,
          status: "error",
          message: failure?.userMessage ?? "请求未完成",
        });
        if (failure && ["expired", "forbidden"].includes(failure.kind)) {
          applyFailure(error, true);
          break;
        }
        rethrowUnexpectedError(error);
      }
    }
    const succeeded = invitationResults.value.filter((item) => item.status === "success").length,
      failed = invitationResults.value.length - succeeded,
      duplicates = rawEmails.length - emails.length;
    if (succeeded) await load({ background: true, preserveNotice: true });
    form.value = {
      emails: invitationResults.value
        .filter((item) => item.status === "error")
        .map((item) => item.email)
        .join("\n"),
      role_code,
      reason: failed ? reason : "",
    };
    noticeKind.value = failed ? "error" : "success";
    notice.value = `邀请处理完成：成功 ${succeeded}，失败 ${failed}${
      duplicates ? `，输入重复 ${duplicates} 条已合并` : ""
    }。`;
    requestId.value = lastWriteRequestId;
  } finally {
    busy.value = false;
  }
}
async function auditedReason(action: string) {
  return (
    (await askAuditedReason({
      title: `${action}原因`,
      description: "原因会与组织、操作者和目标对象一起写入审计记录。",
      initialValue: action,
    })) ?? ""
  );
}
async function memberAction(item: any) {
  const action = item.status === "active" ? "disable" : "restore";
  const reason = await auditedReason(action === "disable" ? "禁用成员" : "恢复成员");
  if (!reason) return;
  await submit(
    `/org/admin/members/${item.id}/actions`,
    { action, expected_version: item.version, reason },
    "POST",
    { preserveForm: true },
  );
}
async function assignRole(item: any) {
  const role_code = memberRoles.value[item.id] || item.roles[0] || "member";
  const reason = await auditedReason(`分配${roleText(role_code)}`);
  if (!reason) return;
  await submit(
    `/org/admin/members/${item.id}/roles`,
    { role_code, expected_version: item.version, reason },
    "POST",
    { preserveForm: true },
  );
}
async function invitationAction(item: any) {
  const reason = await auditedReason("撤销邀请");
  if (!reason) return;
  await submit(
    `/org/admin/invitations/${item.id}/actions`,
    { action: "revoke", expected_version: item.version, reason },
    "POST",
    { preserveForm: true },
  );
}
const resourceActions: Record<string, string[]> = {
  task: ["task:read", "task:update"],
  opportunity: ["opportunity:read", "opportunity:decide"],
  competitor: ["competitor:read"],
  sourcing: ["sourcing:read", "supplier_quote:manage", "cost:confirm"],
};
function defaultGrantExpiry(days = 7) {
  const value = new Date(Date.now() + days * 86_400_000);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}
function updateResourceGrantType(resourceType: string) {
  resourceGrantForm.value.resource_type = resourceType;
  resourceGrantForm.value.actions = [resourceActions[resourceType]?.[0]].filter(Boolean);
}
function validateGrantExpiry(value: string) {
  const expiresAt = new Date(value),
    remaining = expiresAt.valueOf() - Date.now();
  if (!Number.isFinite(expiresAt.valueOf()) || remaining <= 0 || remaining > 30 * 86_400_000) {
    noticeKind.value = "error";
    notice.value = "授权到期时间必须晚于当前时间，且不得超过 30 天。";
    return null;
  }
  return expiresAt.toISOString();
}
async function createResourceGrant() {
  if (busy.value) return;
  const expiresAt = validateGrantExpiry(resourceGrantForm.value.expires_at),
    actions = [...new Set(resourceGrantForm.value.actions ?? [])];
  if (!expiresAt) return;
  if (!actions.length) {
    noticeKind.value = "error";
    notice.value = "至少选择一项最小必要动作。";
    return;
  }
  busy.value = true;
  try {
    const response = await api(`/org/${props.organizationId}/resource-grants`, {
        method: "POST",
        body: JSON.stringify({
          ...resourceGrantForm.value,
          actions,
          reason: String(resourceGrantForm.value.reason ?? "").trim(),
          expires_at: expiresAt,
        }),
      }),
      writeRequestId = response.request_id,
      firstAction = resourceActions[resourceGrantForm.value.resource_type]?.[0];
    resourceGrantForm.value = {
      ...resourceGrantForm.value,
      resource_id: "",
      grantee_membership_id: "",
      actions: firstAction ? [firstAction] : [],
      reason: "",
      expires_at: defaultGrantExpiry(),
    };
    resourceGrantPage.value = 1;
    resourceGrantStatus.value = "all";
    await load({ background: true, preserveNotice: true });
    noticeKind.value = "success";
    notice.value = "指定资源授权已创建并写入审计。";
    requestId.value = writeRequestId;
  } catch (error) {
    applyFailure(
      error,
      error instanceof ApiClientError && ["expired", "forbidden"].includes(error.kind),
    );
    rethrowUnexpectedError(error);
  } finally {
    busy.value = false;
  }
}
async function updateResourceGrantStatus(status: string) {
  if (refreshing.value) return;
  resourceGrantStatus.value = status;
  resourceGrantPage.value = 1;
  await load({ background: true });
}
async function updateResourceGrantPage(page: number) {
  if (refreshing.value || page < 1) return;
  resourceGrantPage.value = page;
  await load({ background: true });
}
async function extendResourceGrant(value: { grant: any; reason: string; expires_at: string }) {
  if (busy.value) return;
  const expiresAt = validateGrantExpiry(value.expires_at);
  if (!expiresAt) return;
  if (
    await submit(
      `/org/${props.organizationId}/resource-grants/${value.grant.id}/expiry`,
      {
        expected_version: value.grant.version,
        reason: value.reason.trim(),
        expires_at: expiresAt,
      },
      "PATCH",
      { preserveForm: true },
    )
  )
    notice.value = "授权到期时间已更新并写入审计。";
}
async function revokeResourceGrant(grant: any) {
  const reason = await auditedReason("撤销指定资源授权");
  if (!reason) return;
  if (
    await submit(
      `/org/${props.organizationId}/resource-grants/${grant.id}/revoke`,
      { expected_version: grant.version, reason },
      "POST",
      { preserveForm: true },
    )
  )
    notice.value = "指定资源授权已撤销并写入审计。";
}
async function workspaceAction(item: any) {
  const action = item.status === "active" ? "archive" : "restore";
  const reason = await auditedReason(action === "archive" ? "归档工作区" : "恢复工作区");
  if (!reason) return false;
  const succeeded = await submit(
    `/org/admin/workspaces/${item.id}/actions`,
    {
      action,
      expected_version: item.version,
      reason,
    },
    "POST",
    { preserveForm: true },
  );
  if (succeeded)
    notice.value = action === "archive" ? "工作区已归档并写入审计。" : "工作区已恢复并写入审计。";
  return Boolean(succeeded);
}
async function createWorkspace(value: { name: string; slug: string; reason: string }) {
  const succeeded = await submit("/org/admin/workspaces", value, "POST", {
    preserveForm: true,
  });
  if (succeeded) notice.value = "工作区已创建并写入审计。";
  return Boolean(succeeded);
}
async function createTeam(value: {
  name: string;
  lead_membership_id: string;
  default_workflow_key: string;
  reason: string;
}) {
  const succeeded = await submit("/org/admin/teams", value, "POST", { preserveForm: true });
  if (succeeded) notice.value = "团队已创建并写入审计。";
  return Boolean(succeeded);
}
async function teamMemberAction(item: any, action: "assign" | "remove", membership_id: string) {
  const reason = await auditedReason(action === "assign" ? "分配团队成员" : "移除团队成员");
  if (!reason) return false;
  const succeeded = await submit(
    `/org/admin/teams/${item.id}/members`,
    {
      action,
      membership_id,
      reason,
    },
    "POST",
    { preserveForm: true },
  );
  if (succeeded)
    notice.value = action === "assign" ? "成员已分配并写入审计。" : "成员已移除并写入审计。";
  return Boolean(succeeded);
}
async function tokenAction(item: any, action: "rotate" | "revoke") {
  const reason = await auditedReason(action === "rotate" ? "轮换组织 Token" : "撤销组织 Token");
  if (!reason) return;
  await submit(`/org/admin/tokens/${item.id}/actions`, {
    action,
    expected_version: item.version,
    reason,
  });
}
const activeMembers = computed(() =>
    (data.value?.members ?? []).filter((item: any) => item.status === "active"),
  ),
  workspaceName = (id: string) =>
    data.value?.workspace_options?.find((item: any) => item.id === id)?.name ?? "未找到对应工作区",
  availableTeams = computed<string[]>(() => [
    ...new Set<string>(
      (data.value?.items ?? []).flatMap((item: any) => item.teams ?? []) as string[],
    ),
  ]),
  effectiveMemberStatus = (item: any) =>
    item.status !== "active"
      ? item.status
      : ["locked", "disabled"].includes(item.account_status)
        ? item.account_status
        : "active",
  filteredMembers = computed(() => {
    const query = memberQuery.value.trim().toLowerCase();
    return (data.value?.items ?? []).filter(
      (item: any) =>
        (!query ||
          String(item.email).toLowerCase().includes(query) ||
          String(item.display_name ?? "")
            .toLowerCase()
            .includes(query)) &&
        (!memberStatus.value || effectiveMemberStatus(item) === memberStatus.value) &&
        (!memberRole.value || item.roles?.includes(memberRole.value)) &&
        (!memberTeam.value || item.teams?.includes(memberTeam.value)),
    );
  }),
  sortedMembers = computed(() =>
    [...filteredMembers.value].sort((left: any, right: any) => {
      if (memberSort.value === "joined_desc")
        return new Date(right.joined_at).valueOf() - new Date(left.joined_at).valueOf();
      if (memberSort.value === "status_asc")
        return effectiveMemberStatus(left).localeCompare(effectiveMemberStatus(right), "zh-CN");
      return String(left.display_name || left.email).localeCompare(
        String(right.display_name || right.email),
        "zh-CN",
      );
    }),
  ),
  memberPageSize = 10,
  memberPageCount = computed(() =>
    Math.max(1, Math.ceil(sortedMembers.value.length / memberPageSize)),
  ),
  currentMemberPage = computed(() => Math.min(memberPage.value, memberPageCount.value)),
  pagedMembers = computed(() => {
    const start = (currentMemberPage.value - 1) * memberPageSize;
    return sortedMembers.value.slice(start, start + memberPageSize);
  }),
  pendingInvitations = computed(() =>
    (data.value?.invitations ?? []).filter(
      (item: any) =>
        ["pending_delivery", "pending_acceptance"].includes(item.status) &&
        new Date(item.expires_at).valueOf() > Date.now(),
    ),
  ),
  expiredInvitations = computed(() =>
    (data.value?.invitations ?? []).filter(
      (item: any) =>
        ["expired", "revoked"].includes(item.status) ||
        new Date(item.expires_at).valueOf() <= Date.now(),
    ),
  ),
  visibleInvitations = computed(() =>
    invitationTab.value === "pending" ? pendingInvitations.value : expiredInvitations.value,
  ),
  roleCapabilities = computed<string[]>(() => [
    ...new Set<string>(
      (data.value?.roles ?? []).flatMap((item: any) => item.capabilities ?? []) as string[],
    ),
  ]),
  rows = computed(() =>
    view.value === "members"
      ? (data.value?.items ?? [])
      : view.value === "roles"
        ? (data.value?.roles ?? [])
        : view.value === "workspaces"
          ? (data.value?.workspaces ?? [])
          : view.value === "teams"
            ? (data.value?.teams ?? [])
            : view.value === "approvals"
              ? (data.value?.items ?? [])
              : view.value === "tokens"
                ? (data.value ?? [])
                : view.value === "audit"
                  ? (data.value?.items ?? [])
                  : view.value === "data"
                    ? (data.value?.exports ?? [])
                    : [],
  ),
  fmt = (v: any) =>
    v == null
      ? "数据不足"
      : new Date(v).toString() !== "Invalid Date" && String(v).includes("T")
        ? new Date(v).toLocaleString("zh-CN", { hour12: false })
        : String(v);
const roleText = (v: string) =>
  (
    ({
      member: "普通成员",
      selection_manager: "选品经理",
      procurement_member: "采购成员",
      organization_admin: "组织管理员",
      auditor: "审计员",
      platform_super_admin: "平台超级管理员",
      platform_operations_admin: "平台运营管理员",
      platform_security_admin: "平台安全管理员",
    }) as Record<string, string>
  )[v] ?? "自定义角色";
const statusText = (v: string) =>
  (
    ({
      active: "正常使用",
      archived: "已停用",
      disabled: "已停用",
      locked: "已锁定",
      pending_delivery: "等待邮件服务",
      pending_acceptance: "等待接受",
      pending: "待处理",
      accepted: "已接受",
      expired: "已过期",
      revoked: "已撤销",
      rotated: "已轮换",
      queued: "等待处理",
      leased: "正在处理",
      succeeded: "已完成",
      dead_letter: "多次失败",
    }) as Record<string, string>
  )[v] ?? "其他状态";
const scopeText = (v: string) =>
  (
    ({
      own: "本人范围",
      team: "团队范围",
      organization: "组织范围",
      workspace: "工作区范围",
    }) as Record<string, string>
  )[v] ?? "指定范围";
const capabilityText = (v: string) =>
  (
    ({
      "task:read": "查看任务",
      "task:create": "创建任务",
      "task:update": "更新任务",
      "task:assign": "分配任务",
      "trend:read": "查看热点",
      "opportunity:read": "查看选品",
      "opportunity:decide": "提交选品决定",
      "opportunity:approve": "审核选品",
      "competitor:read": "查看竞品",
      "competitor:manage": "管理竞品监控",
      "sourcing:read": "查看供应链",
      "supplier_quote:manage": "维护供应商报价",
      "cost:confirm": "确认成本",
      "notification:read": "查看通知",
      "organization:manage": "管理组织",
      "membership:read": "查看成员",
      "membership:manage": "管理成员",
      "workspace:manage": "管理工作区",
      "team:manage": "管理团队",
      "role:read": "查看角色权限",
      "role:manage": "分配角色",
      "organization_token:manage": "管理组织 Token",
      "audit:read": "查看审计",
      "report:read": "查看报表",
      "provider:configure": "配置数据来源",
      "trend:manage": "管理热点规则",
    }) as Record<string, string>
  )[v] ?? "其他授权";
const summaryText = (v: string) =>
  (
    ({
      pending: "待处理",
      approved: "已通过",
      rejected: "已驳回",
      expired: "已过期",
      total: "全部",
    }) as Record<string, string>
  )[v] ?? "其他";
onMounted(() => void load());
</script>
<template>
  <section
    class="org-admin-center"
    :data-state="state"
    :aria-busy="state === 'loading' || refreshing"
  >
    <header class="org-admin-hero">
      <div>
        <p>组织后台</p>
        <h2>{{ title }}</h2>
        <span>{{ subtitle }}</span>
      </div>
      <div class="org-admin-refresh">
        <small v-if="summary?.observed_at">
          {{ refreshing ? "正在刷新当前组织数据…" : `更新于 ${fmt(summary.observed_at)}` }}
        </small>
        <button
          type="button"
          :disabled="state === 'loading' || refreshing"
          @click="load({ background: true })"
        >
          {{ refreshing ? "正在刷新…" : "刷新数据" }}
        </button>
      </div>
    </header>
    <div
      v-if="notice"
      class="org-admin-notice"
      :data-kind="noticeKind"
      :role="noticeKind === 'error' ? 'alert' : 'status'"
    >
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </div>
    <section v-if="state === 'loading'" class="org-admin-state">正在读取当前组织数据…</section>
    <section
      v-else-if="
        ['error', 'blocked', 'expired', 'forbidden', 'rate_limited', 'conflict'].includes(state)
      "
      class="org-admin-state"
    >
      <h3>
        {{
          state === "expired"
            ? "登录已失效"
            : state === "forbidden"
              ? "无权管理当前组织"
              : state === "blocked"
                ? "组织数据暂不可用"
                : state === "rate_limited"
                  ? "请求过于频繁"
                  : state === "conflict"
                    ? "数据版本已变化"
                    : "组织后台暂不可用"
        }}
      </h3>
      <p>{{ notice }}</p>
      <button @click="load()">重新加载</button>
    </section>
    <template v-else>
      <section v-if="view === 'summary'" class="org-admin-metrics">
        <article>
          <span>活动成员</span><b>{{ summary?.members?.active ?? 0 }}</b
          ><small>共 {{ summary?.members?.total ?? 0 }}</small>
        </article>
        <article>
          <span>活动工作区</span><b>{{ summary?.workspaces?.active ?? 0 }}</b
          ><small>共 {{ summary?.workspaces?.total ?? 0 }}</small>
        </article>
        <article>
          <span>团队</span><b>{{ summary?.teams?.active ?? 0 }}</b
          ><small>共 {{ summary?.teams?.total ?? 0 }}</small>
        </article>
        <article>
          <span>待处理审批</span><b>{{ summary?.pending_approvals ?? 0 }}</b
          ><small>实时汇总</small>
        </article>
        <article>
          <span>有效令牌</span><b>{{ summary?.active_tokens ?? 0 }}</b
          ><small>不展示明文</small>
        </article>
        <article>
          <span>近 7 日审计</span><b>{{ summary?.recent_audit_events ?? 0 }}</b
          ><small>组织范围</small>
        </article>
      </section>
      <section v-if="view === 'summary'" class="org-admin-grid">
        <article class="org-admin-card org-admin-profile">
          <header>
            <div>
              <p>组织基本资料</p>
              <h3>{{ data?.name }}</h3>
            </div>
            <i>{{ statusText(data?.status) }}</i>
          </header>
          <dl>
            <div>
              <dt>组织标识</dt>
              <dd>{{ data?.slug }}</dd>
            </div>
            <div>
              <dt>时区</dt>
              <dd>{{ data?.timezone }}</dd>
            </div>
            <div>
              <dt>数据保留</dt>
              <dd>{{ data?.data_retention_days }} 天</dd>
            </div>
            <div>
              <dt>默认工作区</dt>
              <dd>{{ workspaceName(data?.default_workspace_id) }}</dd>
            </div>
          </dl>
        </article>
        <form
          class="org-admin-card"
          @submit.prevent="
            submit('/org/admin/profile', { ...form, expected_version: data.version }, 'PATCH')
          "
        >
          <h3>更新组织资料</h3>
          <label
            >名称<input
              v-model="form.name"
              :placeholder="data?.name"
              required
              maxlength="120" /></label
          ><label
            >Logo HTTPS 地址<input
              v-model="form.logo_url"
              type="url"
              pattern="https://.*"
              maxlength="2048"
              title="请输入以 https:// 开头的地址"
              placeholder="https://…"
              @invalid="validateHttps"
              @input="clearFieldValidity"
            />
            <small>仅支持 HTTPS；留空表示暂不设置 Logo。</small></label
          ><label
            >时区<input
              v-model="form.timezone"
              :placeholder="data?.timezone"
              required
              maxlength="64" /></label
          ><label
            >数据保留天数<input
              v-model.number="form.data_retention_days"
              type="number"
              min="30"
              max="3650"
              required
              :placeholder="String(data?.data_retention_days)" /></label
          ><label
            >默认工作区<select v-model="form.default_workspace_id" required>
              <option disabled value="">请选择工作区</option>
              <option
                v-for="workspace in data?.workspace_options"
                :key="workspace.id"
                :value="workspace.id"
              >
                {{ workspace.name }}
              </option>
            </select></label
          ><label
            >变更原因<textarea v-model="form.reason" required maxlength="500"></textarea></label
          ><button :disabled="busy">{{ busy ? "正在保存…" : "保存并审计" }}</button>
        </form>
      </section>
      <OrganizationMemberPanel
        v-else-if="view === 'members'"
        :form="form"
        :busy="busy"
        :invitation-results="invitationResults"
        :invitation-tab="invitationTab"
        :pending-invitations="pendingInvitations"
        :expired-invitations="expiredInvitations"
        :visible-invitations="visibleInvitations"
        :members="pagedMembers"
        :filtered-members="filteredMembers.length"
        :total-members="data?.items?.length ?? 0"
        :member-query="memberQuery"
        :member-status="memberStatus"
        :member-role="memberRole"
        :member-team="memberTeam"
        :member-sort="memberSort"
        :member-page="currentMemberPage"
        :member-page-count="memberPageCount"
        :available-teams="availableTeams"
        :member-roles="memberRoles"
        :role-text="roleText"
        :scope-text="scopeText"
        :status-text="statusText"
        :effective-member-status="effectiveMemberStatus"
        :format-time="fmt"
        @invite="inviteMembers"
        @invitation-action="invitationAction"
        @update-invitation-tab="invitationTab = $event"
        @update-member-query="
          memberQuery = $event;
          memberPage = 1;
        "
        @update-member-status="
          memberStatus = $event;
          memberPage = 1;
        "
        @update-member-role="
          memberRole = $event;
          memberPage = 1;
        "
        @update-member-team="
          memberTeam = $event;
          memberPage = 1;
        "
        @update-member-sort="
          memberSort = $event;
          memberPage = 1;
        "
        @update-member-page="memberPage = $event"
        @reset-member-filters="
          memberQuery = '';
          memberStatus = '';
          memberRole = '';
          memberTeam = '';
          memberSort = 'name_asc';
          memberPage = 1;
        "
        @update-member-role-selection="memberRoles[$event.memberId] = $event.role"
        @assign-role="assignRole"
        @member-action="memberAction"
      />
      <OrganizationRolePanel
        v-else-if="view === 'roles'"
        :roles="rows"
        :capabilities="roleCapabilities"
        :authorization="data?.authorization"
        :members="data?.members ?? []"
        :workspaces="data?.workspaces ?? []"
        :grants="data?.grants ?? []"
        :grant-meta="data?.grant_meta"
        :grant-counts="data?.grant_counts ?? { active: 0, expired: 0, revoked: 0 }"
        :grant-status="resourceGrantStatus"
        :grant-targets="data?.grant_targets ?? []"
        :grant-form="resourceGrantForm"
        :resource-actions="resourceActions"
        :busy="busy || refreshing"
        :role-text="roleText"
        :scope-text="scopeText"
        :capability-text="capabilityText"
        :format-time="fmt"
        @update-grant-type="updateResourceGrantType"
        @update-grant-status="updateResourceGrantStatus"
        @update-grant-page="updateResourceGrantPage"
        @create-grant="createResourceGrant"
        @extend-grant="extendResourceGrant"
        @revoke-grant="revokeResourceGrant"
      />
      <OrganizationWorkspacePanel
        v-else-if="view === 'workspaces'"
        :workspaces="data?.workspaces ?? []"
        :default-workspace-id="summary?.organization?.default_workspace_id"
        :busy="busy"
        :create-workspace="createWorkspace"
        :perform-workspace-action="workspaceAction"
      />
      <OrganizationTeamPanel
        v-else-if="view === 'teams'"
        :teams="data?.teams ?? []"
        :members="data?.members ?? []"
        :busy="busy"
        :create-team="createTeam"
        :perform-member-action="teamMemberAction"
      />
      <OrganizationApprovalPanel
        v-else-if="view === 'approvals'"
        :templates="data?.templates ?? []"
        :approvals="rows"
        :summary="data?.summary ?? {}"
        :status-text="statusText"
        :summary-text="summaryText"
        :format-time="fmt"
      />
      <section v-else-if="view === 'tokens'" class="org-admin-grid">
        <form
          class="org-admin-card"
          @submit.prevent="
            submit('/org/admin/tokens', {
              ...form,
              scopes: form.scopes || ['task:read'],
              ttl_days: form.ttl_days || 90,
            })
          "
        >
          <h3>创建只读访问令牌</h3>
          <label>名称<input v-model="form.name" required /></label
          ><label
            >允许查看的内容<select v-model="form.scopes" multiple required>
              <option value="task:read">任务</option>
              <option value="trend:read">热点趋势</option>
              <option value="opportunity:read">选品机会</option>
              <option value="report:read">报表</option>
            </select></label
          ><label
            >有效天数<input
              v-model.number="form.ttl_days"
              type="number"
              min="1"
              max="365"
              value="90" /></label
          ><label>创建原因<textarea v-model="form.reason" required></textarea></label
          ><button :disabled="busy">创建令牌</button>
        </form>
        <article class="org-admin-card">
          <h3>令牌明文</h3>
          <strong class="org-admin-secret-warning"
            >只显示一次：离开本页后无法再次查看，请立即保存到受限位置。</strong
          >
          <code v-if="secret" class="org-admin-secret">{{ secret }}</code>
          <p v-else>明文只在创建或轮换成功后显示一次。</p>
        </article>
        <article class="org-admin-card org-admin-wide">
          <div v-for="x in rows" :key="x.id" class="org-admin-line">
            <div>
              <b>{{ x.name }}</b
              ><small
                >{{ x.token_prefix }}… · {{ x.scopes.map(capabilityText).join("、") }} · 到期
                {{ fmt(x.expires_at) }}</small
              >
            </div>
            <div class="org-admin-actions">
              <button
                v-if="x.status === 'active'"
                type="button"
                :disabled="busy"
                @click="tokenAction(x, 'rotate')"
              >
                轮换
              </button>
              <button
                v-if="x.status === 'active'"
                type="button"
                :disabled="busy"
                @click="tokenAction(x, 'revoke')"
              >
                撤销
              </button>
              <i>{{ statusText(x.status) }}</i>
            </div>
          </div>
          <p v-if="!rows.length">尚无组织访问令牌。</p>
        </article>
      </section>
      <section v-else-if="view === 'data'" class="org-admin-card">
        <header class="org-admin-section-header">
          <div>
            <p>跨工作区比较</p>
            <h3>组织数据概览</h3>
          </div>
          <small>截至 {{ fmt(data?.observed_at) }}</small>
        </header>
        <div class="org-admin-comparison" role="table" aria-label="跨工作区数据比较">
          <div role="row" class="org-admin-matrix-head">
            <b role="columnheader">工作区</b><b role="columnheader">热点</b
            ><b role="columnheader">机会</b><b role="columnheader">任务</b
            ><b role="columnheader">导出</b>
          </div>
          <div v-for="item in data?.comparisons" :key="item.id" role="row">
            <span role="cell"
              ><b>{{ item.name }}</b
              ><small>{{ statusText(item.status) }}</small></span
            ><span role="cell">{{ item.trends }}</span
            ><span role="cell">{{ item.opportunities }}</span
            ><span role="cell">{{ item.tasks }}</span
            ><span role="cell">{{ item.exports }}</span>
          </div>
        </div>
        <h3 class="org-admin-subheading">最近导出</h3>
        <div v-for="x in rows" :key="x.id" class="org-admin-line">
          <div>
            <b>{{ x.workspace_name }} · {{ x.report_type }}</b
            ><small>{{ x.row_count ?? "等待生成" }} 行 · {{ fmt(x.created_at) }}</small>
          </div>
          <i>{{ statusText(x.status) }}</i>
        </div>
        <p v-if="!rows.length">暂无组织导出记录。</p>
      </section>
      <section v-else class="org-admin-card">
        <form class="org-admin-filters org-admin-audit-filters" @submit.prevent="load()">
          <label
            >操作<input v-model="auditFilters.action" placeholder="例如 organization.member"
          /></label>
          <label
            >结果<select v-model="auditFilters.outcome">
              <option value="">全部结果</option>
              <option value="succeeded">成功</option>
              <option value="failed">失败</option>
              <option value="blocked">已阻止</option>
            </select></label
          >
          <label
            >对象<input v-model="auditFilters.resource_type" placeholder="例如 membership"
          /></label>
          <button>应用筛选</button>
        </form>
        <div v-for="x in rows" :key="x.id" class="org-admin-line">
          <div>
            <b>{{ x.action || x.report_type }}</b
            ><small
              >{{ x.resource_type || x.status }} · {{ fmt(x.occurred_at || x.created_at) }}</small
            >
          </div>
          <i>{{ x.outcome || x.status }}</i>
        </div>
        <p v-if="!rows.length">暂无记录；不会用示例数据补齐。</p>
      </section>
    </template>
    <AuditedReasonDialog
      :open="auditedReasonOpen"
      :title="auditedReasonRequest?.title || '填写审计原因'"
      :description="auditedReasonRequest?.description || ''"
      :initial-value="auditedReasonRequest?.initialValue"
      :minimum-length="auditedReasonRequest?.minimumLength"
      @submit="submitAuditedReason"
      @cancel="cancelAuditedReason"
    />
  </section>
</template>
