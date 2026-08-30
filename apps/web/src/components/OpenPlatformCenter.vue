<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import "../platform-polish.css";
import "../open-platform.css";
import ConfirmDialog from "./ConfirmDialog.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";

type ViewKey = "clients" | "webhooks" | "deliveries";
type PageState =
  "loading" | "ready" | "empty" | "error" | "rate_limited" | "blocked" | "forbidden" | "expired";
type PageMeta = { page: number; page_size: number; total: number; total_pages: number };
type PendingAction = {
  title: string;
  path: string;
  method: "POST" | "PATCH";
  body: Record<string, unknown>;
  description: string;
  impact: string;
  destructive?: boolean;
};

const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  params = new URLSearchParams(location.search),
  views: ViewKey[] = ["clients", "webhooks", "deliveries"],
  requestedView = params.get("view") as ViewKey | null,
  activeView = ref<ViewKey>(
    requestedView && views.includes(requestedView) ? requestedView : "clients",
  ),
  organizationId = ref(params.get("organization_id") ?? ""),
  state = ref<PageState>("loading"),
  refreshing = ref(false),
  actionBusy = ref(false),
  hasSnapshot = ref(false),
  notice = ref(""),
  requestId = ref(""),
  secret = ref<{ value: string; kind: string } | null>(null),
  pending = ref<PendingAction | null>(null),
  fieldErrors = ref<Record<string, string>>({}),
  form = reactive({
    name: "",
    target_url: "",
    reason: "开放平台配置变更",
    quota_per_minute: 60,
    events: ["scoutops.test"],
  }),
  filters = reactive<
    Record<ViewKey, { query: string; status: string; sort: string; page: number; pageSize: number }>
  >({
    clients: { query: "", status: "all", sort: "updated_desc", page: 1, pageSize: 20 },
    webhooks: { query: "", status: "all", sort: "updated_desc", page: 1, pageSize: 20 },
    deliveries: { query: "", status: "all", sort: "updated_desc", page: 1, pageSize: 20 },
  }),
  emptyMeta = (): PageMeta => ({ page: 1, page_size: 20, total: 0, total_pages: 1 }),
  data = ref<any>({
    clients: [],
    webhooks: [],
    deliveries: [],
    summary: {
      clients: { total: 0, active: 0, expired: 0 },
      webhooks: { total: 0, active: 0 },
      deliveries: { total: 0, dead_letter: 0, retry_scheduled: 0 },
    },
    pagination: { clients: emptyMeta(), webhooks: emptyMeta(), deliveries: emptyMeta() },
    observed_at: null,
  });

for (const view of views) {
  if (view !== activeView.value) continue;
  filters[view].query = params.get("query") ?? "";
  filters[view].status = params.get("status") ?? "all";
  filters[view].sort = params.get("sort") ?? "updated_desc";
  filters[view].page = Math.max(1, Number(params.get("page")) || 1);
  filters[view].pageSize = [10, 20, 50].includes(Number(params.get("page_size")))
    ? Number(params.get("page_size"))
    : 20;
}

const viewMeta = {
    clients: {
      title: "接口访问账号",
      description: "独立密钥、权限范围、配额和有效期",
      search: "搜索账号名称或公开前缀",
    },
    webhooks: {
      title: "事件回调地址",
      description: "签名校验、启停控制和真实投递测试",
      search: "搜索回调名称或安全网址",
    },
    deliveries: {
      title: "投递记录",
      description: "响应结果、重试进度和失败原因",
      search: "搜索端点、事件或完整投递 ID",
    },
  } as const,
  currentFilter = computed(() => filters[activeView.value]),
  currentRows = computed<any[]>(() => data.value[activeView.value] ?? []),
  currentPagination = computed<PageMeta>(
    () => data.value.pagination?.[activeView.value] ?? emptyMeta(),
  ),
  currentSummary = computed(() => data.value.summary?.[activeView.value] ?? {}),
  currentTitle = computed(() => viewMeta[activeView.value].title),
  currentDescription = computed(() => viewMeta[activeView.value].description),
  currentSearch = computed(() => viewMeta[activeView.value].search),
  statusOptions = computed(() =>
    activeView.value === "clients"
      ? [
          ["all", "全部状态"],
          ["active", "可用"],
          ["expired", "已过期"],
          ["revoked", "已撤销"],
          ["rotated", "已轮换"],
        ]
      : activeView.value === "webhooks"
        ? [
            ["all", "全部状态"],
            ["active", "启用"],
            ["disabled", "停用"],
          ]
        : [
            ["all", "全部状态"],
            ["queued", "等待投递"],
            ["leased", "正在投递"],
            ["retry_scheduled", "等待重试"],
            ["succeeded", "成功"],
            ["dead_letter", "多次失败"],
          ],
  ),
  sortOptions = computed(() =>
    activeView.value === "deliveries"
      ? [
          ["updated_desc", "最近更新"],
          ["updated_asc", "最早更新"],
          ["attempts_desc", "尝试次数最多"],
        ]
      : [
          ["updated_desc", "最近更新"],
          ["updated_asc", "最早更新"],
          ["name_asc", "名称升序"],
          ["name_desc", "名称降序"],
        ],
  );

