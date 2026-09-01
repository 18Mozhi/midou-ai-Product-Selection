<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ApiClientError,
  createApiClient,
  createApiResponseClient,
  rethrowUnexpectedError,
} from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import "../report-center.css";
type ReportType = "opportunity" | "trend" | "team";
const props = defineProps<{ apiBaseUrl: string }>(),
  route = useRoute(),
  router = useRouter(),
  request = createApiClient(props.apiBaseUrl),
  requestResponse = createApiResponseClient(props.apiBaseUrl),
  type = ref<ReportType>(
    ["opportunity", "trend", "team"].includes(String(route.query.report))
      ? (route.query.report as ReportType)
      : "opportunity",
  ),
  state = ref("loading"),
  report = ref<any>(null),
  exports = ref<any[]>([]),
  selectedExport = ref<any>(null),
  notice = ref(""),
  requestId = ref(""),
  busy = ref(false),
  refreshing = ref(false),
  regeneratingId = ref(""),
  downloadingId = ref("");
let timer: number | undefined;
let loadSequence = 0;
const { dialogElement: detailDialogElement, handleCancel: handleDetailCancel } = useModalDialog(
  () => Boolean(selectedExport.value),
  closeDetail,
);
async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  affectPageState = true,
) {
  try {
    const response = await request<T>(path, options);
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    if (affectPageState)
      state.value = failure?.kind === "conflict" ? "blocked" : (failure?.kind ?? "error");
    notice.value = failure?.actionHint ?? "稍后重试。";
    throw error;
  }
}
async function load(background = false) {
  const sequence = ++loadSequence,
    selectedType = type.value;
  if (!background) state.value = "loading";
  try {
    const [nextReport, nextExports] = await Promise.all([
      api<any>(`/reports/${selectedType}`, {}, false),
      api<any[]>("/report-exports", {}, false),
    ]);
    if (sequence !== loadSequence || selectedType !== type.value) return;
    report.value = nextReport;
    exports.value = nextExports;
    await syncDetailFromRoute();
    state.value = report.value.summary.total || report.value.summary.members ? "ready" : "empty";
  } catch (error) {
    if (sequence !== loadSequence) return;
    const failure = error instanceof ApiClientError ? error : null;
    if (!background)
      state.value = failure?.kind === "conflict" ? "blocked" : (failure?.kind ?? "error");
    rethrowUnexpectedError(error);
  }
}
async function choose(v: ReportType) {
  if (type.value === v) return;
  await router.push({ query: { ...route.query, report: v === "opportunity" ? undefined : v } });
}
async function createExport() {
  busy.value = true;
  try {
    await api(
      "/report-exports",
      {
        method: "POST",
        body: { report_type: type.value, format: "csv" },
      },
      false,
    );
    notice.value = "导出任务已提交，由宝塔 Node Worker 异步生成。";
    await load();
  } catch (error) {
    rethrowUnexpectedError(error);
  } finally {
    busy.value = false;
  }
}
async function refresh() {
  refreshing.value = true;
  try {
    await load(true);
  } finally {
    refreshing.value = false;
  }
}
async function regenerate(item: any) {
  regeneratingId.value = item.id;
  try {
    const replacement = await api<any>(
      `/report-exports/${item.id}/regenerate`,
      { method: "POST" },
      false,
    );
    notice.value = `新的${labels[item.report_type as ReportType]}导出已进入队列。`;
    await load();
    await setDetailQuery(replacement.id, true);
  } catch (error) {
    rethrowUnexpectedError(error);
  } finally {
    regeneratingId.value = "";
  }
}
async function download(item: any) {
  if (downloadingId.value) return;
  downloadingId.value = item.id;
  try {
    const correlationId = crypto.randomUUID();
    requestId.value = correlationId;
    const r = await requestResponse(`/report-exports/${item.id}/download`, {
      requestId: correlationId,
      traceId: correlationId,
      headers: { accept: "application/octet-stream" },
    });
    const url = URL.createObjectURL(await r.blob()),
      a = document.createElement("a");
    a.href = url;
    a.download = item.filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    notice.value = failure?.actionHint ?? "下载连接失败，请稍后重试。";
  } finally {
    downloadingId.value = "";
  }
}
async function openDetail(item: any) {
  await setDetailQuery(item.id);
}
function closeDetail() {
  selectedExport.value = null;
  if (route.query.export) void setDetailQuery();
}
async function setDetailQuery(exportId?: string, replace = false) {
  const query = { ...route.query };
  if (exportId) query.export = exportId;
  else delete query.export;
  await (replace ? router.replace({ query }) : router.push({ query }));
}
async function syncDetailFromRoute() {
  const exportId = typeof route.query.export === "string" ? route.query.export : "";
  if (!exportId) {
    selectedExport.value = null;
    return;
  }
  try {
    selectedExport.value = await api<any>(`/report-exports/${exportId}`, {}, false);
  } catch (error) {
    if (error instanceof ApiClientError) {
      notice.value =
        error.status === 404 ? "链接中的导出记录不存在或不在当前工作区。" : error.actionHint;
      selectedExport.value = null;
      await setDetailQuery(undefined, true);
      return;
    }
    throw error;
  }
}
const labels: Record<ReportType, string> = {
    opportunity: "机会分析",
    trend: "趋势分析",
    team: "团队绩效",
  },
  metrics = computed(() => Object.entries(report.value?.summary ?? {})),
  conclusion = computed(() => {
    const summary = report.value?.summary;
    if (!summary) return "正在形成结论…";
    if (type.value === "opportunity")
      return `共 ${format(summary.total)} 个机会，已采纳 ${format(summary.adopted)} 个，证据完整 ${format(summary.complete_coverage)} 个。`;
    if (type.value === "trend")
      return `共 ${format(summary.total)} 个趋势主题，累计 ${format(summary.signals)} 条信号，平均置信度 ${format(summary.average_confidence)}。`;
    return `共 ${format(summary.members)} 名成员、${format(summary.total)} 项任务，已完成 ${format(summary.completed)} 项，逾期 ${format(summary.overdue)} 项。`;
  }),
  max = computed(() =>
    Math.max(1, ...(report.value?.series ?? []).map((x: any) => Number(x.value) || 0)),
  ),
  format = (v: any) =>
    v == null ? "数据不足" : typeof v === "number" ? v.toLocaleString("zh-CN") : String(v),
  metricLabel = (v: string) => {
    if (v === "total" && type.value === "team") return "任务总数";
    return (
      (
        {
          total: "总量",
          adopted: "已采纳",
          observing: "观察中",
          rejected: "已驳回",
          complete_coverage: "证据完整",
          average_score: "平均评分",
          signals: "信号数",
          sources: "来源数",
          average_momentum: "平均动量",
          average_confidence: "平均置信度",
          members: "成员数",
          completed: "已完成任务",
          overdue: "逾期任务",
        } as any
      )[v] ?? v
    );
  },
  seriesLabels: Record<string, string> = {
    recommend: "推荐",
    observe: "继续观察",
    not_recommend: "不推荐",
    insufficient_data: "数据不足",
    active: "活跃",
    stale: "观测过期",
    irrelevant: "无关",
  },
  seriesLabel = (value: unknown) =>
    type.value === "team" ? String(value) : (seriesLabels[String(value)] ?? "其他"),
  statusLabels: Record<string, string> = {
    queued: "排队中",
    leased: "生成中",
    retry_scheduled: "等待重试",
    succeeded: "可下载",
    dead_letter: "生成失败",
    expired: "已过期",
  },
  statusLabel = (value: unknown) => statusLabels[String(value)] ?? "状态待确认",
  queueEstimate = (item: any) => {
    if (item.queue_position == null) return "";
    if (!item.estimated_completion_at)
      return `队列第 ${item.queue_position} 位 · 暂无历史样本，无法估算完成时间`;
    return `队列第 ${item.queue_position} 位 · 预计 ${new Date(
      item.estimated_completion_at,
    ).toLocaleString("zh-CN", { hour12: false })} 完成`;
  },
  statusHint = (item: any) => {
    if (isExpired(item)) return "文件已过期，可重新生成";
    if (["queued", "leased", "retry_scheduled"].includes(item.status))
      return queueEstimate(item) || "系统正在异步处理";
    if (item.status === "dead_letter") return "自动重试已结束，可重新生成";
    return item.row_count == null ? "等待生成" : `${item.row_count} 行 · ${item.byte_size} 字节`;
  },
  isExpired = (item: any) =>
    item.status === "expired" || new Date(item.expires_at).valueOf() <= Date.now(),
  canRegenerate = (item: any) => isExpired(item) || item.status === "dead_letter";
