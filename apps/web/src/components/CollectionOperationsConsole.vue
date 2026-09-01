<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import { statusLabel } from "../ui/status-labels";
import ConfirmDialog from "./ConfirmDialog.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import TechnicalDetails from "./TechnicalDetails.vue";
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const route = useRoute(),
  router = useRouter(),
  queryText = (name: string) => {
    const value = route.query[name];
    return typeof value === "string" ? value : "";
  },
  queryPage = (name: string) => {
    const value = queryText(name);
    return /^\d{1,6}$/.test(value) && Number(value) > 0 ? Number(value) : 1;
  },
  initialWindow = ["24h", "7d", "30d", "all"].includes(queryText("window"))
    ? queryText("window")
    : "24h";
const state = ref("loading"),
  data = ref<any>(null),
  org = ref(queryText("organization_id")),
  workspace = ref(queryText("workspace_id")),
  provider = ref(queryText("provider_id")),
  timeWindow = ref(initialWindow),
  errorCode = ref(queryText("error_code")),
  attemptPage = ref(queryPage("attempt_page")),
  deadLetterPage = ref(queryPage("dead_letter_page")),
  requestId = ref(""),
  hint = ref(""),
  refreshNotice = ref(""),
  refreshing = ref(false),
  selectedDeadLetterIds = ref<string[]>([]),
  batchReason = ref(""),
  batchPreview = ref(false),
  batchId = ref(""),
  batchBusy = ref(false),
  batchNotice = ref(""),
  batchFailures = ref<Array<{ task: string; reason: string }>>([]),
  rootCauseSection = ref<HTMLElement | null>(null);
let activeController: AbortController | null = null;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const selectedDeadLetters = computed(() =>
    (data.value?.dead_letters ?? []).filter(
      (item: any) => item.status === "open" && selectedDeadLetterIds.value.includes(item.id),
    ),
  ),
  batchImpact = computed(() => {
    const items = selectedDeadLetters.value,
      roots = new Map<string, number>();
    for (const item of items) roots.set(item.error_code, (roots.get(item.error_code) ?? 0) + 1);
    const rootSummary = [...roots.entries()]
        .map(([code, total]) => `${errorLabel(code)} ${total} 条`)
        .join("、"),
      organizationCount = new Set(items.map((item: any) => item.organization_id)).size,
      workspaceCount = new Set(items.map((item: any) => item.workspace_id)).size;
    return `${items.length} 条开放死信；${organizationCount} 个组织；${workspaceCount} 个工作区；根因：${rootSummary || "无"}。`;
  }),
  scopeFilterCount = computed(
    () =>
      [org.value, workspace.value, provider.value, errorCode.value].filter(Boolean).length +
      (timeWindow.value === "24h" ? 0 : 1),
  );

function scopeValidation() {
  if (org.value && !uuidPattern.test(org.value.trim())) return "请输入有效的组织 ID。";
  if (workspace.value && !uuidPattern.test(workspace.value.trim()))
    return "请输入有效的工作区 ID。";
  if (provider.value && !uuidPattern.test(provider.value)) return "请选择有效的采集来源。";
  return "";
}

async function syncUrl() {
  const query: Record<string, string> = {};
  if (org.value.trim()) query.organization_id = org.value.trim();
  if (workspace.value.trim()) query.workspace_id = workspace.value.trim();
  if (provider.value) query.provider_id = provider.value;
  if (timeWindow.value !== "24h") query.window = timeWindow.value;
  if (errorCode.value) query.error_code = errorCode.value;
  if (attemptPage.value > 1) query.attempt_page = String(attemptPage.value);
  if (deadLetterPage.value > 1) query.dead_letter_page = String(deadLetterPage.value);
  if (route.query.root_cause === "1") query.root_cause = "1";
  await router.replace({ query });
}

