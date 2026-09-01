<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import TechnicalDetails from "./TechnicalDetails.vue";
import "../security-operations.css";

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const route = useRoute();
const router = useRouter();
const securityViews = ["events", "sessions", "credentials", "audit"] as const;
type SecurityView = (typeof securityViews)[number];
type PageState =
  "loading" | "ready" | "empty" | "expired" | "forbidden" | "rate_limited" | "blocked" | "error";

const emptyPagination = () => ({ page: 1, page_size: 20, total: 0, total_pages: 1 });
const emptyData = () => ({
  window: "24h",
  view: "events",
  summary: {
    security_events: 0,
    risk_events: 0,
    active_sessions: 0,
    active_credentials: 0,
    credentials_expiring: 0,
    active_org_tokens: 0,
  },
  security_events: [],
  sessions: [],
  credential_assets: [],
  organization_tokens: [],
  audit_events: [],
  pagination: {
    security_events: emptyPagination(),
    sessions: emptyPagination(),
    credential_assets: emptyPagination(),
    organization_tokens: emptyPagination(),
    audit_events: emptyPagination(),
  },
  observed_at: null,
});

const state = ref<PageState>("loading");
const data = ref<any>(emptyData());
const loadedOnce = ref(false);
const refreshing = ref(false);
const requestId = ref("");
const notice = ref("");
const noticeKind = ref<"info" | "error">("info");
const activeView = ref<SecurityView>("events");
const windowCode = ref("24h");
const query = ref("");
const queryInput = ref("");
const status = ref("");
const page = ref(1);
const tokenPage = ref(1);
let mounted = false;
let loadController: AbortController | null = null;
let loadSequence = 0;
let lastManualRefreshAt = 0;

const statusOptions = computed(() =>
  activeView.value === "events" || activeView.value === "audit"
    ? [
        { value: "", label: "全部结果" },
        { value: "succeeded", label: "成功" },
        { value: "failed", label: "失败" },
        { value: "blocked", label: "已阻止" },
      ]
    : [
        { value: "", label: "全部状态" },
        { value: "active", label: "可用" },
        { value: "expired", label: "已过期" },
        { value: "revoked", label: "已撤销" },
      ],
);
const searchLabel = computed(
  () =>
    ({
      events: "搜索事件、用户或请求 ID",
      sessions: "搜索账号、设备或会话 ID",
      credentials: "搜索凭证、来源、令牌或组织 ID",
      audit: "搜索操作、对象、操作者或请求 ID",
    })[activeView.value],
);
const mainPaginationKey = computed(
  () =>
    ({
      events: "security_events",
      sessions: "sessions",
      credentials: "credential_assets",
      audit: "audit_events",
    })[activeView.value],
);
const mainPagination = computed(
  () => data.value.pagination[mainPaginationKey.value] ?? emptyPagination(),
);
const tokenPagination = computed(
  () => data.value.pagination.organization_tokens ?? emptyPagination(),
);