onMounted(() => {
  void load();
  timer = window.setInterval(() => {
    if (exports.value.some((x) => ["queued", "leased", "retry_scheduled"].includes(x.status)))
      void load(true);
  }, 5000);
});
onUnmounted(() => clearInterval(timer));
watch(
  () => [route.query.report, route.query.export],
  ([value, exportId], [previousValue, previousExportId]) => {
    const next = ["opportunity", "trend", "team"].includes(String(value))
      ? (value as ReportType)
      : "opportunity";
    if (next !== type.value) {
      type.value = next;
      void load();
      return;
    }
    if (exportId !== previousExportId) void syncDetailFromRoute();
  },
);
</script>
<template>
  <section class="report-center">
    <header>
      <div>
        <p>分析与导出</p>
        <h2>报表与导出</h2>
        <span>所有指标都来自当前组织和工作区已落库事实；缺失值保持“数据不足”。</span>
      </div>
      <button :disabled="busy" @click="createExport">导出当前报表 CSV</button>
    </header>
    <nav aria-label="报表类型">
      <button
        v-for="v in ['opportunity', 'trend', 'team'] as ReportType[]"
        :key="v"
        :aria-pressed="type === v"
        @click="choose(v)"
      >
        {{ labels[v] }}
      </button>
    </nav>
    <div v-if="notice" class="report-notice" aria-live="polite">
      {{ notice }}
      <details v-if="requestId">
        <summary>技术详情</summary>
        <code>{{ requestId }}</code>
      </details>
    </div>
    <section v-if="state === 'loading'" class="report-state">正在聚合当前工作区事实…</section>
    <section
      v-else-if="['error', 'expired', 'forbidden', 'rate_limited', 'blocked'].includes(state)"
      class="report-state"
    >
      <h3>
        {{
          state === "expired"
            ? "登录已失效"
            : state === "forbidden"
              ? "无权读取报表"
              : state === "rate_limited"
                ? "请求过于频繁"
                : state === "blocked"
                  ? "报表服务暂不可用"
                  : "报表服务暂不可用"
        }}
      </h3>
      <p>{{ notice }}</p>
      <button @click="load()">重新加载</button>
    </section>
    <template v-else
      ><section class="report-conclusion" aria-live="polite">
        <span>{{ labels[type] }}结论摘要</span>
        <strong>{{ conclusion }}</strong>
      </section>
      <section class="report-scope" aria-label="报表统计口径">
        <div><span>统计范围</span><b>当前工作区全部已落库记录</b></div>
        <div>
          <span>数据截至</span
          ><b>{{
            report?.observed_at
              ? new Date(report.observed_at).toLocaleString("zh-CN", { hour12: false })
              : "数据不足"
          }}</b>
        </div>
        <div><span>缺失值</span><b>保持“数据不足”，不推测补齐</b></div>
      </section>
      <section class="report-metrics">
        <article v-for="[key, value] in metrics" :key="key">
          <span>{{ metricLabel(key) }}</span
          ><b>{{ format(value) }}</b>
        </article>
      </section>
      <section class="report-chart">
        <header>
          <div>
            <p>{{ labels[type] }}</p>
            <h3>当前分布</h3>
          </div>
          <small
            >观测时间
            {{
              report?.observed_at
                ? new Date(report.observed_at).toLocaleString("zh-CN", {
                    hour12: false,
                  })
                : "数据不足"
            }}</small
          >
        </header>
        <div v-if="report?.series?.length" class="report-bars">
          <article v-for="item in report.series" :key="item.label">
            <div>
              <span
                :style="{
                  height: `${Math.max(8, (Number(item.value) / max) * 100)}%`,
                }"
              ></span>
            </div>
            <b>{{ item.value }}</b
            ><small>{{ seriesLabel(item.label) }}</small>
          </article>
        </div>
        <div v-else class="report-empty">
          <h3>暂无可聚合记录</h3>
          <p>业务记录产生后，报表将按当前范围自动汇总。</p>
        </div>
      </section></template
    >
    <section class="report-exports">
      <header>
        <div>
          <p>导出生命周期</p>
          <h3>导出记录</h3>
        </div>
        <div class="report-export-links">
          <small>文件到期后由 Worker 清理</small>
          <button class="secondary" :disabled="refreshing" @click="refresh">
            {{ refreshing ? "正在刷新…" : "刷新状态" }}
          </button>
          <RouterLink to="/tasks?view=exports">在任务中心查看</RouterLink>
        </div>
      </header>
      <div v-if="exports.length" class="report-export-list">
        <article v-for="item in exports" :key="item.id">
          <i :data-status="isExpired(item) ? 'expired' : item.status">{{
            isExpired(item) ? "已过期" : statusLabel(item.status)
          }}</i>
          <div>
            <b>{{ labels[item.report_type as ReportType] }} · CSV</b
            ><small>{{ statusHint(item) }}</small
            ><small class="report-export-expiry"
              >有效期至
              {{
                new Date(item.expires_at).toLocaleString("zh-CN", {
                  hour12: false,
                })
              }}</small
            >
          </div>
          <button
            v-if="item.status === 'succeeded' && !isExpired(item)"
            :disabled="downloadingId === item.id"
            @click="download(item)"
          >
            {{ downloadingId === item.id ? "正在下载…" : "下载" }}</button
          ><button
            v-else-if="canRegenerate(item)"
            :disabled="regeneratingId === item.id"
            @click="regenerate(item)"
          >
            {{ regeneratingId === item.id ? "正在提交…" : "重新生成" }}
          </button>
          <span v-else>{{ statusLabel(item.status) }}</span
          ><button class="secondary" @click="openDetail(item)">查看详情</button>
        </article>
      </div>
      <div v-else class="report-empty">尚无导出任务。</div>
    </section>
    <dialog
      v-if="selectedExport"
      ref="detailDialogElement"
      class="report-detail"
      :aria-label="`${labels[selectedExport.report_type as ReportType]}导出详情`"
      @cancel="handleDetailCancel"
    >
      <button aria-label="关闭导出详情" @click="closeDetail">×</button>
      <p>导出详情</p>
      <h3>{{ labels[selectedExport.report_type as ReportType] }}</h3>
      <dl>
        <div>
          <dt>状态</dt>
          <dd>
            {{ isExpired(selectedExport) ? "已过期" : statusLabel(selectedExport.status) }}
          </dd>
        </div>
        <div>
          <dt>数据行数</dt>
          <dd>{{ selectedExport.row_count ?? "等待生成" }}</dd>
        </div>
        <div>
          <dt>文件大小</dt>
          <dd>
            {{ selectedExport.byte_size == null ? "等待生成" : `${selectedExport.byte_size} 字节` }}
          </dd>
        </div>
        <div v-if="selectedExport.queue_position != null">
          <dt>队列位置</dt>
          <dd>第 {{ selectedExport.queue_position }} 位</dd>
        </div>
        <div v-if="selectedExport.queue_position != null">
          <dt>预计完成</dt>
          <dd>
            {{
              selectedExport.estimated_completion_at
                ? new Date(selectedExport.estimated_completion_at).toLocaleString("zh-CN", {
                    hour12: false,
                  })
                : "暂无历史样本，暂无法估算"
            }}
          </dd>
        </div>
        <div v-if="selectedExport.queue_position != null">
          <dt>估算依据</dt>
          <dd>
            {{
              selectedExport.estimate_sample_size
                ? `全局最近 ${selectedExport.estimate_sample_size} 次成功导出的中位完成耗时`
                : "尚无成功导出样本"
            }}
          </dd>
        </div>
        <div>
          <dt>文件有效期</dt>
          <dd>
            {{
              new Date(selectedExport.expires_at).toLocaleString("zh-CN", {
                hour12: false,
              })
            }}
          </dd>
        </div>
      </dl>
      <button
        v-if="canRegenerate(selectedExport)"
        :disabled="regeneratingId === selectedExport.id"
        @click="regenerate(selectedExport)"
      >
        {{ regeneratingId === selectedExport.id ? "正在提交…" : "重新生成" }}
      </button>
      <details v-if="selectedExport.last_error_code">
        <summary>技术详情</summary>
        <code>{{ selectedExport.last_error_code }}</code>
      </details>
    </dialog>
  </section>
</template>