async function load(options: { updateUrl?: boolean } = {}) {
  if (refreshing.value) return;
  const validation = scopeValidation();
  if (validation) {
    refreshNotice.value = validation;
    return;
  }
  const hadData = Boolean(data.value);
  refreshing.value = true;
  refreshNotice.value = "";
  hint.value = "";
  if (!hadData) state.value = "loading";
  const q = new URLSearchParams();
  if (org.value.trim()) q.set("organization_id", org.value.trim());
  if (workspace.value.trim()) q.set("workspace_id", workspace.value.trim());
  if (provider.value) q.set("provider_id", provider.value);
  q.set("window", timeWindow.value);
  if (errorCode.value) q.set("error_code", errorCode.value);
  q.set("attempt_page", String(attemptPage.value));
  q.set("dead_letter_page", String(deadLetterPage.value));
  activeController = new AbortController();
  const controller = activeController;
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    if (options.updateUrl !== false) await syncUrl();
    const response = await request<any>(`/platform/collection/console?${q}`, {
      signal: controller.signal,
    });
    requestId.value = response.request_id;
    data.value = response.data;
    const openIds = new Set(
      response.data.dead_letters
        .filter((item: any) => item.status === "open")
        .map((item: any) => item.id),
    );
    selectedDeadLetterIds.value = selectedDeadLetterIds.value.filter((id) => openIds.has(id));
    state.value =
      response.data.sources.length +
      response.data.task_states.length +
      response.data.dead_letters.length +
      response.data.quality.length
        ? "ready"
        : "empty";
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    const message = controller.signal.aborted
      ? "读取超过 15 秒，已安全取消；当前已验证数据仍保留。"
      : (failure?.actionHint ?? "网络或服务异常，当前已验证数据仍保留。");
    if (hadData) {
      refreshNotice.value = message.includes("当前已验证数据仍保留")
        ? message
        : `${message} 当前已验证数据仍保留。`;
      state.value = "ready";
    } else {
      requestId.value = failure?.requestId ?? "";
      hint.value = message;
      state.value = failure?.kind ?? "blocked";
    }
  } finally {
    window.clearTimeout(timer);
    if (activeController === controller) activeController = null;
    refreshing.value = false;
  }
}
onMounted(async () => {
  await load();
  if (route.query.root_cause === "1") {
    await nextTick();
    rootCauseSection.value?.scrollIntoView({ block: "start" });
    rootCauseSection.value?.focus();
  }
});
onBeforeUnmount(() => activeController?.abort());
const when = (v: string | null) =>
    v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未检查",
  linkLabels: Record<string, string> = {
    provider_registry: "来源配置",
    adapter_health: "适配器健康",
    source_catalog: "来源目录",
    task_monitor: "采集任务",
    browser_runtime: "浏览器运行",
    data_quality: "数据质量",
  },
  healthLabel = (value: string) =>
    (
      ({
        ready: "正常",
        healthy: "正常",
        warning: "需要关注",
        degraded: "性能下降",
        blocked: "采集受阻",
        critical: "严重异常",
        unknown: "尚未检查",
      }) as Record<string, string>
    )[value] ?? "状态待确认",
  errorLabel = (value: string | null) =>
    value
      ? ((
          {
            network_error: "网络异常",
            dns_error: "域名解析失败",
            timeout: "请求超时",
            rate_limited: "来源限速",
            login_required: "需要登录",
            session_expired: "登录已失效",
            blocked_login: "登录已失效",
            captcha: "验证码受阻",
            blocked_captcha: "验证码受阻",
            robots_disallowed: "站点规则阻止",
            parser_error: "页面解析失败",
            parser_failed: "页面解析失败",
            parse_failed: "页面解析失败",
            source_changed: "页面结构已变化",
            validation_failed: "数据校验失败",
            permission_denied: "权限受阻",
          } as Record<string, string>
        )[value] ?? "其他采集错误")
      : "无错误",
  errorCategory = (value: string) =>
    (
      ({
        network_error: "网络",
        dns_error: "网络",
        timeout: "网络",
        login_required: "登录",
        session_expired: "登录",
        blocked_login: "登录",
        captcha: "验证码",
        blocked_captcha: "验证码",
        parser_error: "解析",
        parser_failed: "解析",
        parse_failed: "解析",
        source_changed: "解析",
      }) as Record<string, string>
    )[value] ?? "其他",
  sourceRowKey = (item: any) => item.id,
  sourceDetailTitle = (item: any) => `${item.name}详情`,
  attemptRowKey = (item: any) => item.id,
  attemptDetailTitle = (item: any) => `第 ${item.attempt_number} 次尝试详情`,
  drillRootCause = async (value: string) => {
    if (refreshing.value) return;
    errorCode.value = errorCode.value === value ? "" : value;
    attemptPage.value = 1;
    deadLetterPage.value = 1;
    await load();
  };

function applyScope() {
  attemptPage.value = 1;
  deadLetterPage.value = 1;
  void load();
}

function resetScope() {
  org.value = "";
  workspace.value = "";
  provider.value = "";
  timeWindow.value = "24h";
  errorCode.value = "";
  attemptPage.value = 1;
  deadLetterPage.value = 1;
  void load();
}

