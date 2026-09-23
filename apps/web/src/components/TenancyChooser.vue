<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type {
  OrganizationMembershipSummary,
  SelectedTenancyContext,
  TeamSummary,
  WorkspaceSummary,
} from "@scoutops/contracts";
import { ApiClientError, createApiClient, type ApiRequestOptions } from "../api-client";
import { getRecentOrganizationIds, rememberOrganization } from "../navigation-memory";

const props = defineProps<{ apiBaseUrl: string }>();
const apiRequest = createApiClient(props.apiBaseUrl);
const route = useRoute();
const router = useRouter();
type State =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "forbidden"
  | "expired"
  | "selecting"
  | "provisioning"
  | "selected";
const state = ref<State>("loading");
const organizations = ref<OrganizationMembershipSummary[]>([]);
const workspaces = ref<WorkspaceSummary[]>([]);
const teams = ref<TeamSummary[]>([]);
const selectedOrganization = ref<OrganizationMembershipSummary | null>(null);
const selectedWorkspace = ref<WorkspaceSummary | null>(null);
const selectedContext = ref<SelectedTenancyContext | null>(null);
const requestId = ref("");
const organizationQuery = ref("");
const recentOrganizationIds = ref<string[]>([]);
let organizationLoadSequence = 0;
let contextWriteSequence = 0;
const safeReturnTo = computed(() => {
  const value = typeof route.query.return_to === "string" ? route.query.return_to : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/onboarding";
});
const filteredOrganizations = computed(() => {
  const keyword = organizationQuery.value.trim().toLocaleLowerCase("zh-CN");
  return [...organizations.value]
    .filter(
      (item) =>
        !keyword || `${item.name} ${item.slug}`.toLocaleLowerCase("zh-CN").includes(keyword),
    )
    .sort((left, right) => {
      const leftIndex = recentOrganizationIds.value.indexOf(left.id),
        rightIndex = recentOrganizationIds.value.indexOf(right.id);
      return (
        (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex)
      );
    });
});
const title = computed(() => (selectedOrganization.value ? "选择工作区" : "选择组织"));
const copy = computed(() =>
  selectedOrganization.value
    ? `进入 ${selectedOrganization.value.name} 前，选择本次会话使用的工作区。`
    : "只显示当前账号仍为活动成员的组织。",
);
async function request<T>(path: string, options?: ApiRequestOptions) {
  try {
    const response = await apiRequest<T>(path, options);
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) requestId.value = error.requestId;
    throw error;
  }
}
const failureState = (error: unknown): State =>
  error instanceof ApiClientError && error.kind === "forbidden"
    ? "forbidden"
    : error instanceof ApiClientError && error.kind === "expired"
      ? "expired"
      : "error";
