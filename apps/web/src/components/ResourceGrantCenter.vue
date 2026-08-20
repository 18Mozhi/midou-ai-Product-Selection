<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import type {
  CurrentAuthorizationSummary,
  EligibleResourceGrantMember,
  ResourceGrantSummary,
  ResourceGrantStatus,
  ResourceGrantType,
} from "@scoutops/contracts";
const props = defineProps<{ apiBaseUrl: string }>();
const apiRequest = createApiClient(props.apiBaseUrl);
type State = "loading" | "ready" | "empty" | "error" | "forbidden" | "expired" | "blocked";
const state = ref<State>("loading"),
  current = ref<CurrentAuthorizationSummary | null>(null),
  grants = ref<ResourceGrantSummary[]>([]),
  members = ref<EligibleResourceGrantMember[]>([]),
  selected = ref<ResourceGrantSummary | null>(null),
  filter = ref<"all" | ResourceGrantStatus>("all"),
  requestId = ref(""),
  notice = ref(""),
  showCreate = ref(false),
  busy = ref(false);
const actionMap: Record<ResourceGrantType, readonly [string, ...string[]]> = {
  task: ["task:read", "task:update"],
  opportunity: ["opportunity:read", "opportunity:decide"],
  competitor: ["competitor:read"],
  sourcing: ["sourcing:read", "supplier_quote:manage", "cost:confirm"],
};
const defaultExpiry = () => {
  const value = new Date(Date.now() + 7 * 86400000);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
};
const form = reactive({
    workspace_id: "",
    resource_type: "opportunity" as ResourceGrantType,
    resource_id: "",
    grantee_membership_id: "",
    actions: ["opportunity:read"] as string[],
    reason: "",
    expires_at: defaultExpiry(),
  }),
  mutation = reactive({ reason: "", expires_at: defaultExpiry() });
const canRead = computed(() => current.value?.capabilities.includes("role:read")),
  canManage = computed(() => current.value?.capabilities.includes("role:manage")),
  filtered = computed(() =>
    grants.value.filter((item) => filter.value === "all" || item.effective_status === filter.value),
  );
async function request<T>(path: string, init: RequestInit = {}) {
  try {
    const response = await apiRequest<T>(path, init);
    requestId.value = response.request_id;
    return response;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    throw new Error(
      failure?.kind === "expired" || failure?.kind === "forbidden"
        ? failure.kind
        : ["grant_action_not_allowed", "grant_expiry_invalid", "grant_target_forbidden"].includes(
              failure?.code ?? "",
            )
          ? "blocked"
          : "error",
    );
  }
}
async function load() {
  state.value = "loading";
  notice.value = "";
  try {
    current.value = (await request<CurrentAuthorizationSummary>("/me/authorization")).data;
    form.workspace_id = current.value.workspace_id ?? "";
    const path = canRead.value
      ? `/org/${current.value.organization_id}/resource-grants?page=1&limit=100`
      : "/me/resource-grants";
    grants.value = (await request<ResourceGrantSummary[]>(path)).data;
    if (canManage.value)
      members.value = (
        await request<EligibleResourceGrantMember[]>(
          `/org/${current.value.organization_id}/resource-grant-targets`,
        )
      ).data;
    selected.value = grants.value[0] ?? null;
    state.value = grants.value.length ? "ready" : "empty";
  } catch (error) {
    state.value = (error instanceof Error ? error.message : "error") as State;
  }
}
function selectType() {
  form.actions = [actionMap[form.resource_type][0]];
}
async function createGrant() {
  if (!current.value) return;
  busy.value = true;
  try {
    const result = await request<ResourceGrantSummary>(
      `/org/${current.value.organization_id}/resource-grants`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          ...form,
          expires_at: new Date(form.expires_at).toISOString(),
        }),
      },
    );
    grants.value.unshift(result.data);
    selected.value = result.data;
    showCreate.value = false;
    notice.value = "授权已创建并写入审计。";
    state.value = "ready";
    form.reason = "";
  } catch (error) {
    state.value = (error instanceof Error ? error.message : "error") as State;
  } finally {
    busy.value = false;
  }
}
async function extend() {
  if (!current.value || !selected.value) return;
  busy.value = true;
  try {
    const result = await request<ResourceGrantSummary>(
      `/org/${current.value.organization_id}/resource-grants/${selected.value.id}/expiry`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          expected_version: selected.value.version,
          reason: mutation.reason,
          expires_at: new Date(mutation.expires_at).toISOString(),
        }),
      },
    );
    replace(result.data);
    notice.value = "到期时间已延长并写入审计。";
    mutation.reason = "";
  } catch (error) {
    state.value = (error instanceof Error ? error.message : "error") as State;
  } finally {
    busy.value = false;
  }
}
async function revoke() {
  if (
    !current.value ||
    !selected.value ||
    !window.confirm("确认撤销这条指定资源授权？撤销后立即失效。")
  )
    return;
  busy.value = true;
  try {
    const result = await request<ResourceGrantSummary>(
      `/org/${current.value.organization_id}/resource-grants/${selected.value.id}/revoke`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          expected_version: selected.value.version,
          reason: mutation.reason,
        }),
      },
    );
    replace(result.data);
    notice.value = "授权已撤销并立即失效。";
    mutation.reason = "";
  } catch (error) {
    state.value = (error instanceof Error ? error.message : "error") as State;
  } finally {
    busy.value = false;
  }
}
function replace(grant: ResourceGrantSummary) {
  grants.value = grants.value.map((item) => (item.id === grant.id ? grant : item));
  selected.value = grant;
}
const statusLabel = (status: ResourceGrantStatus) =>
  ({ active: "生效中", expired: "已到期", revoked: "已撤销" })[status];