function goToPage(kind: "attempts" | "dead_letters", page: number) {
  if (refreshing.value || page < 1) return;
  if (kind === "attempts") attemptPage.value = page;
  else deadLetterPage.value = page;
  void load();
}

function rangeLabel(meta: any) {
  if (!meta?.total) return "0 条";
  const start = (meta.page - 1) * meta.page_size + 1;
  const end = Math.min(meta.page * meta.page_size, meta.total);
  return `${start}–${end} / ${meta.total} 条`;
}

function toggleDeadLetter(id: string, event: Event) {
  const target = event.target as HTMLInputElement;
  const checked = target.checked;
  if (!checked) {
    selectedDeadLetterIds.value = selectedDeadLetterIds.value.filter((value) => value !== id);
    return;
  }
  if (selectedDeadLetterIds.value.length >= 20) {
    target.checked = false;
    batchNotice.value = "每批最多选择 20 条开放死信。";
    return;
  }
  selectedDeadLetterIds.value = [...selectedDeadLetterIds.value, id];
}

function previewBatchReplay() {
  batchNotice.value = "";
  batchFailures.value = [];
  if (!selectedDeadLetters.value.length) {
    batchNotice.value = "请先选择要重放的开放死信。";
    return;
  }
  if (batchReason.value.trim().length < 2 || batchReason.value.length > 500) {
    batchNotice.value = "重放原因需要 2–500 字符。";
    return;
  }
  batchId.value = crypto.randomUUID();
  batchPreview.value = true;
}

