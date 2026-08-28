<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import "../collection-tasks.css";
import "../collection-task-detail.css";

type ViewState = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Task {
  id: string;
  organization_id: string;
  workspace_id: string;
  request_id: string;
  status: string;
  coverage_status: string | null;
  priority: string;
  attempt_count: number;
  available_at: string;
  successful_subquery_count: number;
  failed_subquery_count: number;
  blocked_subquery_count: number;
  available_result_count: number;
  missing_fields: string[];
  last_error_code: string | null;
  updated_at: string;
}
interface Detail {
  task: Task;
  subqueries: Array<{
    id: string;
    provider_name: string;
    is_required: boolean;
    status: string;
    available_result_count: number;
    missing_fields: string[];
    error_code: string | null;
    result_kind: "empty_success" | "no_new_content" | "parse_failed" | null;
    robots_decision: {
      decision_version: string;
      allowed: boolean;
      decision_basis: string;
      robots_url: string;
      robots_http_status: number;
      matched_user_agent: string | null;
      matched_rule: {
        directive: "allow" | "disallow";
        pattern_preview: string;
        pattern_sha256: string;
        truncated: boolean;
      } | null;
    } | null;
    retryable: boolean;
    started_at: string | null;
    finished_at: string | null;
  }>;
  attempts: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  dead_letter: Record<string, unknown> | null;
}

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const route = useRoute(),
  router = useRouter(),
  pageSize = 50,
  requestTimeoutMs = 15_000,
  taskStatuses = [
    "draft",
    "scheduled",
    "queued",
    "leased",
    "running",
    "parsing",
    "validating",
    "persisted",
    "retry_scheduled",
    "rate_limited",
    "blocked_login",
    "blocked_captcha",
    "blocked_robots",
    "succeeded",
    "succeeded_empty",
    "completed_with_warnings",
    "failed_terminal",
    "dead_letter",
    "manually_replayed",
  ] as const;
const state = ref<ViewState>("loading"),
  tasks = ref<Task[]>([]),
  detail = ref<Detail | null>(null),
  requestId = ref(""),
  status = ref("all"),
  query = ref(""),
  page = ref(1),
  total = ref(0),
  listLoading = ref(false),
  listIssue = ref(""),
  detailLoading = ref(false),
  detailIssue = ref(""),
  replayIssue = ref(""),
  confirming = ref(false),
  replayReason = ref(""),
  notice = ref(""),
  saving = ref(false),
  detailPanel = ref<HTMLElement | null>(null),
  detailCloseButton = ref<HTMLButtonElement | null>(null);
let listController: AbortController | null = null,
  detailController: AbortController | null = null,
  detailSequence = 0,
  detailOpenedFromList = false,
  returnFocus: HTMLElement | null = null;
const filtered = computed(() =>
  tasks.value.filter(
    (item) =>
      !query.value ||
      [item.id, item.organization_id, item.workspace_id, item.last_error_code].some((value) =>
        value?.toLowerCase().includes(query.value.toLowerCase()),
      ),
  ),
);
const metrics = computed(() => ({
  active: tasks.value.filter((item) =>
    [
      "scheduled",
      "queued",
      "leased",
      "running",
      "parsing",
      "validating",
      "persisted",
      "retry_scheduled",
      "rate_limited",
    ].includes(item.status),
  ).length,
  warnings: tasks.value.filter((item) => item.status === "completed_with_warnings").length,
  blocked: tasks.value.filter(
    (item) =>
      item.status.startsWith("blocked_") ||
      item.status === "dead_letter" ||
      item.status === "failed_terminal",
  ).length,
  evidence: tasks.value.reduce((sum, item) => sum + item.available_result_count, 0),
}));
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize))),
  pageStart = computed(() => (total.value ? (page.value - 1) * pageSize + 1 : 0)),
  pageEnd = computed(() => Math.min(page.value * pageSize, total.value)),
  detailOpen = computed(
    () => detailLoading.value || Boolean(detail.value) || Boolean(detailIssue.value),
  );
const failure = (code: number): ViewState =>
  code === 401
    ? "expired"
    : code === 403
      ? "forbidden"
      : [408, 425, 429, 502, 503, 504].includes(code)
        ? "blocked"
        : "error";
const time = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const cell = (value: unknown) =>
  value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