const normalizeView = (value: unknown): SecurityView => {
  const candidate = String(value ?? "events");
  return securityViews.includes(candidate as SecurityView) ? (candidate as SecurityView) : "events";
};
const positiveInteger = (value: unknown) => {
  const parsed = Number(value ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
};
function readLocation() {
  activeView.value = normalizeView(route.query.view);
  windowCode.value = ["24h", "7d", "30d"].includes(String(route.query.window))
    ? String(route.query.window)
    : "24h";
  query.value = String(route.query.query ?? "")
    .slice(0, 120)
    .trim();
  queryInput.value = query.value;
  const requestedStatus = String(route.query.status ?? "");
  status.value = statusOptions.value.some((item) => item.value === requestedStatus)
    ? requestedStatus
    : "";
  page.value = positiveInteger(route.query.page);
  tokenPage.value = positiveInteger(route.query.token_page);
}
function routeQuery(overrides: Record<string, unknown> = {}) {
  const next = {
    view: activeView.value,
    window: windowCode.value,
    query: query.value,
    status: status.value,
    page: page.value,
    token_page: tokenPage.value,
    ...overrides,
  } as Record<string, unknown>;
  const result: Record<string, string> = {};
  if (next.view !== "events") result.view = String(next.view);
  if (next.window !== "24h") result.window = String(next.window);
  if (String(next.query ?? "").trim()) result.query = String(next.query).trim();
  if (next.status) result.status = String(next.status);
  if (Number(next.page) > 1) result.page = String(next.page);
  if (next.view === "credentials" && Number(next.token_page) > 1)
    result.token_page = String(next.token_page);
  return result;
}
async function navigate(overrides: Record<string, unknown>) {
  const target = { path: "/platform-admin/security", query: routeQuery(overrides) };
  if (router.resolve(target).fullPath === route.fullPath) await load();
  else await router.push(target);
}
const viewLocation = (view: SecurityView) => ({
  path: "/platform-admin/security",
  query: routeQuery({ view, query: "", status: "", page: 1, token_page: 1 }),
});

function normalizeData(value: any) {
  const fallback = emptyData();
  return {
    ...fallback,
    ...value,
    summary: { ...fallback.summary, ...(value?.summary ?? {}) },
    pagination: {
      ...fallback.pagination,
      ...(value?.pagination ?? {}),
    },
  };
}
function setNotice(message: string, kind: "info" | "error" = "info") {
  notice.value = message;
  noticeKind.value = kind;
}
async function load() {
  if (refreshing.value) return;
  const sequence = ++loadSequence;
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  if (!loadedOnce.value) state.value = "loading";
  refreshing.value = true;
  setNotice("");
  const parameters = new URLSearchParams({
    window: windowCode.value,
    view: activeView.value,
    page: String(page.value),
    page_size: "20",
    token_page: String(tokenPage.value),
    token_page_size: "20",
  });
  if (query.value) parameters.set("query", query.value);
  if (status.value) parameters.set("status", status.value);
  try {
    const response = await request<any>(`/platform/security/operations?${parameters}`, {
      signal: controller.signal,
    });
    if (sequence !== loadSequence) return;
    requestId.value = response.request_id;
    data.value = normalizeData(response.data);
    page.value = mainPagination.value.page;
    tokenPage.value = tokenPagination.value.page;
    loadedOnce.value = true;
    state.value = Object.values(data.value.summary).some(Number) ? "ready" : "empty";
  } catch (error) {
    if (
      sequence !== loadSequence ||
      (error instanceof DOMException && error.name === "AbortError" && !timedOut)
    )
      return;
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    setNotice(
      timedOut
        ? "读取超过 15 秒，已停止本次请求并保留上次成功数据。"
        : `${failure?.actionHint ?? "安全运营事实读取失败。"}${loadedOnce.value ? " 已保留上次成功数据。" : ""}`,
      "error",
    );
    if (!loadedOnce.value)
      state.value =
        failure?.kind === "expired" || failure?.kind === "forbidden"
          ? failure.kind
          : failure?.kind === "rate_limited"
            ? "rate_limited"
            : (failure?.status ?? 0) >= 500
              ? "blocked"
              : "error";
  } finally {
    window.clearTimeout(timeout);
    if (sequence === loadSequence) refreshing.value = false;
  }
}

async function refresh() {
  const now = Date.now();
  if (refreshing.value || now - lastManualRefreshAt < 500) return;
  lastManualRefreshAt = now;
  await load();
}

async function applyWindow() {
  page.value = 1;
  tokenPage.value = 1;
  await navigate({ window: windowCode.value, page: 1, token_page: 1 });
}
async function applyFilters() {
  query.value = queryInput.value.trim().slice(0, 120);
  page.value = 1;
  tokenPage.value = 1;
  await navigate({ query: query.value, status: status.value, page: 1, token_page: 1 });
}
async function resetFilters() {
  query.value = "";
  queryInput.value = "";
  status.value = "";
  page.value = 1;
  tokenPage.value = 1;
  await navigate({ query: "", status: "", page: 1, token_page: 1 });
}
async function goPage(kind: "main" | "token", next: number) {
  if (kind === "main") page.value = next;
  else tokenPage.value = next;
  await navigate(kind === "main" ? { page: next } : { token_page: next });
}

const when = (value: string | null) => (value ? new Date(value).toLocaleString("zh-CN") : "未设置");
const summaryText = (value: string) =>
  ({
    security_events: "安全事件",
    risk_events: "风险事件",
    active_sessions: "有效会话",
    active_credentials: "有效凭证",
    credentials_expiring: "七天内到期",
    active_org_tokens: "有效访问令牌",
  })[value] ?? value;
const statusText = (value: string) =>
  ({
    active: "可用",
    revoked: "已撤销",
    expired: "已过期",
    succeeded: "成功",
    failed: "失败",
    blocked: "已阻止",
    allowed: "已允许",
  })[value] ?? `其他状态（${value || "未知"}）`;
const kindText = (value: string) =>
  ({
    api_key: "接口密钥",
    account_secret: "账号资料",
    cookie_bundle: "登录状态",
    private_key: "私钥",
    browser_profile: "网页登录档案",
  })[value] ?? "其他凭证";
const eventText = (value: string) =>
  ({
    login_succeeded: "登录成功",
    login_failed: "登录失败",
    "login.succeeded": "登录成功",
    "login.failed": "登录失败",
    session_revoked: "登录已撤销",
    mfa_failed: "二次验证失败",
    password_changed: "密码已修改",
  })[value] ?? "未分类安全事件";
const scopeText = (value: string) =>
  ({ "status:read": "读取系统状态", "report:read": "读取报表" })[value] ?? "其他权限";
const auditActionText = (value: string) =>
  ({
    "platform.security.operations.read": "查看安全运营事实",
    "platform.account.organization.created": "创建组织",
    "platform.account.user.status_changed": "变更用户状态",
    "platform.account.role.changed": "变更平台管理员角色",
    "platform.credential.rotated": "轮换来源凭证",
    "platform.token.revoked": "撤销访问令牌",
  })[value] ?? "平台管理操作";
const resourceText = (value: string) =>
  ({
    security_operations: "安全运营",
    organization: "组织",
    user: "用户",
    platform_role: "平台角色",
    credential: "来源凭证",
    organization_token: "组织访问令牌",
  })[value] ?? "平台对象";
const stateTitle = computed(
  () =>
    ({
      loading: "正在读取安全事实",
      empty: "当前时间窗没有安全运营事实",
      expired: "登录已失效",
      forbidden: "你没有安全运营权限",
      rate_limited: "请求过于频繁",
      blocked: "安全运营依赖受阻",
      error: "安全运营读取失败",
      ready: "",
    })[state.value],
);

onMounted(async () => {
  mounted = true;
  readLocation();
  await load();
});
watch(
  () => route.fullPath,
  async () => {
    if (!mounted) return;
    loadedOnce.value = false;
    readLocation();
    await load();
  },
);
onBeforeUnmount(() => {
  mounted = false;
  loadController?.abort();
});
</script>

<template>
  <section class="security-ops" aria-labelledby="security-operations-title">
    <header class="security-hero">
      <div>
        <p>平台安全运营中心</p>
        <h2 id="security-operations-title">安全与密钥运营</h2>
        <span
          >核查登录风险、会话、访问令牌、凭证到期和平台审计。此页面只读，且不返回密码、密钥、Cookie、原始
          IP 或原始浏览器标识。</span
        >
      </div>
      <div class="security-hero-actions">
        <label
          >事件时间窗
          <select v-model="windowCode" :disabled="refreshing" @change="applyWindow">
            <option value="24h">24 小时</option>
            <option value="7d">7 天</option>
            <option value="30d">30 天</option>
          </select>
        </label>
        <button type="button" :disabled="refreshing" @click="refresh">
          {{ refreshing ? "正在刷新…" : "刷新数据" }}
        </button>
      </div>
    </header>

    <section v-if="state !== 'ready'" class="platform-dashboard-state" :data-kind="state">
      <h3>{{ stateTitle }}</h3>
      <p>{{ notice || "切换时间窗，或由运维在宝塔检查 API 与 MySQL 后重试。" }}</p>
      <details v-if="requestId">
        <summary>技术详情</summary>
        <code>请求 ID：{{ requestId }}</code>
      </details>
      <button
        v-if="!['loading', 'expired', 'forbidden'].includes(state)"
        type="button"
        @click="refresh"
      >
        重新读取
      </button>
    </section>

    <template v-else>
      <section class="security-kpis" aria-label="安全运营摘要">
        <article
          v-for="(value, key) in data.summary"
          :key="key"
          :data-risk="key === 'risk_events' && Number(value) > 0"
        >
          <span>{{ summaryText(String(key)) }}</span
          ><strong>{{ value }}</strong>
        </article>
      </section>

      <nav class="security-view-nav" aria-label="安全中心二级导航">
        <RouterLink
          v-for="view in securityViews"
          :key="view"
          :to="viewLocation(view)"
          :aria-current="activeView === view ? 'page' : undefined"
        >
          {{
            { events: "事件", sessions: "会话", credentials: "访问与凭证", audit: "平台审计" }[view]
          }}
        </RouterLink>
      </nav>

      <form class="security-filter-bar" role="search" @submit.prevent="applyFilters">
        <label class="security-search-field"
          >{{ searchLabel }}
          <input
            v-model="queryInput"
            type="search"
            maxlength="120"
            :placeholder="searchLabel"
            autocomplete="off"
          />
        </label>
        <label
          >状态
          <select v-model="status">
            <option v-for="item in statusOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <button type="submit" :disabled="refreshing">查询</button>
        <button
          type="button"
          class="secondary"
          :disabled="refreshing || (!query && !status)"
          @click="resetFilters"
        >
          重置
        </button>
      </form>

      <p v-if="notice" class="security-notice" :data-kind="noticeKind" role="status">
        {{ notice }}
      </p>
      <p class="security-scope-note">
        时间窗仅影响事件与审计；会话、凭证和令牌展示当前生命周期状态。当前视图共
        {{
          activeView === "credentials"
            ? mainPagination.total + tokenPagination.total
            : mainPagination.total
        }}
        条匹配记录。
      </p>

      <div class="security-grid" :aria-busy="refreshing">
        <section v-if="activeView === 'events'" aria-labelledby="security-events-heading">
          <div class="security-section-heading">
            <div>
              <p>身份边界</p>
              <h3 id="security-events-heading">登录与风险事件</h3>
            </div>
            <span>共 {{ mainPagination.total }} 条</span>
          </div>
          <p v-if="!data.security_events.length" class="security-inline-empty">
            没有匹配的事件。调整搜索、状态或时间窗后重试。
          </p>
          <ResponsiveDataView
            v-else
            :rows="data.security_events"
            :row-key="(item) => item.id"
            title="登录与风险事件"
            :detail-title="(item) => eventText(item.event_type)"
          >
            <template #desktop
              ><table>
                <thead>
                  <tr>
                    <th>事件与结果</th>
                    <th>关联身份</th>
                    <th>发生时间</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in data.security_events" :key="item.id">
                    <td>
                      <b>{{ eventText(item.event_type) }}</b
                      ><small :data-status="item.outcome">{{ statusText(item.outcome) }}</small>
                    </td>
                    <td>{{ item.user_id ? "已关联用户" : "匿名" }}</td>
                    <td>{{ when(item.occurred_at) }}</td>
                    <td>
                      <details>
                        <summary>技术详情</summary>
                        <dl>
                          <div>
                            <dt>事件代码</dt>
                            <dd>{{ item.event_type }}</dd>
                          </div>
                          <div>
                            <dt>事件 ID</dt>
                            <dd>{{ item.id }}</dd>
                          </div>
                          <div>
                            <dt>用户 ID</dt>
                            <dd>{{ item.user_id || "—" }}</dd>
                          </div>
                          <div>
                            <dt>请求 ID</dt>
                            <dd>{{ item.request_id || "—" }}</dd>
                          </div>
                          <div>
                            <dt>链路 ID</dt>
                            <dd>{{ item.trace_id || "—" }}</dd>
                          </div>
                        </dl>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table></template
            >
            <template #summary="{ row }"
              ><span class="responsive-record-summary"
                ><strong>{{ eventText(row.event_type) }} · {{ statusText(row.outcome) }}</strong
                ><small
                  >{{ row.user_id ? "已关联用户" : "匿名" }} · {{ when(row.occurred_at) }}</small
                ></span
              ></template
            >
            <template #detail="{ row }"
              ><dl>
                <div>
                  <dt>事件</dt>
                  <dd>{{ eventText(row.event_type) }}</dd>
                </div>
                <div>
                  <dt>结果</dt>
                  <dd>{{ statusText(row.outcome) }}</dd>
                </div>
                <div>
                  <dt>用户</dt>
                  <dd>{{ row.user_id ? "已关联用户" : "匿名" }}</dd>
                </div>
                <div>
                  <dt>发生时间</dt>
                  <dd>{{ when(row.occurred_at) }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <dl>
                  <div>
                    <dt>事件代码</dt>
                    <dd>{{ row.event_type }}</dd>
                  </div>
                  <div>
                    <dt>事件 ID</dt>
                    <dd>{{ row.id }}</dd>
                  </div>
                  <div>
                    <dt>用户 ID</dt>
                    <dd>{{ row.user_id || "—" }}</dd>
                  </div>
                  <div>
                    <dt>请求 ID</dt>
                    <dd>{{ row.request_id || "—" }}</dd>
                  </div>
                  <div>
                    <dt>链路 ID</dt>
                    <dd>{{ row.trace_id || "—" }}</dd>
                  </div>
                </dl>
              </details></template
            >
          </ResponsiveDataView>
          <div
            v-if="mainPagination.total_pages > 1"
            class="security-pagination"
            aria-label="事件分页"
          >
            <button
              type="button"
              :disabled="refreshing || mainPagination.page <= 1"
              @click="goPage('main', mainPagination.page - 1)"
            >
              上一页</button
            ><span>第 {{ mainPagination.page }} / {{ mainPagination.total_pages }} 页</span
            ><button
              type="button"
              :disabled="refreshing || mainPagination.page >= mainPagination.total_pages"
              @click="goPage('main', mainPagination.page + 1)"
            >
              下一页
            </button>
          </div>
        </section>

        <section v-if="activeView === 'sessions'" aria-labelledby="security-sessions-heading">
          <div class="security-section-heading">
            <div>
              <p>登录生命周期</p>
              <h3 id="security-sessions-heading">活动与历史会话</h3>
            </div>
            <span>共 {{ mainPagination.total }} 条</span>
          </div>
          <p v-if="!data.sessions.length" class="security-inline-empty">
            没有匹配的会话。调整搜索或状态后重试。
          </p>
          <ResponsiveDataView
            v-else
            :rows="data.sessions"
            :row-key="(item) => item.id"
            title="活动与历史会话"
            :detail-title="(item) => item.email"
          >
            <template #desktop
              ><table>
                <thead>
                  <tr>
                    <th>账号与设备</th>
                    <th>有效状态</th>
                    <th>最近活动</th>
                    <th>到期时间</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in data.sessions" :key="item.id">
                    <td>
                      <b>{{ item.email }}</b
                      ><small>{{ item.device_label }}</small>
                    </td>
                    <td>
                      <span class="security-status" :data-status="item.status">{{
                        statusText(item.status)
                      }}</span>
                    </td>
                    <td>{{ when(item.last_seen_at) }}</td>
                    <td>{{ when(item.expires_at) }}</td>
                    <td>
                      <details>
                        <summary>技术详情</summary>
                        <dl>
                          <div>
                            <dt>会话 ID</dt>
                            <dd>{{ item.id }}</dd>
                          </div>
                          <div>
                            <dt>用户 ID</dt>
                            <dd>{{ item.user_id }}</dd>
                          </div>
                        </dl>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table></template
            >
            <template #summary="{ row }"
              ><span class="responsive-record-summary"
                ><strong>{{ row.email }} · {{ statusText(row.status) }}</strong
                ><small>{{ row.device_label }} · {{ when(row.last_seen_at) }}</small></span
              ></template
            >
            <template #detail="{ row }"
              ><dl>
                <div>
                  <dt>状态</dt>
                  <dd>{{ statusText(row.status) }}</dd>
                </div>
                <div>
                  <dt>设备类别</dt>
                  <dd>{{ row.device_label }}</dd>
                </div>
                <div>
                  <dt>最近活动</dt>
                  <dd>{{ when(row.last_seen_at) }}</dd>
                </div>
                <div>
                  <dt>到期时间</dt>
                  <dd>{{ when(row.expires_at) }}</dd>
                </div>
                <div>
                  <dt>创建时间</dt>
                  <dd>{{ when(row.created_at) }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <dl>
                  <div>
                    <dt>会话 ID</dt>
                    <dd>{{ row.id }}</dd>
                  </div>
                  <div>
                    <dt>用户 ID</dt>
                    <dd>{{ row.user_id }}</dd>
                  </div>
                </dl>
              </details></template
            >
          </ResponsiveDataView>
          <div
            v-if="mainPagination.total_pages > 1"
            class="security-pagination"
            aria-label="会话分页"
          >
            <button
              type="button"
              :disabled="refreshing || mainPagination.page <= 1"
              @click="goPage('main', mainPagination.page - 1)"
            >
              上一页</button
            ><span>第 {{ mainPagination.page }} / {{ mainPagination.total_pages }} 页</span
            ><button
              type="button"
              :disabled="refreshing || mainPagination.page >= mainPagination.total_pages"
              @click="goPage('main', mainPagination.page + 1)"
            >
              下一页
            </button>
          </div>
        </section>

        <template v-if="activeView === 'credentials'">
          <section aria-labelledby="security-credentials-heading">
            <div class="security-section-heading">
              <div>
                <p>密钥材料</p>
                <h3 id="security-credentials-heading">凭证生命周期</h3>
              </div>
              <span>共 {{ mainPagination.total }} 条</span>
            </div>
            <p v-if="!data.credential_assets.length" class="security-inline-empty">
              没有匹配的凭证。调整搜索或状态后重试。
            </p>
            <ResponsiveDataView
              v-else
              :rows="data.credential_assets"
              :row-key="(item) => item.id"
              title="凭证生命周期"
              :detail-title="(item) => item.name"
            >
              <template #desktop
                ><table>
                  <thead>
                    <tr>
                      <th>凭证与来源</th>
                      <th>有效状态</th>
                      <th>到期时间</th>
                      <th>最近轮换</th>
                      <th>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in data.credential_assets" :key="item.id">
                      <td>
                        <b class="security-record-name" :title="item.name">{{ item.name }}</b
                        ><small>{{ item.provider_name }} · {{ kindText(item.kind) }}</small>
                      </td>
                      <td>
                        <span class="security-status" :data-status="item.status">{{
                          statusText(item.status)
                        }}</span>
                      </td>
                      <td>{{ when(item.expires_at) }}</td>
                      <td>{{ when(item.rotated_at) }}</td>
                      <td>
                        <details>
                          <summary>技术详情</summary>
                          <dl>
                            <div>
                              <dt>凭证 ID</dt>
                              <dd>{{ item.id }}</dd>
                            </div>
                            <div>
                              <dt>来源 ID</dt>
                              <dd>{{ item.provider_id }}</dd>
                            </div>
                            <div>
                              <dt>密钥版本</dt>
                              <dd>{{ item.key_version }}</dd>
                            </div>
                            <div>
                              <dt>脱敏指纹</dt>
                              <dd>{{ item.fingerprint }}</dd>
                            </div>
                          </dl>
                        </details>
                      </td>
                    </tr>
                  </tbody>
                </table></template
              >
              <template #summary="{ row }"
                ><span class="responsive-record-summary"
                  ><strong>{{ row.name }} · {{ statusText(row.status) }}</strong
                  ><small
                    >{{ row.provider_name }} · {{ kindText(row.kind) }} ·
                    {{ when(row.expires_at) }}</small
                  ></span
                ></template
              >
              <template #detail="{ row }"
                ><dl>
                  <div>
                    <dt>来源</dt>
                    <dd>{{ row.provider_name }}</dd>
                  </div>
                  <div>
                    <dt>凭证类型</dt>
                    <dd>{{ kindText(row.kind) }}</dd>
                  </div>
                  <div>
                    <dt>状态</dt>
                    <dd>{{ statusText(row.status) }}</dd>
                  </div>
                  <div>
                    <dt>到期时间</dt>
                    <dd>{{ when(row.expires_at) }}</dd>
                  </div>
                  <div>
                    <dt>最近轮换</dt>
                    <dd>{{ when(row.rotated_at) }}</dd>
                  </div>
                </dl>
                <details>
                  <summary>技术详情</summary>
                  <dl>
                    <div>
                      <dt>凭证 ID</dt>
                      <dd>{{ row.id }}</dd>
                    </div>
                    <div>
                      <dt>来源 ID</dt>
                      <dd>{{ row.provider_id }}</dd>
                    </div>
                    <div>
                      <dt>密钥版本</dt>
                      <dd>{{ row.key_version }}</dd>
                    </div>
                    <div>
                      <dt>脱敏指纹</dt>
                      <dd>{{ row.fingerprint }}</dd>
                    </div>
                  </dl>
                </details></template
              >
            </ResponsiveDataView>
            <div
              v-if="mainPagination.total_pages > 1"
              class="security-pagination"
              aria-label="凭证分页"
            >
              <button
                type="button"
                :disabled="refreshing || mainPagination.page <= 1"
                @click="goPage('main', mainPagination.page - 1)"
              >
                上一页</button
              ><span>第 {{ mainPagination.page }} / {{ mainPagination.total_pages }} 页</span
              ><button
                type="button"
                :disabled="refreshing || mainPagination.page >= mainPagination.total_pages"
                @click="goPage('main', mainPagination.page + 1)"
              >
                下一页
              </button>
            </div>
            <RouterLink class="security-manage-link" to="/platform-admin/credentials"
              >进入凭证与档案管理</RouterLink
            >
          </section>

          <section aria-labelledby="security-tokens-heading">
            <div class="security-section-heading">
              <div>
                <p>组织接入</p>
                <h3 id="security-tokens-heading">组织访问令牌</h3>
              </div>
              <span>共 {{ tokenPagination.total }} 条</span>
            </div>
            <p v-if="!data.organization_tokens.length" class="security-inline-empty">
              没有匹配的组织访问令牌。
            </p>
            <ResponsiveDataView
              v-else
              :rows="data.organization_tokens"
              :row-key="(item) => item.id"
              title="组织访问令牌"
              :detail-title="(item) => item.name"
            >
              <template #desktop
                ><table>
                  <thead>
                    <tr>
                      <th>令牌名称</th>
                      <th>有效状态</th>
                      <th>权限</th>
                      <th>到期时间</th>
                      <th>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in data.organization_tokens" :key="item.id">
                      <td>
                        <b class="security-record-name" :title="item.name">{{ item.name }}</b>
                      </td>
                      <td>
                        <span class="security-status" :data-status="item.status">{{
                          statusText(item.status)
                        }}</span>
                      </td>
                      <td>{{ item.scopes.map(scopeText).join("、") || "未授予权限" }}</td>
                      <td>{{ when(item.expires_at) }}</td>
                      <td>
                        <details>
                          <summary>技术详情</summary>
                          <dl>
                            <div>
                              <dt>令牌 ID</dt>
                              <dd>{{ item.id }}</dd>
                            </div>
                            <div>
                              <dt>组织 ID</dt>
                              <dd>{{ item.organization_id }}</dd>
                            </div>
                            <div>
                              <dt>令牌前缀</dt>
                              <dd>{{ item.token_prefix }}</dd>
                            </div>
                          </dl>
                        </details>
                      </td>
                    </tr>
                  </tbody>
                </table></template
              >
              <template #summary="{ row }"
                ><span class="responsive-record-summary"
                  ><strong>{{ row.name }} · {{ statusText(row.status) }}</strong
                  ><small
                    >{{ row.scopes.map(scopeText).join("、") || "未授予权限" }} ·
                    {{ when(row.expires_at) }}</small
                  ></span
                ></template
              >
              <template #detail="{ row }"
                ><dl>
                  <div>
                    <dt>状态</dt>
                    <dd>{{ statusText(row.status) }}</dd>
                  </div>
                  <div>
                    <dt>权限</dt>
                    <dd>{{ row.scopes.map(scopeText).join("、") || "未授予权限" }}</dd>
                  </div>
                  <div>
                    <dt>到期时间</dt>
                    <dd>{{ when(row.expires_at) }}</dd>
                  </div>
                  <div>
                    <dt>最近使用</dt>
                    <dd>{{ when(row.last_used_at) }}</dd>
                  </div>
                </dl>
                <details>
                  <summary>技术详情</summary>
                  <dl>
                    <div>
                      <dt>令牌 ID</dt>
                      <dd>{{ row.id }}</dd>
                    </div>
                    <div>
                      <dt>组织 ID</dt>
                      <dd>{{ row.organization_id }}</dd>
                    </div>
                    <div>
                      <dt>令牌前缀</dt>
                      <dd>{{ row.token_prefix }}</dd>
                    </div>
                  </dl>
                </details></template
              >
            </ResponsiveDataView>
            <div
              v-if="tokenPagination.total_pages > 1"
              class="security-pagination"
              aria-label="访问令牌分页"
            >
              <button
                type="button"
                :disabled="refreshing || tokenPagination.page <= 1"
                @click="goPage('token', tokenPagination.page - 1)"
              >
                上一页</button
              ><span>第 {{ tokenPagination.page }} / {{ tokenPagination.total_pages }} 页</span
              ><button
                type="button"
                :disabled="refreshing || tokenPagination.page >= tokenPagination.total_pages"
                @click="goPage('token', tokenPagination.page + 1)"
              >
                下一页
              </button>
            </div>
          </section>
        </template>

        <section v-if="activeView === 'audit'" aria-labelledby="security-audit-heading">
          <div class="security-section-heading">
            <div>
              <p>操作追溯</p>
              <h3 id="security-audit-heading">平台审计</h3>
            </div>
            <span>共 {{ mainPagination.total }} 条</span>
          </div>
          <p v-if="!data.audit_events.length" class="security-inline-empty">
            当前筛选没有平台审计记录。
          </p>
          <ResponsiveDataView
            v-else
            :rows="data.audit_events"
            :row-key="(item) => item.id"
            title="平台审计"
            :detail-title="(item) => auditActionText(item.action)"
          >
            <template #desktop
              ><table>
                <thead>
                  <tr>
                    <th>操作与对象</th>
                    <th>结果</th>
                    <th>发生时间</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in data.audit_events" :key="item.id">
                    <td>
                      <b>{{ auditActionText(item.action) }}</b
                      ><small>{{ resourceText(item.resource_type) }}</small>
                    </td>
                    <td>
                      <span class="security-status" :data-status="item.outcome">{{
                        statusText(item.outcome)
                      }}</span>
                    </td>
                    <td>{{ when(item.occurred_at) }}</td>
                    <td>
                      <details>
                        <summary>技术详情</summary>
                        <dl>
                          <div>
                            <dt>操作代码</dt>
                            <dd>{{ item.action }}</dd>
                          </div>
                          <div>
                            <dt>对象类型</dt>
                            <dd>{{ item.resource_type }}</dd>
                          </div>
                          <div>
                            <dt>对象 ID</dt>
                            <dd>{{ item.resource_id || "—" }}</dd>
                          </div>
                          <div>
                            <dt>操作者 ID</dt>
                            <dd>{{ item.actor_id }}</dd>
                          </div>
                          <div>
                            <dt>请求 ID</dt>
                            <dd>{{ item.request_id }}</dd>
                          </div>
                          <div>
                            <dt>链路 ID</dt>
                            <dd>{{ item.trace_id }}</dd>
                          </div>
                        </dl>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table></template
            >
            <template #summary="{ row }"
              ><span class="responsive-record-summary"
                ><strong>{{ auditActionText(row.action) }} · {{ statusText(row.outcome) }}</strong
                ><small
                  >{{ resourceText(row.resource_type) }} · {{ when(row.occurred_at) }}</small
                ></span
              ></template
            >
            <template #detail="{ row }"
              ><dl>
                <div>
                  <dt>操作</dt>
                  <dd>{{ auditActionText(row.action) }}</dd>
                </div>
                <div>
                  <dt>对象</dt>
                  <dd>{{ resourceText(row.resource_type) }}</dd>
                </div>
                <div>
                  <dt>结果</dt>
                  <dd>{{ statusText(row.outcome) }}</dd>
                </div>
                <div>
                  <dt>发生时间</dt>
                  <dd>{{ when(row.occurred_at) }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <dl>
                  <div>
                    <dt>操作代码</dt>
                    <dd>{{ row.action }}</dd>
                  </div>
                  <div>
                    <dt>对象类型</dt>
                    <dd>{{ row.resource_type }}</dd>
                  </div>
                  <div>
                    <dt>对象 ID</dt>
                    <dd>{{ row.resource_id || "—" }}</dd>
                  </div>
                  <div>
                    <dt>操作者 ID</dt>
                    <dd>{{ row.actor_id }}</dd>
                  </div>
                  <div>
                    <dt>请求 ID</dt>
                    <dd>{{ row.request_id }}</dd>
                  </div>
                  <div>
                    <dt>链路 ID</dt>
                    <dd>{{ row.trace_id }}</dd>
                  </div>
                </dl>
              </details></template
            >
          </ResponsiveDataView>
          <div
            v-if="mainPagination.total_pages > 1"
            class="security-pagination"
            aria-label="审计分页"
          >
            <button
              type="button"
              :disabled="refreshing || mainPagination.page <= 1"
              @click="goPage('main', mainPagination.page - 1)"
            >
              上一页</button
            ><span>第 {{ mainPagination.page }} / {{ mainPagination.total_pages }} 页</span
            ><button
              type="button"
              :disabled="refreshing || mainPagination.page >= mainPagination.total_pages"
              @click="goPage('main', mainPagination.page + 1)"
            >
              下一页
            </button>
          </div>
        </section>
      </div>

      <footer class="security-footer">
        <span>数据更新时间 {{ when(data.observed_at) }}</span>
        <TechnicalDetails :request-id="requestId" />
      </footer>
    </template>
  </section>
</template>