let loadController: AbortController | null = null;
function syncUrl() {
  const query = new URLSearchParams(),
    current = currentFilter.value;
  query.set("view", activeView.value);
  if (organizationId.value.trim()) query.set("organization_id", organizationId.value.trim());
  if (current.query) query.set("query", current.query);
  if (current.status !== "all") query.set("status", current.status);
  if (current.sort !== "updated_desc") query.set("sort", current.sort);
  if (current.page !== 1) query.set("page", String(current.page));
  if (current.pageSize !== 20) query.set("page_size", String(current.pageSize));
  history.replaceState(history.state, "", `${location.pathname}${query.size ? `?${query}` : ""}`);
}
async function revealActiveSummary() {
  await nextTick();
  if (innerWidth > 760) return;
  const navigation = document.querySelector<HTMLElement>(".open-summary"),
    active = navigation?.querySelector<HTMLElement>(`button[data-view="${activeView.value}"]`);
  if (navigation && active) navigation.scrollLeft = Math.max(0, active.offsetLeft - 18);
}
function apiQuery() {
  const query = new URLSearchParams();
  if (organizationId.value.trim()) query.set("organization_id", organizationId.value.trim());
  for (const view of views) {
    const singular = view === "clients" ? "client" : view === "webhooks" ? "webhook" : "delivery",
      filter = filters[view];
    query.set(`${singular}_page`, String(filter.page));
    query.set(`${singular}_page_size`, String(filter.pageSize));
    if (filter.query) query.set(`${singular}_query`, filter.query);
    if (filter.status !== "all") query.set(`${singular}_status`, filter.status);
    if (filter.sort !== "updated_desc") query.set(`${singular}_sort`, filter.sort);
  }
  return query;
}
async function load() {
  if (refreshing.value) return;
  loadController?.abort();
  loadController = new AbortController();
  const timeout = window.setTimeout(() => loadController?.abort("timeout"), 15000);
  refreshing.value = true;
  notice.value = "";
  if (!hasSnapshot.value) state.value = "loading";
  syncUrl();
  try {
    const response = await request<any>(`/platform/open?${apiQuery()}`, {
      signal: loadController.signal,
    });
    requestId.value = response.request_id;
    data.value = response.data;
    for (const view of views)
      filters[view].page = response.data.pagination?.[view]?.page ?? filters[view].page;
    hasSnapshot.value = true;
    state.value = currentRows.value.length ? "ready" : "empty";
    await revealActiveSummary();
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    notice.value = loadController.signal.aborted
      ? "读取超过 15 秒，已安全停止；仍保留上次成功结果。"
      : (failure?.actionHint ?? "读取失败，请检查网络后重试。");
    if (!hasSnapshot.value)
      state.value =
        failure?.status === 401
          ? "expired"
          : failure?.status === 403
            ? "forbidden"
            : failure?.status === 429
              ? "rate_limited"
              : (failure?.status ?? 0) >= 500 || !failure
                ? "blocked"
                : "error";
  } finally {
    window.clearTimeout(timeout);
    refreshing.value = false;
  }
}
function switchView(view: ViewKey) {
  activeView.value = view;
  notice.value = "";
  syncUrl();
  state.value = currentRows.value.length ? "ready" : "empty";
  void revealActiveSummary();
}
function applyFilters() {
  currentFilter.value.page = 1;
  void load();
}
function resetFilters() {
  Object.assign(currentFilter.value, {
    query: "",
    status: "all",
    sort: "updated_desc",
    page: 1,
    pageSize: 20,
  });
  void load();
}
function goToPage(page: number) {
  if (refreshing.value || page < 1 || page > currentPagination.value.total_pages) return;
  currentFilter.value.page = page;
  void load();
}

