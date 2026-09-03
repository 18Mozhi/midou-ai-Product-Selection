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
  state.value = "loading";
  selectedOrganization.value = null;
  selectedWorkspace.value = null;
  selectedContext.value = null;
  try {
    organizations.value = await request("/org/memberships");
    state.value = organizations.value.length ? "ready" : "empty";
  } catch (error) {
    state.value = failureState(error);
  }
}
async function chooseOrganization(organization: OrganizationMembershipSummary) {
  state.value = "loading";
  selectedOrganization.value = organization;
  recentOrganizationIds.value = rememberOrganization(organization.id);
  try {
    const [workspaceItems, teamItems] = await Promise.all([
      request<WorkspaceSummary[]>(`/org/${organization.id}/workspaces`),
      request<TeamSummary[]>(`/org/${organization.id}/teams`),
    ]);
    workspaces.value = workspaceItems;
    teams.value = teamItems;
    state.value = workspaces.value.length ? "ready" : "empty";
  } catch (error) {
    state.value = failureState(error);
  }
}
async function chooseWorkspace(workspace: WorkspaceSummary) {
  if (workspace.status !== "active") return;
  selectedWorkspace.value = workspace;
  state.value = "selecting";
  try {
    selectedContext.value = await request<SelectedTenancyContext>("/auth/context", {
      method: "POST",
      body: {
        organization_id: workspace.organization_id,
        workspace_id: workspace.id,
      },
    });
    state.value = "selected";
  } catch (error) {
    state.value = failureState(error);
  }
}
async function createPersonalWorkspace() {
  state.value = "provisioning";
  try {
    selectedContext.value = await request<SelectedTenancyContext & { created: boolean }>(
      "/me/personal-workspace",
      { method: "POST" },
    );
    state.value = "selected";
    await router.replace(safeReturnTo.value === "/onboarding" ? "/home" : safeReturnTo.value);
  } catch (error) {
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
    <header class="tenancy-header">
      <RouterLink to="/" class="identity-brand"><span>选</span><span>智能选品</span></RouterLink>
      <div>
        <span class="tenancy-step">01</span><i></i
        ><span class="tenancy-step" :class="{ 'tenancy-step--active': selectedOrganization }"
          >02</span
        ><i></i><span class="tenancy-step">03</span>
      </div>
      <button type="button" class="tenancy-account">当前账号</button>
    </header>
    <section class="tenancy-shell">
      <div class="tenancy-intro">
        <p>组织与工作区</p>
        <h1>{{ title }}</h1>
        <span>{{ copy }}</span>
      </div>
      <div
        v-if="state === 'loading' || state === 'provisioning'"
        class="tenancy-state"
        aria-live="polite"
      >
        <span class="spinner"></span
        ><strong>{{ state === "provisioning" ? "正在创建选品空间" : "正在读取可用范围" }}</strong>
        <p>
          {{
            state === "provisioning"
              ? "完成后会直接进入你的选品工作台。"
              : "组织和工作区会从当前登录会话加载。"
          }}
        </p>
      </div>
      <div
        v-else-if="state === 'error' || state === 'forbidden' || state === 'expired'"
        class="tenancy-state tenancy-state--error"
        aria-live="assertive"
      >
        <b>{{ state === "forbidden" ? "403" : state === "expired" ? "401" : "!" }}</b
        ><strong>{{
          state === "forbidden"
            ? "无权访问该组织"
            : state === "expired"
              ? "登录已过期"
              : "暂时无法加载"
        }}</strong>
        <p>
          {{
            state === "forbidden"
              ? "返回组织列表并选择仍有成员资格的组织。"
              : state === "expired"
                ? "重新登录后再选择组织和工作区。"
                : "检查网络或登录状态后重试。"
          }}
        </p>
        <small v-if="requestId">请求标识：{{ requestId }}</small
        ><RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
        ><button v-else type="button" @click="loadOrganizations">返回组织列表</button>
      </div>
      <div v-else-if="state === 'empty'" class="tenancy-state">
        <b>○</b><strong>{{ selectedOrganization ? "暂无可用工作区" : "暂无可用组织" }}</strong>
        <p>
          {{
            selectedOrganization
              ? "请联系组织管理员创建或恢复工作区。"
              : "创建个人选品空间后即可直接开始使用。"
          }}
        </p>
        <button v-if="selectedOrganization" type="button" @click="loadOrganizations">
          返回组织列表
        </button>
        <div v-else class="tenancy-empty-actions">
          <button type="button" @click="createPersonalWorkspace">创建并进入选品空间</button>
          <RouterLink to="/me">进入个人中心</RouterLink>
          <RouterLink to="/security/mfa">管理 MFA</RouterLink>
        </div>
      </div>
      <div
        v-else-if="state === 'selected' && selectedContext"
        class="tenancy-state tenancy-state--selected"
        aria-live="polite"
      >
        <b>✓</b><strong>工作范围已就绪</strong>
        <p>
          {{ selectedContext.organization.name }} ·
          {{ selectedContext.workspace.name }}
        </p>
        <RouterLink :to="safeReturnTo">{{
          safeReturnTo === "/onboarding" ? "继续快速引导" : "返回原页面"
        }}</RouterLink>
      </div>
      <template v-else>
        <button
          v-if="selectedOrganization"
          type="button"
          class="tenancy-back"
          @click="loadOrganizations"
        >
          ← 返回组织
        </button>
        <label v-if="!selectedOrganization" class="tenancy-search">
          <span>搜索组织</span>
          <input
            v-model="organizationQuery"
            type="search"
            placeholder="输入组织名称"
            autocomplete="off"
          />
        </label>
        <div v-if="!selectedOrganization" class="tenancy-grid" aria-label="可用组织">
          <button
            v-for="organization in filteredOrganizations"
            :key="organization.id"
            type="button"
            class="tenancy-card"
            @click="chooseOrganization(organization)"
          >
            <span class="tenancy-avatar">{{ organization.name.slice(0, 1) }}</span
            ><span
              ><strong>{{ organization.name }}</strong
              ><small>{{ organization.slug }} · {{ organization.timezone }}</small></span
            ><em
              >{{ recentOrganizationIds.includes(organization.id) ? "最近使用 · " : "" }}选择 →</em
            >
          </button>
        </div>
        <div v-if="!selectedOrganization && !filteredOrganizations.length" class="tenancy-state">
          <strong>没有匹配的组织</strong>
          <p>清除搜索词后查看全部可用组织。</p>
          <button type="button" @click="organizationQuery = ''">清除搜索</button>
        </div>
        <div v-if="selectedOrganization" class="workspace-layout">
          <div class="workspace-grid" aria-label="可用工作区">
            <button
              v-for="workspace in workspaces"
              :key="workspace.id"
              type="button"
              class="workspace-card"
              :disabled="workspace.status !== 'active' || state === 'selecting'"
              @click="chooseWorkspace(workspace)"
            >
              <span>⌁</span><strong>{{ workspace.name }}</strong
              ><small>{{ workspace.status === "active" ? "可进入" : "已归档" }}</small
              ><em>{{
                state === "selecting" && selectedWorkspace?.id === workspace.id
                  ? "正在选择…"
                  : "进入工作区 →"
              }}</em>
            </button>
          </div>
          <aside class="team-summary">
            <p>组织团队</p>
            <strong>{{ teams.length }}</strong
            ><span>{{ teams.length ? "当前组织的团队数量" : "当前组织尚未建立团队" }}</span
            ><small>团队成员与角色配置将在权限模块提供。</small>
          </aside>
        </div>
      </template>
    </section>
    <footer class="tenancy-footer">
      <span>会话范围会被审计记录</span><span>不显示其他组织数据</span>
    </footer>
  </main>
</template>