const label = (value: string | null) =>
  value
    ? ({
        scheduled: "待调度",
        queued: "已排队",
        leased: "已租约",
        running: "执行中",
        parsing: "解析中",
        validating: "校验中",
        persisted: "已持久化",
        retry_scheduled: "等待重试",
        blocked_login: "登录受阻",
        blocked_captcha: "验证码受阻",
        blocked_robots: "网站规则限制",
        rate_limited: "限流等待",
        succeeded: "成功",
        succeeded_empty: "无可用结果",
        completed_with_warnings: "部分完成",
        failed_terminal: "终止失败",
        dead_letter: "死信",
        manually_replayed: "已人工重放",
        automatically_replayed: "凭证续期后已自动重放",
        complete: "完整",
        partial: "部分",
        insufficient: "不足",
      }[value] ?? value)
    : "待计算";
const subqueryRetryText = (task: Task, retryable: boolean) => {
  if (!retryable) return "该错误不自动重试";
  if (!["retry_scheduled", "rate_limited"].includes(task.status)) return "尚未安排下次重试";
  return `下次重试 ${time(task.available_at)}（任务级调度）`;
};
const resultKindText = (value: Detail["subqueries"][number]["result_kind"]) =>
  value === "empty_success"
    ? "空成功：来源响应有效，但没有可解析条目"
    : value === "no_new_content"
      ? "无新内容：本次结果均已存在，未重复写入"
      : value === "parse_failed"
        ? "解析失败：来源载荷未通过当前解析合同"
        : "";
const robotsDecisionText = (value: NonNullable<Detail["subqueries"][number]["robots_decision"]>) =>
  value.matched_rule
    ? `${value.allowed ? "允许" : "禁止"} · ${value.matched_rule.directive === "allow" ? "Allow" : "Disallow"} ${value.matched_rule.pattern_preview}${value.matched_rule.truncated ? "…" : ""}`
    : value.decision_basis === "missing_robots"
      ? "允许 · 来源未提供 robots.txt"
      : value.decision_basis === "http_status"
        ? `禁止 · robots.txt 返回 HTTP ${value.robots_http_status}`
        : "允许 · 没有命中限制规则";