async function call(path: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
  if (actionBusy.value) return;
  actionBusy.value = true;
  notice.value = "";
  try {
    const response = await request<any>(path, { method, body });
    const actionRequestId = response.request_id,
      successNotice =
        response.data?.status === "queued"
          ? "已进入真实投递队列，可在投递记录查看 Worker 结果。"
          : "操作成功并已写入审计。";
    requestId.value = actionRequestId;
    if (response.data?.secret)
      secret.value = {
        value: response.data.secret,
        kind: path.includes("webhooks") ? "Webhook 签名密钥" : "API Client 密钥",
      };
    await load();
    requestId.value = actionRequestId;
    notice.value = successNotice;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    notice.value = failure?.actionHint ?? "操作失败，请稍后重试。";
  } finally {
    actionBusy.value = false;
  }
}
function prepare(action: PendingAction) {
  if (actionBusy.value) return;
  pending.value = action;
}
function confirm() {
  if (!pending.value) return;
  const action = pending.value;
  pending.value = null;
  void call(action.path, action.method, action.body);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(kind: "client" | "webhook") {
  const errors: Record<string, string> = {};
  if (!uuidPattern.test(organizationId.value.trim()))
    errors.organization_id = "请输入有效组织 UUID。";
  if (!form.name.trim() || form.name.trim().length > 120) errors.name = "名称需为 1–120 个字符。";
  if (!form.reason.trim() || form.reason.trim().length > 500)
    errors.reason = "变更原因需为 1–500 个字符。";
  if (
    kind === "client" &&
    (!Number.isInteger(form.quota_per_minute) ||
      form.quota_per_minute < 1 ||
      form.quota_per_minute > 1000)
  )
    errors.quota = "每分钟配额需为 1–1000 的整数。";
  if (kind === "webhook") {
    try {
      const url = new URL(form.target_url);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.hash ||
        (url.port && url.port !== "443")
      )
        throw new Error();
    } catch {
      errors.target_url = "仅允许无凭证、无片段的 HTTPS 443 地址。";
    }
    if (!form.events.length) errors.events = "至少选择一个真实事件。";
  }
  fieldErrors.value = errors;
  return !Object.keys(errors).length;
}
function createClient() {
  if (!validate("client")) return;
  prepare({
    title: "创建接口访问账号",
    path: "/platform/open/clients",
    method: "POST",
    body: {
      organization_id: organizationId.value.trim(),
      name: form.name.trim(),
      scopes: ["status:read"],
      quota_per_minute: form.quota_per_minute,
      reason: form.reason.trim(),
    },
    description: `令牌权限风险预览：组织 ${organizationId.value.trim()}，仅授权“读取系统状态”。`,
    impact: `每分钟最多 ${form.quota_per_minute} 次；不包含业务数据写入权限。密钥仅显示一次。`,
  });
}
function createWebhook() {
  if (!validate("webhook")) return;
  prepare({
    title: "创建事件回调地址",
    path: "/platform/open/webhooks",
    method: "POST",
    body: {
      organization_id: organizationId.value.trim(),
      name: form.name.trim(),
      target_url: form.target_url.trim(),
      events: [...form.events],
      reason: form.reason.trim(),
    },
    description: `将 ${form.events.map(eventText).join("、")} 投递到指定 HTTPS 地址。`,
    impact: "签名密钥仅显示一次；Worker 会在每次投递前检查 DNS 和私网地址。",
  });
}
function clientAction(row: any, action: "rotate" | "revoke") {
  prepare({
    title: action === "rotate" ? "轮换接口访问密钥" : "撤销接口访问账号",
    path: `/platform/open/clients/${row.id}/actions`,
    method: "POST",
    body: { action, expected_version: row.version, reason: form.reason.trim() },
    description: `令牌权限风险预览：账号 ${row.name}，组织 ${row.organization_id}，${row.scopes.map(scopeText).join("、")}。`,
    impact:
      action === "rotate"
        ? `仅保留读取系统状态权限，不包含业务数据写入权限；每分钟 ${row.quota_per_minute} 次限额保持不变。旧密钥立即失效，新密钥仅显示一次。`
        : "该账号不包含业务数据写入权限；撤销后访问立即终止且不可恢复，需要重新创建账号才能再次接入。",
    destructive: action === "revoke",
  });
}
function webhookUpdate(row: any) {
  const next = row.status === "active" ? "disabled" : "active";
  prepare({
    title: next === "active" ? "启用事件回调" : "停用事件回调",
    path: `/platform/open/webhooks/${row.id}`,
    method: "PATCH",
    body: {
      name: row.name,
      target_url: row.target_url,
      events: row.events,
      status: next,
      expected_version: row.version,
      reason: form.reason.trim(),
    },
    description: `${row.name} 将切换为“${statusText(next)}”。`,
    impact:
      next === "active"
        ? "恢复后新事件可再次进入投递队列。"
        : "停用期间不能发送测试回调，新事件不会投递到该地址。",
  });
}
function webhookAction(row: any, action: "test" | "rotate") {
  prepare({
    title: action === "test" ? "发送测试回调" : "轮换回调签名密钥",
    path: `/platform/open/webhooks/${row.id}/${action}`,
    method: "POST",
    body: {
      ...(action === "rotate" ? { expected_version: row.version } : {}),
      reason: form.reason.trim(),
    },
    description:
      action === "test" ? `向 ${row.name} 提交一条真实测试事件。` : `轮换 ${row.name} 的签名密钥。`,
    impact:
      action === "test"
        ? "Worker 将执行 DNS/私网检查、签名、投递和失败重试。"
        : "旧签名密钥立即失效，新密钥仅显示一次。",
  });
}
function replay(row: any) {
  prepare({
    title: "重新投递回调",
    path: `/platform/open/deliveries/${row.id}/replay`,
    method: "POST",
    body: { reason: form.reason.trim() },
    description: `基于投递 ${row.id} 创建一条新投递。`,
    impact: "原投递与事件历史保持不变；新投递将由 Worker 独立处理。",
  });
}
async function copySecret() {
  if (!secret.value) return;
  try {
    await navigator.clipboard.writeText(secret.value.value);
    notice.value = "一次性密钥已复制，请保存到受限凭证系统。";
  } catch {
    notice.value = "浏览器未允许复制，请手动保存后立即关闭。";
  }
}
function toggleEvent(event: string) {
  form.events = form.events.includes(event)
    ? form.events.filter((item) => item !== event)
    : [...form.events, event];
}