async function confirmBatchReplay() {
  if (batchBusy.value) return;
  batchBusy.value = true;
  batchPreview.value = false;
  const batchItems = [...selectedDeadLetters.value];
  const succeeded = new Set<string>();
  batchFailures.value = [];
  for (const item of batchItems) {
    try {
      await request(`/platform/collection/tasks/${item.task_id}/replay`, {
        method: "POST",
        idempotencyKey: `dead-batch:${batchId.value}:${item.task_id}`,
        body: { reason: batchReason.value.trim() },
      });
      succeeded.add(item.id);
    } catch (error) {
      const failure = error instanceof ApiClientError ? error : null;
      batchFailures.value.push({
        task: item.task_id.slice(0, 8),
        reason: failure?.actionHint ?? "重放请求失败，请查看任务详情与服务端日志。",
      });
    }
  }
  selectedDeadLetterIds.value = selectedDeadLetterIds.value.filter((id) => !succeeded.has(id));
  batchNotice.value = `批量重放完成：成功 ${succeeded.size} 条，失败 ${batchFailures.value.length} 条；每条均保留独立任务历史、幂等记录与审计。`;
  batchBusy.value = false;
  await load({ updateUrl: false });
}
</script>
<template>
  <section class="collection-ops">
    <header>
      <div class="collection-ops-heading">
        <div>
          <p>采集运行管理</p>
          <h2>来源与采集控制台</h2>
          <span
            >来源配置、健康、任务尝试、死信和质量问题使用同一事实视图；敏感操作仍进入对应受控页面。</span
          >
        </div>
        <button type="button" :disabled="refreshing" @click="load()">
          {{ refreshing ? "正在刷新" : "刷新数据" }}
        </button>
      </div>
      <ResponsiveFilterDrawer label="采集范围与时间" :active-count="scopeFilterCount">
        <form @submit.prevent="applyScope">
          <label class="collection-filter-field"
            ><span>组织内部编号</span
            ><input
              v-model="org"
              aria-label="组织内部编号筛选"
              placeholder="可选，输入组织内部编号" /></label
          ><label class="collection-filter-field"
            ><span>工作区内部编号</span
            ><input
              v-model="workspace"
              aria-label="工作区内部编号筛选"
              placeholder="可选，输入工作区内部编号"
          /></label>
          <label class="collection-filter-field"
            ><span>采集来源</span
            ><select v-model="provider" aria-label="采集来源筛选">
              <option value="">全部来源</option>
              <option
                v-for="source in data?.source_options ?? []"
                :key="source.id"
                :value="source.id"
              >
                {{ source.name }}
              </option>
            </select></label
          ><label class="collection-filter-field"
            ><span>观测时间</span
            ><select v-model="timeWindow" aria-label="观测时间筛选">
              <option value="24h">最近 24 小时</option>
              <option value="7d">最近 7 天</option>
              <option value="30d">最近 30 天</option>
              <option value="all">全部时间</option>
            </select></label
          >
          <div class="collection-filter-actions">
            <button type="button" :disabled="refreshing || !scopeFilterCount" @click="resetScope">
              重置
            </button>
            <button type="submit" :disabled="refreshing">
              {{ refreshing ? "正在应用" : "应用范围" }}
            </button>
          </div>
        </form>
      </ResponsiveFilterDrawer>
    </header>
    <p v-if="refreshNotice" class="collection-refresh-notice" role="alert">
      {{ refreshNotice }}
      <button type="button" :disabled="refreshing" @click="load()">重试</button>
    </p>
    <section v-if="state !== 'ready'" class="platform-dashboard-state" :data-kind="state">
      <h3>
        {{
          state === "loading"
            ? "正在读取采集运行事实"
            : state === "empty"
              ? "当前范围没有采集事实"
              : state === "expired"
                ? "登录已失效"
                : state === "forbidden"
                  ? "你没有此项权限"
                  : state === "rate_limited"
                    ? "请求过于频繁"
                    : "采集控制台依赖受阻"
        }}
      </h3>
      <p>{{ hint || "刷新或检查宝塔 Node API 与 MySQL 后重试。" }}</p>
      <TechnicalDetails :request-id="requestId" /><button
        v-if="!['loading', 'expired', 'forbidden'].includes(state)"
        :disabled="refreshing"
        @click="load()"
      >
        重新读取
      </button>
    </section>
    <template v-else-if="data"
      ><nav class="collection-ops-links">
        <RouterLink v-for="(path, label) in data.links" :key="path" :to="path">{{
          linkLabels[label] ?? "相关管理页面"
        }}</RouterLink>
      </nav>
      <div class="collection-ops-grid">
        <section>
          <h3>来源与健康</h3>
          <ResponsiveDataView
            v-if="data.sources.length"
            title="来源与健康"
            :rows="data.sources"
            :row-key="sourceRowKey"
            :detail-title="sourceDetailTitle"
          >
            <template #desktop>
              <table>
                <thead>
                  <tr>
                    <th>来源</th>
                    <th>状态</th>
                    <th>健康</th>
                    <th>连续失败</th>
                    <th>最近检查</th>
                    <th>技术详情</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in data.sources" :key="s.id">
                    <td>
                      <b>{{ s.name }}</b
                      ><small>{{ s.owner_label }}</small>
                    </td>
                    <td>{{ statusLabel(s.status) }}</td>
                    <td>
                      <i :data-health="s.health_status">{{ healthLabel(s.health_status) }}</i>
                    </td>
                    <td>{{ s.consecutive_failures }}</td>
                    <td>{{ when(s.last_checked_at) }}</td>
                    <td>
                      <details>
                        <summary>查看</summary>
                        <code>{{ s.code }}</code>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template #summary="{ row: s }">
              <span class="responsive-record-summary">
                <strong>{{ s.name }}</strong>
                <span>{{ statusLabel(s.status) }} · {{ healthLabel(s.health_status) }}</span>
                <small>{{ s.owner_label }} · 最近检查 {{ when(s.last_checked_at) }}</small>
              </span>
            </template>
            <template #detail="{ row: s }">
              <dl>
                <div>
                  <dt>来源</dt>
                  <dd>{{ s.name }}</dd>
                </div>
                <div>
                  <dt>负责人</dt>
                  <dd>{{ s.owner_label }}</dd>
                </div>
                <div>
                  <dt>运行状态</dt>
                  <dd>{{ statusLabel(s.status) }}</dd>
                </div>
                <div>
                  <dt>健康状态</dt>
                  <dd>{{ healthLabel(s.health_status) }}</dd>
                </div>
                <div>
                  <dt>连续失败</dt>
                  <dd>{{ s.consecutive_failures }}</dd>
                </div>
                <div>
                  <dt>最近检查</dt>
                  <dd>{{ when(s.last_checked_at) }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <code>{{ s.code }}</code>
              </details>
            </template>
          </ResponsiveDataView>
          <p v-else class="collection-section-empty">当前范围没有来源健康记录。</p>
        </section>
        <section>
          <h3>任务状态</h3>
          <div v-if="data.task_states.length" class="collection-state-chips">
            <span v-for="t in data.task_states" :key="t.status"
              ><b>{{ t.total }}</b
              >{{ statusLabel(t.status) }}</span
            >
          </div>
          <p v-else class="collection-section-empty">当前范围没有任务状态记录。</p>
          <h3>质量问题</h3>
          <div v-if="data.quality.length" class="collection-state-chips">
            <span v-for="q in data.quality" :key="q.status + q.severity"
              ><b>{{ q.total }}</b
              >{{ statusLabel(q.status) }} · {{ q.severity === "critical" ? "严重" : "警告" }}</span
            >
          </div>
          <p v-else class="collection-section-empty">当前范围没有质量问题。</p>
        </section>
        <section ref="rootCauseSection" class="collection-root-causes" tabindex="-1">
          <header>
            <div>
              <h3>错误根因</h3>
              <small>按真实死信错误码聚合失败任务，选择后下钻尝试与死信。</small>
            </div>
            <button
              v-if="errorCode"
              type="button"
              class="collection-clear-root"
              @click="drillRootCause(errorCode)"
            >
              清除根因筛选
            </button>
          </header>
          <div v-if="data.root_causes?.length" class="collection-root-list">
            <article
              v-for="root in data.root_causes ?? []"
              :key="root.error_code"
              :data-selected="errorCode === root.error_code"
            >
              <button
                type="button"
                :aria-pressed="errorCode === root.error_code"
                @click="drillRootCause(root.error_code)"
              >
                <b>{{ errorLabel(root.error_code) }}</b>
                <span>{{ root.total }} 次 · 最近 {{ when(root.latest_at) }}</span>
                <small>告警类别：{{ errorCategory(root.error_code) }}</small>
              </button>
              <details>
                <summary>技术详情</summary>
                <code>{{ root.error_code }}</code>
              </details>
            </article>
          </div>
          <p v-else>当前筛选范围没有采集错误。</p>
        </section>
        <section>
          <header class="collection-section-header">
            <h3>最近尝试</h3>
            <span>{{ rangeLabel(data.pagination?.attempts) }}</span>
          </header>
          <ResponsiveDataView
            v-if="data.attempts.length"
            title="最近尝试"
            :rows="data.attempts"
            :row-key="attemptRowKey"
            :detail-title="attemptDetailTitle"
          >
            <template #desktop>
              <table>
                <thead>
                  <tr>
                    <th>尝试</th>
                    <th>任务处理器</th>
                    <th>状态</th>
                    <th>错误</th>
                    <th>技术详情</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in data.attempts" :key="a.id">
                    <td>第 {{ a.attempt_number }} 次</td>
                    <td>{{ a.worker_id }}</td>
                    <td>{{ statusLabel(a.status) }}</td>
                    <td>{{ errorLabel(a.error_code) }}</td>
                    <td>
                      <details>
                        <summary>查看</summary>
                        <code>任务 {{ a.task_id }}</code
                        ><br />
                        <code>链路 {{ a.trace_id }}</code
                        ><br />
                        <code v-if="a.error_code">错误 {{ a.error_code }}</code>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template #summary="{ row: a }">
              <span class="responsive-record-summary">
                <strong>第 {{ a.attempt_number }} 次尝试 · {{ statusLabel(a.status) }}</strong>
                <span>{{ errorLabel(a.error_code) }}</span>
                <small>{{ a.worker_id }} · {{ when(a.started_at) }}</small>
              </span>
            </template>
            <template #detail="{ row: a }">
              <dl>
                <div>
                  <dt>尝试次数</dt>
                  <dd>第 {{ a.attempt_number }} 次</dd>
                </div>
                <div>
                  <dt>任务处理器</dt>
                  <dd>{{ a.worker_id }}</dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>{{ statusLabel(a.status) }}</dd>
                </div>
                <div>
                  <dt>错误</dt>
                  <dd>{{ errorLabel(a.error_code) }}</dd>
                </div>
                <div>
                  <dt>开始时间</dt>
                  <dd>{{ when(a.started_at) }}</dd>
                </div>
                <div>
                  <dt>结束时间</dt>
                  <dd>{{ when(a.finished_at) }}</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <code>任务 {{ a.task_id }}</code
                ><br />
                <code>链路 {{ a.trace_id }}</code
                ><br />
                <code v-if="a.error_code">错误 {{ a.error_code }}</code>
              </details>
            </template>
          </ResponsiveDataView>
          <p v-else class="collection-section-empty">当前页没有任务尝试。</p>
          <nav
            v-if="data.pagination?.attempts?.total_pages > 1"
            class="collection-pagination"
            aria-label="最近尝试分页"
          >
            <button
              type="button"
              :disabled="refreshing || data.pagination.attempts.page <= 1"
              @click="goToPage('attempts', data.pagination.attempts.page - 1)"
            >
              上一页
            </button>
            <span
              >第 {{ data.pagination.attempts.page }} /
              {{ data.pagination.attempts.total_pages }} 页</span
            >
            <button
              type="button"
              :disabled="
                refreshing || data.pagination.attempts.page >= data.pagination.attempts.total_pages
              "
              @click="goToPage('attempts', data.pagination.attempts.page + 1)"
            >
              下一页
            </button>
          </nav>
        </section>
        <section>
          <header class="collection-section-header">
            <h3>开放与已重放死信</h3>
            <span>{{ rangeLabel(data.pagination?.dead_letters) }}</span>
          </header>
          <p v-if="batchNotice" aria-live="polite">{{ batchNotice }}</p>
          <details v-if="batchFailures.length" class="collection-batch-failures">
            <summary>查看失败条目（{{ batchFailures.length }}）</summary>
            <ul>
              <li v-for="failure in batchFailures" :key="failure.task">
                任务 {{ failure.task }}…：{{ failure.reason }}
              </li>
            </ul>
          </details>
          <details>
            <summary>批量安全重放</summary>
            <p>
              只处理明确勾选的开放死信，每批最多 20 条；执行前会固定展示根因、组织和工作区影响范围。
            </p>
            <p>已选择 {{ selectedDeadLetterIds.length }} / 20 条；切换死信页会清除非当前页选择。</p>
            <label v-for="d in data.dead_letters" :key="`select-${d.id}`">
              <input
                type="checkbox"
                :checked="selectedDeadLetterIds.includes(d.id)"
                :disabled="d.status !== 'open' || batchBusy"
                @change="toggleDeadLetter(d.id, $event)"
              />
              选择{{ errorLabel(d.error_code) }}死信 {{ d.task_id.slice(0, 8) }}…
            </label>
            <label>
              批量重放原因
              <textarea
                v-model="batchReason"
                maxlength="500"
                placeholder="说明恢复条件和重放原因（2–500 字）"
              ></textarea>
            </label>
            <button type="button" :disabled="batchBusy" @click="previewBatchReplay">
              {{ batchBusy ? "正在重放" : "预览批量重放" }}
            </button>
          </details>
          <ul v-if="data.dead_letters.length">
            <li v-for="d in data.dead_letters" :key="d.id">
              <b>{{ errorLabel(d.error_code) }}</b
              ><span>{{ statusLabel(d.status) }} · {{ when(d.created_at) }}</span
              ><RouterLink :to="`/platform-admin/collection?task=${d.task_id}`"
                >查看并受控重放</RouterLink
              >
              <details>
                <summary>技术详情</summary>
                <code>错误 {{ d.error_code }}</code
                ><br />
                <code>任务 {{ d.task_id }}</code
                ><br />
                <code>组织 {{ d.organization_id }}</code
                ><br />
                <code>工作区 {{ d.workspace_id }}</code>
              </details>
            </li>
          </ul>
          <p v-else class="collection-section-empty">当前页没有死信记录。</p>
          <nav
            v-if="data.pagination?.dead_letters?.total_pages > 1"
            class="collection-pagination"
            aria-label="死信记录分页"
          >
            <button
              type="button"
              :disabled="refreshing || data.pagination.dead_letters.page <= 1"
              @click="goToPage('dead_letters', data.pagination.dead_letters.page - 1)"
            >
              上一页
            </button>
            <span
              >第 {{ data.pagination.dead_letters.page }} /
              {{ data.pagination.dead_letters.total_pages }} 页</span
            >
            <button
              type="button"
              :disabled="
                refreshing ||
                data.pagination.dead_letters.page >= data.pagination.dead_letters.total_pages
              "
              @click="goToPage('dead_letters', data.pagination.dead_letters.page + 1)"
            >
              下一页
            </button>
          </nav>
        </section>
      </div>
      <footer>
        <span>观测时间 {{ when(data.observed_at) }}</span>
        <TechnicalDetails :request-id="requestId" /></footer
    ></template>
    <ConfirmDialog
      :open="batchPreview"
      title="确认批量重放开放死信？"
      description="系统将逐条调用既有受控重放事务；并发状态变化或已处理任务会安全失败，不会覆盖原任务。"
      :impact="batchImpact"
      confirm-label="确认批量重放"
      destructive
      confirmation-text="确认重放"
      @cancel="batchPreview = false"
      @confirm="confirmBatchReplay"
    />
  </section>
</template>