async function loadOrganizations() {
  const sequence = ++organizationLoadSequence;
  contextWriteSequence++;
  state.value = "loading";
  selectedOrganization.value = null;
  selectedWorkspace.value = null;
  selectedContext.value = null;
  workspaces.value = [];
  teams.value = [];
  try {
    const result = await request<OrganizationMembershipSummary[]>("/org/memberships");
    if (sequence !== organizationLoadSequence) return;
    organizations.value = result;
    state.value = organizations.value.length ? "ready" : "empty";
  } catch (error) {
    if (sequence !== organizationLoadSequence) return;
    state.value = failureState(error);
  }
}
async function chooseOrganization(organization: OrganizationMembershipSummary) {
  const sequence = ++organizationLoadSequence;
  contextWriteSequence++;
  state.value = "loading";
  selectedOrganization.value = organization;
  selectedWorkspace.value = null;
  selectedContext.value = null;
  workspaces.value = [];
  teams.value = [];
  recentOrganizationIds.value = rememberOrganization(organization.id);
  try {
    const [workspaceItems, teamItems] = await Promise.all([
      request<WorkspaceSummary[]>(`/org/${organization.id}/workspaces`),
      request<TeamSummary[]>(`/org/${organization.id}/teams`),
    ]);
    if (sequence !== organizationLoadSequence) return;
    workspaces.value = workspaceItems;
    teams.value = teamItems;
    state.value = workspaces.value.length ? "ready" : "empty";
  } catch (error) {
    if (sequence !== organizationLoadSequence) return;
    state.value = failureState(error);
  }
}
async function chooseWorkspace(workspace: WorkspaceSummary) {
  if (workspace.status !== "active" || state.value === "selecting") return;
  const sequence = ++contextWriteSequence;
  selectedWorkspace.value = workspace;
  selectedContext.value = null;
  state.value = "selecting";
  try {
    const result = await request<SelectedTenancyContext>("/auth/context", {
      method: "POST",
      body: {
        organization_id: workspace.organization_id,
        workspace_id: workspace.id,
      },
    });
    if (sequence !== contextWriteSequence) return;
    selectedContext.value = result;
    state.value = "selected";
  } catch (error) {
    if (sequence !== contextWriteSequence) return;
    state.value = failureState(error);
  }
}
async function createPersonalWorkspace() {
  if (state.value === "provisioning") return;
  const sequence = ++contextWriteSequence;
  state.value = "provisioning";
  try {
    const result = await request<SelectedTenancyContext & { created: boolean }>(
      "/me/personal-workspace",
      { method: "POST" },
    );
    if (sequence !== contextWriteSequence) return;
    selectedContext.value = result;
    state.value = "selected";
    await router.replace(safeReturnTo.value === "/onboarding" ? "/home" : safeReturnTo.value);
  } catch (error) {
    if (sequence !== contextWriteSequence) return;
    state.value = failureState(error);
  }
}
onMounted(() => {
  recentOrganizationIds.value = getRecentOrganizationIds();
  void loadOrganizations();
});
</script>