const statusText = (value: string) =>
    (
      ({
        active: "可用",
        expired: "已过期",
        revoked: "已撤销",
        rotated: "已轮换",
        enabled: "启用",
        disabled: "停用",
        queued: "等待投递",
        leased: "正在投递",
        succeeded: "成功",
        dead_letter: "多次失败",
        retry_scheduled: "等待重试",
      }) as Record<string, string>
    )[value] ?? "未知状态",
  scopeText = (value: string) =>
    (({ "status:read": "读取系统状态" }) as Record<string, string>)[value] ?? "未知权限",
  eventText = (value: string) =>
    (
      ({
        "scoutops.test": "测试事件",
        "task.updated": "任务更新",
        "approval.updated": "审批更新",
        "competitor.changed": "竞品变化",
      }) as Record<string, string>
    )[value] ?? "未知事件",
  formatTime = (value: string | null) => (value ? new Date(value).toLocaleString("zh-CN") : "从未"),
  rangeLabel = computed(() => {
    const meta = currentPagination.value;
    if (!meta.total) return "0 条";
    return `${(meta.page - 1) * meta.page_size + 1}–${Math.min(meta.page * meta.page_size, meta.total)} / ${meta.total} 条`;
  });

onMounted(load);
onBeforeUnmount(() => loadController?.abort());
</script>

