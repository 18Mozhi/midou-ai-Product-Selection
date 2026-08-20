<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import "../organization-admin.css";
const props = defineProps<{
    apiBaseUrl: string;
    routePath: string;
    organizationId: string;
  }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref("loading"),
  data = ref<any>(null),
  summary = ref<any>(null),
  notice = ref(""),
  requestId = ref(""),
  busy = ref(false),
  secret = ref(""),
  form = ref<any>({ reason: "" }),
  memberRoles = ref<Record<string, string>>({}),
  teamMembers = ref<Record<string, string>>({}),
  memberQuery = ref(""),
  memberStatus = ref(""),
  memberRole = ref(""),
  memberTeam = ref(""),
  invitationTab = ref<"pending" | "expired">("pending"),
  auditFilters = ref({ action: "", outcome: "", resource_type: "" });
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
  );
async function api(path: string, init?: RequestInit) {
  try {
    const response = await request<any>(path, init ?? {});
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    state.value = failure?.kind === "conflict" ? "conflict" : (failure?.kind ?? "error");
    notice.value = failure?.actionHint ?? "稍后重试。";
    throw error;
  }
}
async function load() {
  state.value = "loading";
  notice.value = "";
  try {
    summary.value = await api("/org/admin/summary");
    if (view.value === "summary") {
      const [profile, workspaces] = await Promise.all([
        api("/org/admin/profile"),
        api("/org/admin/workspaces"),
      ]);
      data.value = { ...profile, workspace_options: workspaces };
      form.value = {
        name: data.value.name,
        logo_url: data.value.logo_url ?? "",
        timezone: data.value.timezone,
        data_retention_days: data.value.data_retention_days,
        default_workspace_id: data.value.default_workspace_id,
        reason: "",
      };
    } else if (view.value === "audit") data.value = await api(auditPath());
    else if (view.value === "data") data.value = await api("/org/admin/data");
    else if (view.value === "teams") {
      const [teams, members] = await Promise.all([
        api("/org/admin/teams"),
        api("/org/admin/members"),
      ]);
      data.value = { teams, members: members.items ?? [] };
    } else data.value = await api(`/org/admin/${view.value}`);
    state.value = (
      Array.isArray(data.value) ? data.value.length : Object.keys(data.value ?? {}).length
    )
      ? "ready"
      : "empty";
  } catch {}
}
function auditPath() {
  const query = new URLSearchParams({ limit: "50" });
  if (auditFilters.value.action.trim()) query.set("action", auditFilters.value.action.trim());
  if (auditFilters.value.outcome) query.set("outcome", auditFilters.value.outcome);
  if (auditFilters.value.resource_type.trim())
    query.set("resource_type", auditFilters.value.resource_type.trim());
  return `/organizations/${props.organizationId}/audit-events?${query}`;
}
async function submit(path: string, value: any, method = "POST") {
  busy.value = true;
  try {
    const result = await api(path, { method, body: JSON.stringify(value) });
    secret.value = result?.secret ?? "";
    notice.value = secret.value
      ? "Token 明文仅显示这一次，请立即保存到受限位置。"
      : "操作已完成并写入审计。";
    form.value = { reason: "" };
    await load();
    if (result?.secret) secret.value = result.secret;
  } catch {
  } finally {
    busy.value = false;
  }
}
function auditedReason(action: string) {
  return window.prompt(`${action}原因（会写入审计记录）`, action) ?? "";
}
async function memberAction(item: any) {
  const action = item.status === "active" ? "disable" : "restore";
  const reason = auditedReason(action === "disable" ? "禁用成员" : "恢复成员");
  if (!reason) return;
  await submit(`/org/admin/members/${item.id}/actions`, {
    action,
    expected_version: item.version,
    reason,
  });
}
async function assignRole(item: any) {
  const role_code = memberRoles.value[item.id] || item.roles[0] || "member";
  const reason = auditedReason(`分配${roleText(role_code)}`);
  if (!reason) return;
  await submit(`/org/admin/members/${item.id}/roles`, { role_code, reason });
}
async function workspaceAction(item: any) {
  const action = item.status === "active" ? "archive" : "restore";
  const reason = auditedReason(action === "archive" ? "归档工作区" : "恢复工作区");
  if (!reason) return;
  await submit(`/org/admin/workspaces/${item.id}/actions`, {
    action,
    expected_version: item.version,
    reason,
  });
}
async function teamMemberAction(item: any, action: "assign" | "remove") {
  const membership_id = teamMembers.value[item.id]?.trim();
  if (!membership_id) {
    notice.value = "请先选择当前组织成员。";
    return;
  }
  const reason = auditedReason(action === "assign" ? "分配团队成员" : "移除团队成员");
  if (!reason) return;
  await submit(`/org/admin/teams/${item.id}/members`, {
    action,
    membership_id,
    reason,
  });
}
async function tokenAction(item: any, action: "rotate" | "revoke") {
  const reason = auditedReason(action === "rotate" ? "轮换组织 Token" : "撤销组织 Token");
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
  filteredMembers = computed(() => {
    const query = memberQuery.value.trim().toLowerCase();
    return (data.value?.items ?? []).filter(
      (item: any) =>
        (!query || String(item.email).toLowerCase().includes(query)) &&
        (!memberStatus.value || item.status === memberStatus.value) &&
        (!memberRole.value || item.roles?.includes(memberRole.value)) &&
        (!memberTeam.value || item.teams?.includes(memberTeam.value)),
    );
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
      (data.value ?? []).flatMap((item: any) => item.capabilities ?? []) as string[],
    ),
  ]),
  rows = computed(() =>
    view.value === "members"
      ? (data.value?.items ?? [])
      : view.value === "roles"
        ? (data.value ?? [])
        : view.value === "workspaces"
          ? (data.value ?? [])
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
  (({ organization: "组织范围", workspace: "工作区范围" }) as Record<string, string>)[v] ??
  "指定范围";
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
onMounted(load);
</script>
<template>
  <section class="org-admin-center" :data-state="state">
    <header class="org-admin-hero">
      <div>
        <p>组织后台</p>
        <h2>{{ title }}</h2>
        <span>管理当前组织的成员、权限、工作区和审计记录。</span>
      </div>
      <button @click="load">刷新数据</button>
    </header>
    <div v-if="notice" class="org-admin-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </div>
    <section v-if="state === 'loading'" class="org-admin-state">正在读取当前组织数据…</section>
    <section
      v-else-if="['error', 'expired', 'forbidden', 'rate_limited', 'conflict'].includes(state)"
      class="org-admin-state"
    >
      <h3>
        {{
          state === "expired"
            ? "登录已失效"
            : state === "forbidden"
              ? "无权管理当前组织"
              : state === "rate_limited"
                ? "请求过于频繁"
                : state === "conflict"
                  ? "数据版本已变化"
                  : "组织后台暂不可用"
        }}
      </h3>
      <p>{{ notice }}</p>
      <button @click="load">重新加载</button>
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
          ><label>Logo HTTPS 地址<input v-model="form.logo_url" placeholder="https://…" /></label
          ><label
            >时区<input v-model="form.timezone" :placeholder="data?.timezone" required /></label
          ><label
            >数据保留天数<input
              v-model.number="form.data_retention_days"
              type="number"
              min="30"
              max="3650"
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
          ><button :disabled="busy">保存并审计</button>
        </form>
      </section>
      <section v-else-if="view === 'members'" class="org-admin-grid">
        <form class="org-admin-card" @submit.prevent="submit('/org/admin/invitations', form)">
          <h3>邀请成员</h3>
          <label>邮箱<input v-model="form.email" type="email" required /></label
          ><label
            >角色<select v-model="form.role_code" required>
              <option value="member">普通成员</option>
              <option value="selection_manager">选品经理</option>
              <option value="procurement_member">采购成员</option>
              <option value="organization_admin">组织管理员</option>
              <option value="auditor">审计员</option>
            </select></label
          ><label>原因<textarea v-model="form.reason" required></textarea></label
          ><button :disabled="busy">创建邀请</button
          ><small>邮件服务尚未配置时，邀请会显示“等待邮件服务”，不会假装已经发送。</small>
        </form>
        <article class="org-admin-card">
          <header class="org-admin-section-header">
            <h3>邀请记录</h3>
            <nav aria-label="邀请状态">
              <button
                :aria-pressed="invitationTab === 'pending'"
                @click="invitationTab = 'pending'"
              >
                待接受 {{ pendingInvitations.length }}
              </button>
              <button
                :aria-pressed="invitationTab === 'expired'"
                @click="invitationTab = 'expired'"
              >
                已失效 {{ expiredInvitations.length }}
              </button>
            </nav>
          </header>
          <p v-if="!visibleInvitations.length">
            {{ invitationTab === "pending" ? "暂无待接受邀请。" : "暂无已失效邀请。" }}
          </p>
          <div v-for="x in visibleInvitations" :key="x.id" class="org-admin-line">
            <div>
              <b>{{ x.email }}</b
              ><small>{{ roleText(x.role_code) }} · {{ fmt(x.expires_at) }}</small>
            </div>
            <i>{{ invitationTab === "expired" ? "已失效" : statusText(x.status) }}</i>
          </div>
        </article>
        <article class="org-admin-card org-admin-wide">
          <header class="org-admin-section-header">
            <div>
              <h3>组织成员</h3>
              <small>显示 {{ filteredMembers.length }} / {{ data?.items?.length ?? 0 }} 人</small>
            </div>
          </header>
          <div class="org-admin-filters" aria-label="成员筛选">
            <label
              >搜索<input v-model="memberQuery" type="search" placeholder="姓名或邮箱"
            /></label>
            <label
              >状态<select v-model="memberStatus">
                <option value="">全部状态</option>
                <option value="active">正常使用</option>
                <option value="disabled">已停用</option>
                <option value="locked">已锁定</option>
              </select></label
            >
            <label
              >角色<select v-model="memberRole">
                <option value="">全部角色</option>
                <option
                  v-for="role in [
                    'member',
                    'selection_manager',
                    'procurement_member',
                    'organization_admin',
                    'auditor',
                  ]"
                  :key="role"
                  :value="role"
                >
                  {{ roleText(role) }}
                </option>
              </select></label
            >
            <label
              >团队<select v-model="memberTeam">
                <option value="">全部团队</option>
                <option v-for="team in availableTeams" :key="team" :value="team">{{ team }}</option>
              </select></label
            >
          </div>
          <div v-for="x in filteredMembers" :key="x.id" class="org-admin-line">
            <div>
              <b>{{ x.email }}</b
              ><small
                >{{ x.roles.map(roleText).join("、") || "尚未分配角色" }} ·
                {{ x.teams?.join("、") || "未加入团队" }} ·
                {{ x.scopes.map(scopeText).join("、") || "无数据范围" }} · 第
                {{ x.version }} 版</small
              >
            </div>
            <div class="org-admin-actions">
              <details class="org-admin-technical">
                <summary>技术详情</summary>
                <code>成员 ID：{{ x.id }}</code>
              </details>
              <select v-model="memberRoles[x.id]" aria-label="选择成员角色">
                <option
                  v-for="role in [
                    'member',
                    'selection_manager',
                    'procurement_member',
                    'organization_admin',
                    'auditor',
                  ]"
                  :key="role"
                  :value="role"
                >
                  {{ roleText(role) }}
                </option>
              </select>
              <button type="button" :disabled="busy" @click="assignRole(x)">分配角色</button>
              <button type="button" :disabled="busy" @click="memberAction(x)">
                {{ x.status === "active" ? "禁用成员" : "恢复成员" }}
              </button>
              <i>{{ statusText(x.status) }}</i>
            </div>
          </div>
          <p v-if="!filteredMembers.length">没有符合当前筛选条件的成员。</p>
        </article>
      </section>
      <section v-else-if="view === 'roles'" class="org-admin-role-grid">
        <article v-for="x in rows" :key="x.code" class="org-admin-card">
          <i>{{ roleText(x.code) }}</i>
          <h3>{{ x.name }}</h3>
          <p>{{ x.description }}</p>
          <div class="org-admin-chips">
            <span v-for="c in x.capabilities" :key="c">{{ capabilityText(c) }}</span>
          </div>
          <small>影响预览：该角色可执行 {{ x.capabilities.length }} 项业务操作。</small>
        </article>
        <article class="org-admin-card org-admin-role-matrix">
          <header>
            <div>
              <p>能力矩阵</p>
              <h3>角色影响对比</h3>
            </div>
          </header>
          <div role="table" aria-label="角色能力矩阵">
            <div role="row" class="org-admin-matrix-head">
              <b role="columnheader">业务能力</b
              ><b v-for="role in rows" :key="role.code" role="columnheader">{{
                roleText(role.code)
              }}</b>
            </div>
            <div v-for="capability in roleCapabilities" :key="capability" role="row">
              <span role="cell">{{ capabilityText(capability) }}</span
              ><span v-for="role in rows" :key="role.code" role="cell">{{
                role.capabilities.includes(capability) ? "具备" : "—"
              }}</span>
            </div>
          </div>
        </article>
      </section>
      <section v-else-if="view === 'workspaces'" class="org-admin-grid">
        <form class="org-admin-card" @submit.prevent="submit('/org/admin/workspaces', form)">
          <h3>创建工作区</h3>
          <label>名称<input v-model="form.name" required /></label
          ><label>英文标识<input v-model="form.slug" pattern="[a-z0-9-]+" required /></label
          ><label>创建原因<textarea v-model="form.reason" required></textarea></label
          ><button :disabled="busy">创建工作区</button>
        </form>
        <article class="org-admin-card org-admin-wide">
          <h3>工作区</h3>
          <div v-for="x in data?.workspaces" :key="x.id" class="org-admin-line">
            <div>
              <b>{{ x.name }}</b
              ><small>{{ x.slug }} · {{ x.member_count }} 名成员 · 第 {{ x.version }} 版</small>
            </div>
            <div class="org-admin-actions">
              <button type="button" :disabled="busy" @click="workspaceAction(x)">
                {{ x.status === "active" ? "归档" : "恢复" }}</button
              ><i>{{ statusText(x.status) }}</i>
            </div>
          </div>
        </article>
      </section>
      <section v-else-if="view === 'teams'" class="org-admin-grid">
        <form class="org-admin-card" @submit.prevent="submit('/org/admin/teams', form)">
          <h3>创建团队</h3>
          <label>名称<input v-model="form.name" required /></label
          ><label
            >负责人（可选）<select v-model="form.lead_membership_id">
              <option value="">暂不设置</option>
              <option v-for="member in activeMembers" :key="member.id" :value="member.id">
                {{ member.email }}
              </option>
            </select></label
          ><label>默认工作流程（可选）<input v-model="form.default_workflow_key" /></label
          ><label>创建原因<textarea v-model="form.reason" required></textarea></label
          ><button :disabled="busy">创建团队</button>
        </form>
        <article class="org-admin-card org-admin-wide">
          <h3>团队</h3>
          <div v-for="x in rows" :key="x.id" class="org-admin-line">
            <div>
              <b>{{ x.name }}</b
              ><small>{{ x.member_count }} 名成员 · 负责人 {{ x.lead_email || "未设置" }}</small>
            </div>
            <div class="org-admin-actions">
              <select v-model="teamMembers[x.id]" aria-label="选择团队成员">
                <option value="">请选择成员</option>
                <option v-for="member in activeMembers" :key="member.id" :value="member.id">
                  {{ member.email }}
                </option>
              </select>
              <button type="button" :disabled="busy" @click="teamMemberAction(x, 'assign')">
                分配成员
              </button>
              <button type="button" :disabled="busy" @click="teamMemberAction(x, 'remove')">
                移除成员
              </button>
              <i>{{ statusText(x.status) }}</i>
            </div>
          </div>
        </article>
      </section>
      <section v-else-if="view === 'approvals'" class="org-admin-card">
        <header class="org-admin-section-header">
          <div>
            <p>组织治理</p>
            <h3>审批模板</h3>
          </div>
          <small>模板按所属工作区展示；发布与修改继续使用既有审批合同。</small>
        </header>
        <div class="org-admin-template-grid">
          <article v-for="template in data?.templates" :key="template.id">
            <i>{{ statusText(template.status) }}</i
            ><b>{{ template.name }}</b
            ><small
              >{{ template.workspace_name }} · {{ template.node_count }} 个节点 · 当前第
              {{ template.current_version }} 版</small
            >
          </article>
        </div>
        <h3 class="org-admin-subheading">审批记录</h3>
        <div class="org-admin-summary-row">
          <span v-for="(v, k) in data?.summary" :key="k"
            ><b>{{ v }}</b
            ><small>{{ summaryText(String(k)) }}</small></span
          >
        </div>
        <div v-for="x in rows" :key="x.id" class="org-admin-line">
          <div>
            <b>{{ x.title }}</b
            ><small
              >当前第 {{ x.current_node_ordinal }} 阶段 · 提交于 {{ fmt(x.created_at) }}</small
            >
            <details class="org-admin-technical">
              <summary>技术详情</summary>
              <code>记录 ID：{{ x.resource_id }}</code>
              <code>模板 ID：{{ x.template_id }}</code>
            </details>
          </div>
          <i>{{ statusText(x.status) }}</i>
        </div>
        <p v-if="!rows.length">暂无组织级审批记录。</p>
      </section>
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
        <form class="org-admin-filters org-admin-audit-filters" @submit.prevent="load">
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
  </section>
</template>