<template>
  <main class="tenancy-page" data-testid="tenancy">
    <header class="p08-top">
      <RouterLink to="/" class="p08-brand"><span>ScoutOps</span></RouterLink>
      <span class="p08-top-label">组织与工作区</span>
      <span class="p08-top-hint">先选择组织，再选择工作区</span>
      <span class="p08-account">当前账号</span>
    </header>
    <section class="p08-hero" aria-labelledby="tenancy-title">
      <p>工作范围 · CONTEXT SELECTION</p>
      <h1 id="tenancy-title">{{ title }}</h1>
      <span>{{ copy }}</span>
    </section>
    <section class="p08-workspace" aria-label="组织与工作区选择">
      <div v-if="state === 'loading' || state === 'provisioning'" class="p08-notice" role="status">
        <b>{{ state === "provisioning" ? "正在创建个人空间" : "正在读取可用范围" }}</b>
        <p>
          {{
            state === "provisioning"
              ? "创建完成后会按既有规则进入选品工作台。"
              : "范围读取完成前，不显示可进入的组织或工作区。"
          }}
        </p>
      </div>
      <div
        v-else-if="state === 'error' || state === 'forbidden' || state === 'expired'"
        class="p08-notice p08-error"
        role="alert"
      >
        <b>{{
          state === "forbidden"
            ? "当前没有可用的组织权限"
            : state === "expired"
              ? "登录已过期"
              : "暂时无法读取范围"
        }}</b>
        <p>
          {{
            state === "forbidden"
              ? "请返回组织目录；页面不会展示无权限的组织。"
              : state === "expired"
                ? "重新登录后再选择组织和工作区。"
                : "检查网络或登录状态后重新读取。"
          }}
        </p>
        <code v-if="requestId">关联编号：{{ requestId }}</code>
        <RouterLink v-if="state === 'expired'" class="p08-primary-link" to="/login"
          >重新登录</RouterLink
        >
        <button v-else type="button" class="p08-secondary" @click="loadOrganizations">
          返回组织列表
        </button>
      </div>
      <div v-else-if="state === 'empty'" class="p08-notice">
        <b>{{ selectedOrganization ? "该组织暂无可用工作区" : "暂无可用组织" }}</b>
        <p>
          {{
            selectedOrganization
              ? "请联系组织管理员创建或恢复工作区。"
              : "创建个人选品空间后即可直接开始使用。"
          }}
        </p>
        <button
          v-if="selectedOrganization"
          type="button"
          class="p08-secondary"
          @click="loadOrganizations"
        >
          返回组织列表
        </button>
        <div v-else class="p08-actions">
          <button type="button" class="p08-primary" @click="createPersonalWorkspace">
            创建并进入选品空间
          </button>
          <RouterLink to="/me">进入个人中心</RouterLink>
          <RouterLink to="/security/mfa">管理 MFA</RouterLink>
        </div>
      </div>
      <div
        v-else-if="state === 'selected' && selectedContext"
        class="p08-notice p08-success"
        role="status"
      >
        <b>工作范围已就绪</b>
        <p>
          {{ selectedContext.organization.name }} ·
          {{ selectedContext.workspace.name }}
        </p>
        <RouterLink class="p08-primary-link" :to="safeReturnTo">{{
          safeReturnTo === "/onboarding" ? "继续快速引导" : "返回原页面"
        }}</RouterLink>
      </div>
      <template v-else>
        <button
          v-if="selectedOrganization"
          type="button"
          class="p08-back"
          @click="loadOrganizations"
        >
          ← 返回组织
        </button>
        <section v-if="!selectedOrganization" class="p08-directory" aria-label="组织目录">
          <label class="p08-search">
            <span>搜索组织</span>
            <input
              v-model="organizationQuery"
              type="search"
              placeholder="输入组织名称或 slug"
              autocomplete="off"
            />
          </label>
          <div class="p08-list" aria-label="可用组织">
            <button
              v-for="organization in filteredOrganizations"
              :key="organization.id"
              type="button"
              class="p08-org-row"
              @click="chooseOrganization(organization)"
            >
              <span class="p08-org-initial" aria-hidden="true">{{
                organization.name.slice(0, 1)
              }}</span>
              <span class="p08-org-info">
                <strong>{{ organization.name }}</strong>
                <small>{{ organization.slug }} · {{ organization.timezone }}</small>
              </span>
              <span class="p08-row-action">
                {{ recentOrganizationIds.includes(organization.id) ? "最近使用 · " : "" }}选择组织 →
              </span>
            </button>
          </div>
          <div v-if="!filteredOrganizations.length" class="p08-empty-search">
            <b>没有匹配的组织</b>
            <span>搜索仅在当前可用组织的名称与 slug 内进行。</span>
            <button type="button" class="p08-secondary" @click="organizationQuery = ''">
              清除搜索
            </button>
          </div>
        </section>
        <section v-if="selectedOrganization" class="p08-organization" aria-label="当前组织工作区">
          <header class="p08-org-context">
            <p>当前组织</p>
            <h2>{{ selectedOrganization.name }}</h2>
            <span>{{ selectedOrganization.slug }} · {{ selectedOrganization.timezone }}</span>
          </header>
          <div class="p08-workspace-list" aria-label="可用工作区">
            <button
              v-for="workspace in workspaces"
              :key="workspace.id"
              type="button"
              class="p08-workspace-row"
              :disabled="workspace.status !== 'active' || state === 'selecting'"
              @click="chooseWorkspace(workspace)"
            >
              <strong>{{ workspace.name }}</strong>
              <span>{{ workspace.status === "active" ? "可进入" : "已归档，不能进入" }}</span>
              <small>{{
                state === "selecting" && selectedWorkspace?.id === workspace.id
                  ? "正在写入范围…"
                  : workspace.status === "active"
                    ? "选择工作区 →"
                    : "不可选择"
              }}</small>
            </button>
          </div>
          <aside class="p08-team-summary">
            <p>组织团队</p>
            <strong>{{ teams.length }}</strong>
            <span>{{ teams.length ? "当前组织的团队数量" : "当前组织尚未建立团队" }}</span>
          </aside>
        </section>
      </template>
    </section>
    <footer class="p08-boundary">
      <span>组织选择仅读取范围 · 工作区选择才会更新会话范围</span>
      <span>不显示其他组织数据</span>
    </footer>
  </main>
</template>