const subqueryDurationText = (startedAt: string | null, finishedAt: string | null) => {
  if (!startedAt) return "尚未开始";
  if (!finishedAt) return `执行中 · ${time(startedAt)} 开始`;
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) return "耗时不可用";
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `耗时 ${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `耗时 ${minutes} 分 ${remainingSeconds} 秒`;
};
const recoveryAction = computed(() => {
  const task = detail.value?.task;
  if (!task) return null;
  if (task.status === "dead_letter")
    return {
      kind: "replay" as const,
      label: "填写原因并重放",
      description: "确认来源恢复后创建新任务；原任务和全部尝试记录保留。",
    };
  if (["blocked_login", "blocked_captcha"].includes(task.status))
    return {
      kind: "link" as const,
      to: "/platform-admin/credentials",
      label: "检查网页登录",
      description: "更新或验证受控浏览器档案后，再回到任务查看恢复结果。",
    };
  if (task.status === "blocked_robots" || task.last_error_code === "source_changed")
    return {
      kind: "link" as const,
      to: "/platform-admin/providers/sources",
      label: "检查来源设置",
      description: "核对来源规则、页面变化和当前启用状态。",
    };
  if (["failed_terminal", "completed_with_warnings"].includes(task.status))
    return {
      kind: "link" as const,
      to: "/platform-admin/collection/overview",
      label: "查看根因与来源健康",
      description: "按真实错误根因继续下钻，不覆盖当前失败记录。",
    };
  return null;
});
const timeoutController = (kind: "list" | "detail") => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort("request_timeout"), requestTimeoutMs);
  if (kind === "list") listController = controller;
  else detailController = controller;
  return { controller, stop: () => window.clearTimeout(timer) };
};
const syncListQuery = () => {
  const queryParams = { ...route.query };
  if (page.value > 1) queryParams.page = String(page.value);
  else delete queryParams.page;
  if (status.value !== "all") queryParams.status = status.value;
  else delete queryParams.status;
  void router.replace({ query: queryParams });
};
async function load(options: { preserve?: boolean } = {}) {
  if (listLoading.value) return;
  listLoading.value = true;
  listIssue.value = "";
  if (!options.preserve || !tasks.value.length) state.value = "loading";
  const params = new URLSearchParams({
    page: String(page.value),
    page_size: String(pageSize),
  });
  if (status.value !== "all") params.set("status", status.value);
  listController?.abort("superseded");
  const timeout = timeoutController("list");
  try {
    const response = await request<Task[]>(`/platform/collection/tasks?${params}`, {
      signal: timeout.controller.signal,
    });
    requestId.value = response.request_id;
    tasks.value = response.data ?? [];
    total.value = (response.meta as { total?: number } | undefined)?.total ?? tasks.value.length;
    if (!tasks.value.length && total.value > 0 && page.value > 1) {
      page.value = Math.min(page.value - 1, Math.ceil(total.value / pageSize));
      syncListQuery();
      listLoading.value = false;
      timeout.stop();
      await load();
      return;
    }
    state.value = tasks.value.length ? "ready" : "empty";
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? "";
    const message = timeout.controller.signal.aborted
      ? "任务列表读取超过 15 秒，已停止等待；当前页面数据未被覆盖。"
      : apiError?.actionHint || "任务列表暂不可用，请稍后重试。";
    if (tasks.value.length && options.preserve) {
      state.value = "ready";
      listIssue.value = message;
    } else state.value = apiError ? failure(apiError.status) : "blocked";
  } finally {
    timeout.stop();
    if (listController === timeout.controller) listController = null;
    listLoading.value = false;
  }
}
async function openTask(id: string, options: { updateUrl?: boolean } = {}) {
  if (options.updateUrl) {
    const active = document.activeElement;
    returnFocus = active instanceof HTMLElement ? active : null;
    detailOpenedFromList = true;
    await router.push({ query: { ...route.query, task: id } });
    return;
  }
  const sequence = ++detailSequence;
  detailController?.abort("superseded");
  detail.value = null;
  detailIssue.value = "";
  detailLoading.value = true;
  const timeout = timeoutController("detail");
  try {
    const response = await request<Detail>(`/platform/collection/tasks/${id}`, {
      signal: timeout.controller.signal,
    });
    if (sequence !== detailSequence) return;
    requestId.value = response.request_id;
    detail.value = response.data;
  } catch (error) {
    if (sequence !== detailSequence) return;
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? requestId.value;
    detailIssue.value = timeout.controller.signal.aborted
      ? "任务详情读取超过 15 秒，已停止等待。"
      : apiError?.actionHint || "任务详情依赖暂不可用。";
  } finally {
    timeout.stop();
    if (detailController === timeout.controller) detailController = null;
    if (sequence === detailSequence) {
      detailLoading.value = false;
      await nextTick();
      detailCloseButton.value?.focus();
    }
  }
}
async function replay() {
  if (!detail.value || saving.value) return;
  saving.value = true;
  confirming.value = false;
  replayIssue.value = "";
  try {
    const response = await request<Detail>(
      `/platform/collection/tasks/${detail.value.task.id}/replay`,
      { method: "POST", body: { reason: replayReason.value.trim() } },
    );
    requestId.value = response.request_id;
    const successNotice = `已创建重放任务 ${response.data.task.id.slice(0, 8)}…，原任务与全部尝试记录已保留。`;
    detail.value = response.data;
    replayReason.value = "";
    await router.replace({ query: { ...route.query, task: response.data.task.id } });
    await load({ preserve: true });
    notice.value = successNotice;
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? requestId.value;
    replayIssue.value = apiError?.actionHint ?? "依赖不可用，未执行重放。";
  } finally {
    saving.value = false;
  }
}
function closeDetail() {
  detailController?.abort("closed");
  detailSequence += 1;
  detail.value = null;
  detailIssue.value = "";
  detailLoading.value = false;
  replayReason.value = "";
  replayIssue.value = "";
  if (detailOpenedFromList && route.query.task) {
    detailOpenedFromList = false;
    router.back();
  } else {
    const queryParams = { ...route.query };
    delete queryParams.task;
    void router.replace({ query: queryParams });
  }
  void nextTick(() => returnFocus?.focus());
}
function detailKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeDetail();
    return;
  }
  if (event.key !== "Tab" || !detailPanel.value) return;
  const focusable = [
    ...detailPanel.value.querySelectorAll<HTMLElement>(
      "a[href],button:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex='-1'])",
    ),
  ];
  const first = focusable[0],
    last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
async function changeStatus() {
  page.value = 1;
  query.value = "";
  syncListQuery();
  await load();
}
async function changePage(nextPage: number) {
  if (listLoading.value || nextPage < 1 || nextPage > totalPages.value) return;
  page.value = nextPage;
  query.value = "";
  syncListQuery();
  await load();
  document.querySelector(".collection-task-table-card")?.scrollIntoView({ behavior: "smooth" });
}
watch(
  () => route.query.task,
  async (value) => {
    const taskId = typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : "";
    if (!taskId) {
      detail.value = null;
      detailIssue.value = "";
      detailLoading.value = false;
      await nextTick();
      returnFocus?.focus();
      return;
    }
    await openTask(taskId);
  },
);
watch(detailOpen, async (open) => {
  document.body.classList.toggle("collection-detail-open", open);
  if (!open) return;
  await nextTick();
  detailCloseButton.value?.focus();
});
onMounted(async () => {
  const initialStatus = typeof route.query.status === "string" ? route.query.status : "";
  status.value = taskStatuses.includes(initialStatus as (typeof taskStatuses)[number])
    ? initialStatus
    : "all";
  const initialPage = Number(route.query.page);
  page.value = Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1;
  await load();
  const taskId = typeof route.query.task === "string" ? route.query.task : "";
  if (taskId && /^[0-9a-f-]{36}$/i.test(taskId)) await openTask(taskId);
});
onBeforeUnmount(() => {
  listController?.abort("unmounted");
  detailController?.abort("unmounted");
  document.body.classList.remove("collection-detail-open");
});
</script>

<template>
  <section class="collection-task-center" aria-labelledby="collection-task-title">
    <header class="collection-task-title">
      <div>
        <p>平台采集任务中心</p>
        <h2 id="collection-task-title">采集任务监控</h2>
        <span>集中查看任务进度、来源覆盖、失败原因和重试记录；每个任务都可以展开详情。</span>
      </div>
      <div class="collection-task-title-actions">
        <button type="button" :disabled="listLoading" @click="load({ preserve: true })">
          {{ listLoading ? "正在刷新…" : "刷新任务" }}
        </button>
        <RouterLink to="/platform-admin/collection/browser-runtime">浏览器运行时</RouterLink>
      </div>
    </header>
    <UiStatePanel
      v-if="state !== 'ready'"
      :kind="state"
      :request-id="requestId"
      @primary="() => load()"
    />
    <template v-else>
      <div v-if="listIssue" class="collection-inline-issue" role="alert">
        <span>{{ listIssue }}</span
        ><button type="button" :disabled="listLoading" @click="load({ preserve: true })">
          重新读取
        </button>
      </div>
      <div class="collection-task-metrics">
        <article>
          <small>处理中</small><strong>{{ metrics.active }}</strong
          ><span>排队、执行与重试</span>
        </article>
        <article>
          <small>部分完成</small><strong>{{ metrics.warnings }}</strong
          ><span>仍有可用证据</span>
        </article>
        <article>
          <small>受阻 / 死信</small><strong>{{ metrics.blocked }}</strong
          ><span>不会绕过来源限制</span>
        </article>
        <article>
          <small>可用结果</small><strong>{{ metrics.evidence }}</strong
          ><span>当前页合计</span>
        </article>
      </div>
      <section class="collection-task-table-card">
        <header>
          <div>
            <h3>任务队列</h3>
            <span aria-live="polite">{{
              notice ||
              `共 ${total} 个任务 · 当前显示 ${pageStart}–${pageEnd}；覆盖不足不会自动给出推荐结论。`
            }}</span>
          </div>
          <div class="collection-task-filters">
            <input
              v-model="query"
              aria-label="筛选当前页采集任务"
              placeholder="筛选当前页：任务 ID / 组织 ID / 工作区 ID / 错误码"
            /><select v-model="status" aria-label="采集任务状态" @change="changeStatus">
              <option value="all">全部状态</option>
              <optgroup label="准备与执行">
                <option value="draft">草稿</option>
                <option value="scheduled">待调度</option>
                <option value="queued">已排队</option>
                <option value="leased">已租约</option>
                <option value="running">执行中</option>
                <option value="parsing">解析中</option>
                <option value="validating">校验中</option>
                <option value="persisted">已持久化</option>
              </optgroup>
              <optgroup label="等待与受阻">
                <option value="retry_scheduled">等待重试</option>
                <option value="rate_limited">限流等待</option>
                <option value="blocked_login">登录受阻</option>
                <option value="blocked_captcha">验证码受阻</option>
                <option value="blocked_robots">网站规则限制</option>
              </optgroup>
              <optgroup label="完成与终止">
                <option value="succeeded">成功</option>
                <option value="succeeded_empty">无可用结果</option>
                <option value="completed_with_warnings">部分完成</option>
                <option value="failed_terminal">终止失败</option>
                <option value="dead_letter">死信</option>
                <option value="manually_replayed">已人工重放</option>
              </optgroup>
            </select>
          </div>
        </header>
        <ResponsiveDataView
          :rows="filtered"
          :row-key="(item) => item.id"
          title="采集任务队列"
          :detail-title="(item) => `${label(item.status)} · ${time(item.updated_at)}`"
        >
          <template #desktop>
            <table>
              <thead>
                <tr>
                  <th>任务</th>
                  <th>范围</th>
                  <th>状态 / 覆盖</th>
                  <th>子查询</th>
                  <th>证据</th>
                  <th>更新时间</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filtered" :key="item.id">
                  <td>
                    <strong>采集任务</strong
                    ><small>{{ item.priority }} · 第 {{ item.attempt_count }} 次</small>
                  </td>
                  <td><span>已绑定组织与工作区</span></td>
                  <td>
                    <b :data-status="item.status">{{ label(item.status) }}</b
                    ><small>{{ label(item.coverage_status) }}</small>
                  </td>
                  <td>
                    {{ item.successful_subquery_count }} 成功<small
                      >{{ item.failed_subquery_count }} 失败 ·
                      {{ item.blocked_subquery_count }} 受阻</small
                    >
                  </td>
                  <td>
                    {{ item.available_result_count }} 条<small>{{
                      item.missing_fields.length
                        ? `缺 ${item.missing_fields.join("、")}`
                        : "字段完整"
                    }}</small>
                  </td>
                  <td>
                    {{ time(item.updated_at) }}<small>{{ item.last_error_code || "无错误" }}</small>
                  </td>
                  <td>
                    <button type="button" @click="openTask(item.id, { updateUrl: true })">
                      查看
                    </button>
                  </td>
                </tr>
                <tr v-if="!filtered.length">
                  <td colspan="7">当前筛选没有任务记录。</td>
                </tr>
              </tbody>
            </table>
          </template>
          <template #summary="{ row }">
            <span class="responsive-record-summary">
              <strong>{{ label(row.status) }} · {{ row.available_result_count }} 条证据</strong>
              <small>{{ label(row.coverage_status) }} · {{ time(row.updated_at) }}</small>
            </span>
          </template>
          <template #detail="{ row, close }">
            <dl>
              <div>
                <dt>状态 / 覆盖</dt>
                <dd>{{ label(row.status) }} · {{ label(row.coverage_status) }}</dd>
              </div>
              <div>
                <dt>子查询</dt>
                <dd>
                  {{ row.successful_subquery_count }} 成功 · {{ row.failed_subquery_count }} 失败 ·
                  {{ row.blocked_subquery_count }} 受阻
                </dd>
              </div>
              <div>
                <dt>可用证据</dt>
                <dd>{{ row.available_result_count }} 条</dd>
              </div>
              <div>
                <dt>缺失字段</dt>
                <dd>
                  {{ row.missing_fields.length ? row.missing_fields.join("、") : "字段完整" }}
                </dd>
              </div>
              <div>
                <dt>更新时间</dt>
                <dd>{{ time(row.updated_at) }}</dd>
              </div>
            </dl>
            <button
              type="button"
              @click="
                close();
                openTask(row.id, { updateUrl: true });
              "
            >
              打开完整任务详情
            </button>
            <details>
              <summary>技术详情</summary>
              <dl>
                <div>
                  <dt>任务 ID</dt>
                  <dd>{{ row.id }}</dd>
                </div>
                <div>
                  <dt>组织 ID</dt>
                  <dd>{{ row.organization_id }}</dd>
                </div>
                <div>
                  <dt>工作区 ID</dt>
                  <dd>{{ row.workspace_id }}</dd>
                </div>
                <div>
                  <dt>错误码</dt>
                  <dd>{{ row.last_error_code || "—" }}</dd>
                </div>
                <div>
                  <dt>请求 ID</dt>
                  <dd>{{ row.request_id }}</dd>
                </div>
              </dl>
            </details>
          </template>
        </ResponsiveDataView>
        <nav v-if="totalPages > 1" class="collection-pagination" aria-label="采集任务分页">
          <button type="button" :disabled="page <= 1 || listLoading" @click="changePage(page - 1)">
            上一页
          </button>
          <span>第 {{ page }} / {{ totalPages }} 页 · 本页 {{ tasks.length }} 条</span>
          <button
            type="button"
            :disabled="page >= totalPages || listLoading"
            @click="changePage(page + 1)"
          >
            下一页
          </button>
        </nav>
      </section>
      <div v-if="detailOpen" class="collection-task-detail-backdrop" @mousedown.self="closeDetail">
        <aside
          ref="detailPanel"
          class="collection-task-detail"
          role="dialog"
          aria-modal="true"
          aria-labelledby="collection-detail-title"
          aria-describedby="collection-detail-description"
          aria-live="polite"
          @keydown="detailKeydown"
        >
          <div v-if="detailLoading" class="collection-detail-state">
            <span class="collection-detail-spinner" aria-hidden="true"></span>
            <strong>正在读取任务详情…</strong>
            <small>超过 15 秒会自动停止等待，不会显示上一条任务的数据。</small>
          </div>
          <div v-else-if="detailIssue" class="collection-detail-state" role="alert">
            <strong>任务详情未能读取</strong>
            <span>{{ detailIssue }}</span>
            <div>
              <button type="button" @click="openTask(String(route.query.task || ''))">重试</button>
              <button type="button" @click="closeDetail">关闭</button>
            </div>
          </div>
          <template v-else-if="detail"
            ><header>
              <div>
                <p>采集任务详情</p>
                <h3 id="collection-detail-title">任务 {{ detail.task.id.slice(0, 8) }}…</h3>
                <span id="collection-detail-description"
                  >{{ label(detail.task.status) }} · 更新于 {{ time(detail.task.updated_at) }}</span
                >
              </div>
              <button
                ref="detailCloseButton"
                type="button"
                aria-label="关闭任务详情"
                title="关闭任务详情"
                @click="closeDetail"
              >
                ×
              </button>
            </header>
            <div class="collection-detail-summary">
              <article>
                <small>状态</small><strong>{{ label(detail.task.status) }}</strong>
              </article>
              <article>
                <small>覆盖</small><strong>{{ label(detail.task.coverage_status) }}</strong>
              </article>
              <article>
                <small>尝试</small><strong>{{ detail.attempts.length }}</strong>
              </article>
              <article>
                <small>事件</small><strong>{{ detail.events.length }}</strong>
              </article>
            </div>
            <section v-if="recoveryAction" class="collection-recovery" aria-label="建议恢复动作">
              <div>
                <small>下一步</small>
                <strong>{{ recoveryAction.label }}</strong>
                <span>{{ recoveryAction.description }}</span>
              </div>
              <a v-if="recoveryAction.kind === 'replay'" href="#collection-replay">进入重放</a>
              <RouterLink v-else :to="recoveryAction.to">{{ recoveryAction.label }}</RouterLink>
            </section>
            <section>
              <h4>子查询覆盖</h4>
              <article v-for="item in detail.subqueries" :key="item.id" class="collection-subquery">
                <div>
                  <strong>{{ item.provider_name }}</strong
                  ><small>{{ item.is_required ? "必需来源" : "可选来源" }}</small>
                </div>
                <b :data-status="item.status">{{ label(item.status) }}</b
                ><span class="collection-subquery-result"
                  >结果 {{ item.available_result_count }} 条 ·
                  {{ subqueryDurationText(item.started_at, item.finished_at) }} ·
                  {{ item.error_code || "无错误" }}</span
                ><small class="collection-subquery-missing">{{
                  item.missing_fields.length
                    ? `缺失 ${item.missing_fields.join("、")}`
                    : "无缺失字段"
                }}</small
                ><small v-if="item.result_kind" class="collection-subquery-kind">{{
                  resultKindText(item.result_kind)
                }}</small>
                <details v-if="item.robots_decision" class="collection-subquery-policy">
                  <summary>robots 判定：{{ robotsDecisionText(item.robots_decision) }}</summary>
                  <small
                    >判定版本 {{ item.robots_decision.decision_version }} · User-agent
                    {{ item.robots_decision.matched_user_agent || "未命中分组" }}</small
                  >
                </details>
                <small class="collection-subquery-retry">{{
                  subqueryRetryText(detail.task, item.retryable)
                }}</small>
              </article>
            </section>
            <section class="collection-detail-history">
              <h4>执行尝试</h4>
              <div v-if="!detail.attempts.length" class="collection-detail-empty">
                尚无执行尝试。
              </div>
              <article v-for="(item, index) in detail.attempts" :key="cell(item.id) || index">
                <strong
                  >第 {{ cell(item.attempt_number) || index + 1 }} 次 ·
                  {{ label(cell(item.status)) }}</strong
                ><span
                  >执行器 {{ cell(item.worker_id || item.lease_owner) }} · 开始
                  {{ cell(item.started_at) }} · 完成 {{ cell(item.finished_at) }}</span
                ><small>{{ cell(item.error_code || "无错误") }}</small>
              </article>
            </section>
            <section class="collection-detail-history">
              <h4>状态事件</h4>
              <div v-if="!detail.events.length" class="collection-detail-empty">尚无状态事件。</div>
              <article v-for="(item, index) in detail.events" :key="cell(item.id) || index">
                <strong
                  >{{ cell(item.event_type) }} · {{ label(cell(item.from_status)) }} →
                  {{ label(cell(item.to_status)) }}</strong
                ><span
                  >{{ cell(item.actor_type) }} · {{ cell(item.actor_id) }} ·
                  {{ cell(item.occurred_at) }}</span
                >
              </article>
            </section>
            <section class="collection-detail-history">
              <h4>死信记录</h4>
              <div v-if="!detail.dead_letter" class="collection-detail-empty">
                该任务没有死信记录。
              </div>
              <article v-else>
                <strong>{{
                  cell(detail.dead_letter.error_code || detail.dead_letter.status)
                }}</strong
                ><span
                  >进入死信：{{
                    cell(detail.dead_letter.created_at || detail.dead_letter.updated_at)
                  }}</span
                ><small>状态：{{ label(cell(detail.dead_letter.status)) }}</small
                ><small v-if="detail.dead_letter.replay_reason"
                  >重放原因：{{ cell(detail.dead_letter.replay_reason) }}</small
                >
              </article>
            </section>
            <details class="collection-technical-details">
              <summary>技术标识与关联信息</summary>
              <dl>
                <div>
                  <dt>任务 ID</dt>
                  <dd>{{ detail.task.id }}</dd>
                </div>
                <div>
                  <dt>组织 ID</dt>
                  <dd>{{ detail.task.organization_id }}</dd>
                </div>
                <div>
                  <dt>工作区 ID</dt>
                  <dd>{{ detail.task.workspace_id }}</dd>
                </div>
                <div>
                  <dt>请求 ID</dt>
                  <dd>{{ detail.task.request_id }}</dd>
                </div>
                <div>
                  <dt>错误码</dt>
                  <dd>{{ detail.task.last_error_code || "—" }}</dd>
                </div>
              </dl>
            </details>
            <footer v-if="detail.task.status === 'dead_letter'" id="collection-replay">
              <div v-if="replayIssue" class="collection-replay-issue" role="alert">
                {{ replayIssue }}
              </div>
              <label
                >人工重放原因<textarea
                  v-model="replayReason"
                  rows="3"
                  maxlength="500"
                  required
                  aria-describedby="collection-replay-help"
                  placeholder="说明恢复条件和重放原因（2–500 字）"
                ></textarea></label
              ><small id="collection-replay-help"
                >仅在确认依赖恢复后提交；已输入 {{ replayReason.trim().length }} / 500 字。</small
              ><button
                type="button"
                :disabled="replayReason.trim().length < 2 || saving"
                @click="confirming = true"
              >
                {{ saving ? "正在创建重放任务…" : "人工重放" }}
              </button>
            </footer></template
          >
        </aside>
      </div>
    </template>
    <ConfirmDialog
      :open="confirming"
      title="重放这个死信任务？"
      description="将复制原任务的内部子查询，创建一个新的 scheduled 任务；原任务改为 manually_replayed。"
      impact="原任务、全部尝试、死信与审计事件都会保留，不会覆盖历史结果。"
      confirm-label="确认重放"
      confirmation-text="确认重放"
      @cancel="confirming = false"
      @confirm="replay"
    />
  </section>
</template>