<template>
  <section class="open-platform">
    <header class="open-hero">
      <div>
        <p>平台开放能力</p>
        <h2>开放接口与事件回调</h2>
        <span>为可信外部系统建立最小权限连接，统一管理密钥、回调和真实投递证据。</span>
      </div>
      <form class="open-org-filter" @submit.prevent="applyFilters">
        <label
          >组织编号<input
            v-model.trim="organizationId"
            autocomplete="off"
            placeholder="精确 UUID；留空查看全部组织"
        /></label>
        <button type="submit" :disabled="refreshing">{{ refreshing ? "读取中…" : "读取" }}</button>
      </form>
    </header>

    <aside v-if="secret" class="open-secret" aria-live="assertive">
      <div>
        <strong>{{ secret.kind }}仅显示本次</strong
        ><span>复制后存入受限凭证系统；关闭后无法再次查看。</span>
      </div>
      <code>{{ secret.value }}</code>
      <footer>
        <button type="button" @click="copySecret">复制密钥</button
        ><button type="button" @click="secret = null">我已安全保存</button>
      </footer>
    </aside>
    <p v-if="notice" class="open-notice" aria-live="polite">
      {{ notice }}
      <details v-if="requestId">
        <summary>技术详情</summary>
        <code>请求 ID：{{ requestId }}</code>
      </details>
    </p>

    <section v-if="state === 'loading'" class="open-state open-skeleton" aria-busy="true">
      <strong>正在读取真实开放平台数据</strong><span></span><span></span><span></span>
    </section>
    <section
      v-else-if="
        !hasSnapshot && ['error', 'rate_limited', 'blocked', 'forbidden', 'expired'].includes(state)
      "
      class="open-state"
    >
      <strong>{{
        state === "forbidden"
          ? "无权限查看开放平台"
          : state === "expired"
            ? "登录状态已过期"
            : state === "rate_limited"
              ? "请求过于频繁"
              : state === "blocked"
                ? "开放平台依赖受阻"
                : "读取失败"
      }}</strong>
      <p>{{ notice }}</p>
      <button type="button" @click="load">重试</button>
    </section>

    <template v-else>
      <nav class="open-summary" aria-label="开放平台数据类型">
        <button
          type="button"
          data-view="clients"
          :class="{ active: activeView === 'clients' }"
          @click="switchView('clients')"
        >
          <span>接口访问账号</span><strong>{{ data.summary.clients.total }}</strong
          ><small
            >{{ data.summary.clients.active }} 个可用 ·
            {{ data.summary.clients.expired }} 个过期</small
          >
        </button>
        <button
          type="button"
          data-view="webhooks"
          :class="{ active: activeView === 'webhooks' }"
          @click="switchView('webhooks')"
        >
          <span>事件回调地址</span><strong>{{ data.summary.webhooks.total }}</strong
          ><small>{{ data.summary.webhooks.active }} 个启用</small>
        </button>
        <button
          type="button"
          data-view="deliveries"
          :class="{ active: activeView === 'deliveries' }"
          @click="switchView('deliveries')"
        >
          <span>投递记录</span><strong>{{ data.summary.deliveries.total }}</strong
          ><small
            >{{ data.summary.deliveries.retry_scheduled }} 个重试 ·
            {{ data.summary.deliveries.dead_letter }} 个多次失败</small
          >
        </button>
      </nav>

      <section
        v-if="activeView !== 'deliveries'"
        class="open-create"
        aria-labelledby="open-create-title"
      >
        <header>
          <div>
            <p>新增连接</p>
            <h3 id="open-create-title">
              {{ activeView === "clients" ? "创建接口访问账号" : "创建事件回调地址" }}
            </h3>
          </div>
          <span>组织编号、名称和变更原因必填；所有写入均使用幂等键并记录审计。</span>
        </header>
        <div class="open-form-grid">
          <label
            >名称<input v-model="form.name" maxlength="120" autocomplete="off" /><small
              v-if="fieldErrors.name"
              class="field-error"
              >{{ fieldErrors.name }}</small
            ></label
          >
          <label v-if="activeView === 'clients'"
            >每分钟配额<input
              v-model.number="form.quota_per_minute"
              type="number"
              min="1"
              max="1000"
            /><small v-if="fieldErrors.quota" class="field-error">{{
              fieldErrors.quota
            }}</small></label
          >
          <label v-else class="wide"
            >事件回调安全网址<input
              v-model="form.target_url"
              type="url"
              placeholder="https://example.com/hooks/scoutops"
            /><small v-if="fieldErrors.target_url" class="field-error">{{
              fieldErrors.target_url
            }}</small></label
          >
          <fieldset v-if="activeView === 'webhooks'" class="wide">
            <legend>订阅事件</legend>
            <label
              v-for="event in [
                'scoutops.test',
                'task.updated',
                'approval.updated',
                'competitor.changed',
              ]"
              :key="event"
              ><input
                type="checkbox"
                :checked="form.events.includes(event)"
                @change="toggleEvent(event)"
              />{{ eventText(event) }}</label
            ><small v-if="fieldErrors.events" class="field-error">{{ fieldErrors.events }}</small>
          </fieldset>
          <label class="wide"
            >变更原因<input v-model="form.reason" maxlength="500" /><small
              v-if="fieldErrors.reason"
              class="field-error"
              >{{ fieldErrors.reason }}</small
            ><small v-if="fieldErrors.organization_id" class="field-error">{{
              fieldErrors.organization_id
            }}</small></label
          >
        </div>
        <button
          class="primary"
          type="button"
          :disabled="actionBusy"
          @click="activeView === 'clients' ? createClient() : createWebhook()"
        >
          {{
            actionBusy
              ? "提交中…"
              : activeView === "clients"
                ? "创建接口访问账号"
                : "创建事件回调地址"
          }}
        </button>
      </section>

      <section class="open-workspace">
        <header>
          <div>
            <h3>{{ currentTitle }}</h3>
            <p>{{ currentDescription }}</p>
          </div>
          <button type="button" :disabled="refreshing" @click="load">
            {{ refreshing ? "刷新中…" : "刷新" }}
          </button>
        </header>
        <form class="open-toolbar" @submit.prevent="applyFilters">
          <label class="grow"
            >搜索<input
              v-model.trim="currentFilter.query"
              :placeholder="currentSearch"
              maxlength="120"
          /></label>
          <label
            >状态<select v-model="currentFilter.status">
              <option v-for="option in statusOptions" :key="option[0]" :value="option[0]">
                {{ option[1] }}
              </option>
            </select></label
          >
          <label
            >排序<select v-model="currentFilter.sort">
              <option v-for="option in sortOptions" :key="option[0]" :value="option[0]">
                {{ option[1] }}
              </option>
            </select></label
          >
          <label
            >每页<select v-model.number="currentFilter.pageSize">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select></label
          >
          <button type="submit" :disabled="refreshing">应用</button
          ><button type="button" :disabled="refreshing" @click="resetFilters">重置</button>
        </form>

        <p v-if="!currentRows.length" class="open-empty">
          <strong>当前筛选没有{{ currentTitle }}</strong
          ><span>调整搜索或状态条件；数据不会被删除。</span
          ><button type="button" @click="resetFilters">清除筛选</button>
        </p>

        <ResponsiveDataView
          v-else-if="activeView === 'clients'"
          :rows="data.clients"
          :row-key="(row) => row.id"
          title="接口访问账号"
          :detail-title="(row) => row.name"
        >
          <template #desktop
            ><table>
              <thead>
                <tr>
                  <th>账号</th>
                  <th>权限与配额</th>
                  <th>状态与有效期</th>
                  <th>最近调用</th>
                  <th>操作</th>
                  <th>技术信息</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in data.clients" :key="row.id">
                  <td>
                    <strong class="open-clamp" :title="row.name">{{ row.name }}</strong>
                  </td>
                  <td>
                    {{ row.scopes.map(scopeText).join("、")
                    }}<small>每分钟 {{ row.quota_per_minute }} 次</small>
                  </td>
                  <td>
                    <span class="status-pill" :data-status="row.status">{{
                      statusText(row.status)
                    }}</span
                    ><small>{{ formatTime(row.expires_at) }} 到期</small>
                  </td>
                  <td>{{ formatTime(row.last_used_at) }}</td>
                  <td>
                    <div class="row-actions" v-if="row.status === 'active'">
                      <button type="button" @click="clientAction(row, 'rotate')">轮换</button
                      ><button class="danger" type="button" @click="clientAction(row, 'revoke')">
                        撤销
                      </button>
                    </div>
                    <span v-else>无可用操作</span>
                  </td>
                  <td>
                    <details>
                      <summary>技术详情</summary>
                      <code>{{ row.client_prefix }}</code>
                    </details>
                  </td>
                </tr>
              </tbody>
            </table></template
          >
          <template #summary="{ row }"
            ><span class="responsive-record-summary"
              ><strong>{{ row.name }}</strong
              ><small
                >{{ statusText(row.status) }} · {{ row.scopes.map(scopeText).join("、") }} · 每分钟
                {{ row.quota_per_minute }} 次</small
              ></span
            ></template
          >
          <template #detail="{ row }"
            ><dl>
              <div>
                <dt>授权范围</dt>
                <dd>{{ row.scopes.map(scopeText).join("、") }}</dd>
              </div>
              <div>
                <dt>每分钟限额</dt>
                <dd>{{ row.quota_per_minute }} 次</dd>
              </div>
              <div>
                <dt>当前状态</dt>
                <dd>{{ statusText(row.status) }}</dd>
              </div>
              <div>
                <dt>有效期</dt>
                <dd>{{ formatTime(row.expires_at) }}</dd>
              </div>
              <div>
                <dt>最近调用</dt>
                <dd>{{ formatTime(row.last_used_at) }}</dd>
              </div>
            </dl>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>账号 ID</dt>
                  <dd>{{ row.id }}</dd>
                </div>
                <div>
                  <dt>账号前缀</dt>
                  <dd>{{ row.client_prefix }}</dd>
                </div>
                <div>
                  <dt>组织 ID</dt>
                  <dd>{{ row.organization_id }}</dd>
                </div>
              </dl>
            </details>
            <template v-if="row.status === 'active'"
              ><button type="button" @click="clientAction(row, 'rotate')">轮换密钥</button
              ><button class="danger" type="button" @click="clientAction(row, 'revoke')">
                撤销账号
              </button></template
            ></template
          >
        </ResponsiveDataView>

        <ResponsiveDataView
          v-else-if="activeView === 'webhooks'"
          :rows="data.webhooks"
          :row-key="(row) => row.id"
          title="事件回调地址"
          :detail-title="(row) => row.name"
        >
          <template #desktop
            ><table>
              <thead>
                <tr>
                  <th>回调</th>
                  <th>订阅事件</th>
                  <th>状态</th>
                  <th>最近更新</th>
                  <th>操作</th>
                  <th>技术信息</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in data.webhooks" :key="row.id">
                  <td>
                    <strong class="open-clamp" :title="row.name">{{ row.name }}</strong
                    ><small class="open-url" :title="row.target_url">{{ row.target_url }}</small>
                  </td>
                  <td>{{ row.events.map(eventText).join("、") }}</td>
                  <td>
                    <span class="status-pill" :data-status="row.status">{{
                      statusText(row.status)
                    }}</span
                    ><small>第 {{ row.version }} 版</small>
                  </td>
                  <td>{{ formatTime(row.updated_at) }}</td>
                  <td>
                    <div class="row-actions">
                      <button type="button" @click="webhookUpdate(row)">
                        {{ row.status === "active" ? "停用" : "启用" }}</button
                      ><button
                        v-if="row.status === 'active'"
                        type="button"
                        @click="webhookAction(row, 'test')"
                      >
                        测试</button
                      ><button type="button" @click="webhookAction(row, 'rotate')">轮换密钥</button>
                    </div>
                  </td>
                  <td>
                    <details>
                      <summary>技术详情</summary>
                      <code>{{ row.id }}</code>
                    </details>
                  </td>
                </tr>
              </tbody>
            </table></template
          >
          <template #summary="{ row }"
            ><span class="responsive-record-summary"
              ><strong>{{ row.name }}</strong
              ><small
                >{{ statusText(row.status) }} · {{ row.events.map(eventText).join("、") }}</small
              ></span
            ></template
          >
          <template #detail="{ row }"
            ><dl>
              <div>
                <dt>安全网址</dt>
                <dd>{{ row.target_url }}</dd>
              </div>
              <div>
                <dt>订阅事件</dt>
                <dd>{{ row.events.map(eventText).join("、") }}</dd>
              </div>
              <div>
                <dt>当前状态</dt>
                <dd>{{ statusText(row.status) }}</dd>
              </div>
              <div>
                <dt>最近更新</dt>
                <dd>{{ formatTime(row.updated_at) }}</dd>
              </div>
            </dl>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>回调 ID</dt>
                  <dd>{{ row.id }}</dd>
                </div>
                <div>
                  <dt>组织 ID</dt>
                  <dd>{{ row.organization_id }}</dd>
                </div>
                <div>
                  <dt>签名指纹</dt>
                  <dd>{{ row.fingerprint }}</dd>
                </div>
              </dl>
            </details>
            <button type="button" @click="webhookUpdate(row)">
              {{ row.status === "active" ? "停用回调" : "启用回调" }}</button
            ><button
              v-if="row.status === 'active'"
              type="button"
              @click="webhookAction(row, 'test')"
            >
              发送测试</button
            ><button type="button" @click="webhookAction(row, 'rotate')">轮换密钥</button></template
          >
        </ResponsiveDataView>

        <ResponsiveDataView
          v-else-if="activeView === 'deliveries'"
          :rows="data.deliveries"
          :row-key="(row) => row.id"
          title="投递记录"
          :detail-title="(row) => row.endpoint_name"
        >
          <template #desktop
            ><table>
              <thead>
                <tr>
                  <th>端点与事件</th>
                  <th>状态</th>
                  <th>响应</th>
                  <th>下次可用</th>
                  <th>更新时间</th>
                  <th>操作</th>
                  <th>技术信息</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in data.deliveries" :key="row.id">
                  <td>
                    <strong class="open-clamp" :title="row.endpoint_name">{{
                      row.endpoint_name
                    }}</strong
                    ><small>{{ eventText(row.event_type) }}</small>
                  </td>
                  <td>
                    <span class="status-pill" :data-status="row.status">{{
                      statusText(row.status)
                    }}</span
                    ><small>已尝试 {{ row.attempt_count }} 次</small>
                  </td>
                  <td>{{ row.response_status ?? (row.last_error_code ? "投递失败" : "—") }}</td>
                  <td>{{ formatTime(row.available_at) }}</td>
                  <td>{{ formatTime(row.updated_at) }}</td>
                  <td>
                    <button
                      v-if="['dead_letter', 'succeeded'].includes(row.status)"
                      type="button"
                      @click="replay(row)"
                    >
                      重放</button
                    ><span v-else>由 Worker 处理</span>
                  </td>
                  <td>
                    <details>
                      <summary>技术详情</summary>
                      <code>{{ row.last_error_code || row.id }}</code>
                    </details>
                  </td>
                </tr>
              </tbody>
            </table></template
          >
          <template #summary="{ row }"
            ><span class="responsive-record-summary"
              ><strong>{{ row.endpoint_name }}</strong
              ><small
                >{{ statusText(row.status) }} · {{ eventText(row.event_type) }} · 已尝试
                {{ row.attempt_count }} 次</small
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
                <dt>当前状态</dt>
                <dd>{{ statusText(row.status) }}</dd>
              </div>
              <div>
                <dt>尝试次数</dt>
                <dd>{{ row.attempt_count }} 次</dd>
              </div>
              <div>
                <dt>响应状态</dt>
                <dd>{{ row.response_status ?? (row.last_error_code ? "投递失败" : "—") }}</dd>
              </div>
              <div>
                <dt>下次可用</dt>
                <dd>{{ formatTime(row.available_at) }}</dd>
              </div>
              <div>
                <dt>更新时间</dt>
                <dd>{{ formatTime(row.updated_at) }}</dd>
              </div>
            </dl>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>投递 ID</dt>
                  <dd>{{ row.id }}</dd>
                </div>
                <div>
                  <dt>回调 ID</dt>
                  <dd>{{ row.endpoint_id }}</dd>
                </div>
                <div>
                  <dt>组织 ID</dt>
                  <dd>{{ row.organization_id }}</dd>
                </div>
                <div v-if="row.last_error_code">
                  <dt>错误代码</dt>
                  <dd>{{ row.last_error_code }}</dd>
                </div>
              </dl>
            </details>
            <button
              v-if="['dead_letter', 'succeeded'].includes(row.status)"
              type="button"
              @click="replay(row)"
            >
              重放
            </button></template
          >
        </ResponsiveDataView>

        <footer class="open-pagination">
          <span
            >{{ rangeLabel }} · 第 {{ currentPagination.page }} /
            {{ currentPagination.total_pages }} 页</span
          >
          <nav aria-label="开放平台分页">
            <button
              type="button"
              :disabled="refreshing || currentPagination.page <= 1"
              @click="goToPage(currentPagination.page - 1)"
            >
              上一页</button
            ><button
              type="button"
              :disabled="refreshing || currentPagination.page >= currentPagination.total_pages"
              @click="goToPage(currentPagination.page + 1)"
            >
              下一页
            </button>
          </nav>
        </footer>
      </section>
    </template>

    <ConfirmDialog
      :open="Boolean(pending)"
      :title="pending?.title ?? ''"
      :description="pending?.description ?? ''"
      :impact="pending?.impact ?? ''"
      :destructive="pending?.destructive ?? false"
      confirm-label="确认执行"
      @cancel="pending = null"
      @confirm="confirm"
    />
  </section>
</template>