const typeLabel = (type: ResourceGrantType) =>
  ({
    task: "任务",
    opportunity: "机会",
    competitor: "竞品",
    sourcing: "供应链",
  })[type];
onMounted(load);
function setFilter(value: string) {
  filter.value = value as typeof filter.value;
}
</script>
<template>
  <main class="grant-page" data-testid="resource-grants">
    <aside class="authz-sidebar">
      <a href="/" class="identity-brand"><span>选</span><span>智能选品</span></a>
      <p>组织管理后台</p>
      <nav>
        <a href="/?view=authorization">角色与权限</a
        ><a href="/?view=resource-grants" class="active">资源授权</a><span>成员与邀请</span
        ><span>组织审计</span>
      </nav>
      <small>指定资源 · 最小动作 · 最长 30 天</small>
    </aside>
    <section class="grant-main">
      <header>
        <div>
          <p>资源访问</p>
          <h1>资源临时授权</h1>
          <span>只向同组织活动成员开放一个指定资源；下载、导出、凭证与重放保持拒绝。</span>
        </div>
        <button v-if="canManage" type="button" @click="showCreate = !showCreate">
          {{ showCreate ? "取消" : "新建授权" }}
        </button>
      </header>
      <div v-if="state === 'loading'" class="authz-state">
        <span class="spinner"></span><strong>正在核对成员与有效期</strong>
        <p>状态由服务端计算，到期后无需人工关闭。</p>
      </div>
      <div
        v-else-if="['error', 'forbidden', 'expired', 'blocked'].includes(state)"
        class="authz-state authz-state--error"
      >
        <b>{{
          state === "forbidden"
            ? "403"
            : state === "expired"
              ? "401"
              : state === "blocked"
                ? "!"
                : "×"
        }}</b
        ><strong>{{
          state === "forbidden"
            ? "无权管理资源授权"
            : state === "expired"
              ? "登录已过期"
              : state === "blocked"
                ? "授权条件不满足"
                : "授权服务暂不可用"
        }}</strong>
        <p>
          {{
            state === "blocked"
              ? "确认目标是同组织活动成员、动作与资源匹配，且到期不超过 30 天。"
              : "重新加载；如仍失败，向管理员提供请求标识。"
          }}
        </p>
        <small v-if="requestId">请求标识：{{ requestId }}</small
        ><a v-if="state === 'expired'" href="/login">重新登录</a
        ><button v-else type="button" @click="load">重新加载</button>
      </div>
      <template v-else
        ><p v-if="notice" class="grant-notice" role="status">{{ notice }}</p>
        <form v-if="showCreate && current" class="grant-form" @submit.prevent="createGrant">
          <h2>授权指定资源</h2>
          <label>工作区<input v-model="form.workspace_id" readonly /></label
          ><label
            >资源类型<select v-model="form.resource_type" @change="selectType">
              <option v-for="(_, type) in actionMap" :key="type" :value="type">
                {{ typeLabel(type) }}
              </option>
            </select></label
          ><label
            >资源 ID<input
              v-model="form.resource_id"
              required
              placeholder="从资源详情页带入资源编号" /></label
          ><label
            >目标成员<select v-model="form.grantee_membership_id" required>
              <option value="" disabled>选择同组织活动成员</option>
              <option v-for="member in members" :key="member.id" :value="member.id">
                {{ member.email }}
              </option>
            </select></label
          >
          <fieldset>
            <legend>最小必要动作</legend>
            <label v-for="action in actionMap[form.resource_type]" :key="action"
              ><input v-model="form.actions" type="checkbox" :value="action" />{{ action }}</label
            >
          </fieldset>
          <label>业务原因<textarea v-model="form.reason" required maxlength="500"></textarea></label
          ><label>到期时间<input v-model="form.expires_at" required type="datetime-local" /></label
          ><button :disabled="busy || !form.actions.length" type="submit">
            {{ busy ? "正在保存" : "创建并审计" }}</button
          ><small>不得超过 30 天；到期自动失效。</small>
        </form>
        <section class="grant-toolbar">
          <div>
            <button
              v-for="item in ['all', 'active', 'expired', 'revoked']"
              :key="item"
              type="button"
              :class="{ active: filter === item }"
              @click="setFilter(item)"
            >
              {{ item === "all" ? "全部" : statusLabel(item as ResourceGrantStatus) }}
            </button>
          </div>
          <span>{{ filtered.length }} 条授权</span>
        </section>
        <div v-if="state === 'empty'" class="authz-state">
          <b>○</b><strong>暂无资源授权</strong>
          <p>RBAC 与数据范围仍然生效；未授权资源默认拒绝。</p>
          <button v-if="canManage" type="button" @click="showCreate = true">创建首条授权</button>
        </div>
        <div v-else class="grant-layout">
          <section class="grant-list">
            <button
              v-for="grant in filtered"
              :key="grant.id"
              type="button"
              :class="{ selected: selected?.id === grant.id }"
              @click="selected = grant"
            >
              <i :data-status="grant.effective_status">{{ statusLabel(grant.effective_status) }}</i
              ><strong
                >{{ typeLabel(grant.resource_type) }} · {{ grant.resource_id.slice(0, 8) }}</strong
              ><span>{{ grant.actions.join(" · ") }}</span
              ><small>到期 {{ new Date(grant.expires_at).toLocaleString("zh-CN") }}</small>
            </button>
            <p v-if="!filtered.length">当前筛选没有授权。</p>
          </section>
          <article v-if="selected" class="grant-detail">
            <p>指定资源授权</p>
            <h2>{{ typeLabel(selected.resource_type) }}</h2>
            <code>{{ selected.resource_id }}</code>
            <dl>
              <div>
                <dt>状态</dt>
                <dd>{{ statusLabel(selected.effective_status) }}</dd>
              </div>
              <div>
                <dt>原因</dt>
                <dd>{{ selected.reason }}</dd>
              </div>
              <div>
                <dt>动作</dt>
                <dd>{{ selected.actions.join("、") }}</dd>
              </div>
              <div>
                <dt>版本</dt>
                <dd>v{{ selected.version }}</dd>
              </div>
            </dl>
            <form
              v-if="canManage && selected.effective_status === 'active'"
              @submit.prevent="extend"
            >
              <label>变更原因<input v-model="mutation.reason" required maxlength="500" /></label
              ><label
                >新到期时间<input v-model="mutation.expires_at" required type="datetime-local"
              /></label>
              <div>
                <button :disabled="busy" type="submit">延长授权</button
                ><button
                  :disabled="busy || !mutation.reason"
                  class="danger"
                  type="button"
                  @click="revoke"
                >
                  撤销授权
                </button>
              </div>
            </form>
            <small>延长、撤销和实际访问均记录关联编号与链路编号。</small>
          </article>
        </div></template
      >
    </section>
  </main>
</template>
