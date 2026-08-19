<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import "../report-center.css";
type ReportType = "opportunity" | "trend" | "team";
const props = defineProps<{ apiBaseUrl: string }>(),
  type = ref<ReportType>("opportunity"),
  state = ref("loading"),
  report = ref<any>(null),
  exports = ref<any[]>([]),
  selectedExport = ref<any>(null),
  notice = ref(""),
  requestId = ref(""),
  busy = ref(false);
let timer: number | undefined;
async function api(path: string, init?: RequestInit) {
  const r = await fetch(`${props.apiBaseUrl}${path}`, {
      credentials: "include",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(init?.method && init.method !== "GET"
          ? { "idempotency-key": crypto.randomUUID() }
          : {}),
        ...(init?.headers ?? {}),
      },
      ...init,
    }),
    b = await r.json().catch(() => null);
  requestId.value = b?.request_id ?? "";
  if (!r.ok) {
    state.value =
      r.status === 401
        ? "expired"
        : r.status === 403
          ? "forbidden"
          : r.status === 429
            ? "rate_limited"
            : r.status === 409
              ? "blocked"
              : "error";
    notice.value = b?.error?.action_hint ?? "稍后重试。";
    throw new Error("request_failed");
  }
  return b.data;
}
async function load() {
  state.value = "loading";
  try {
    [report.value, exports.value] = await Promise.all([
      api(`/reports/${type.value}`),
      api("/report-exports"),
    ]);
    state.value =
      report.value.summary.total || report.value.summary.members
        ? "ready"
        : "empty";
  } catch {}
}
async function choose(v: ReportType) {
  type.value = v;
  await load();
}
async function createExport() {
  busy.value = true;
  try {
    await api("/report-exports", {
      method: "POST",
      body: JSON.stringify({ report_type: type.value, format: "csv" }),
    });
    notice.value = "导出任务已提交，由宝塔 Node Worker 异步生成。";
    await load();
  } catch {
  } finally {
    busy.value = false;
  }
}
async function download(item: any) {
  try {
    const r = await fetch(
      `${props.apiBaseUrl}/report-exports/${item.id}/download`,
      { credentials: "include" },
    );
    if (!r.ok) {
      const b = await r.json().catch(() => null);
      notice.value = b?.error?.action_hint ?? "下载暂不可用。";
      return;
    }
    const url = URL.createObjectURL(await r.blob()),
      a = document.createElement("a");
    a.href = url;
    a.download = item.filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    notice.value = "下载连接失败，请稍后重试。";
  }
}
const labels: Record<ReportType, string> = {
    opportunity: "机会分析",
    trend: "趋势分析",
    team: "团队绩效",
  },
  metrics = computed(() => Object.entries(report.value?.summary ?? {})),
  max = computed(() =>
    Math.max(
      1,
      ...(report.value?.series ?? []).map((x: any) => Number(x.value) || 0),
    ),
  ),
  format = (v: any) =>
    v == null
      ? "数据不足"
      : typeof v === "number"
        ? v.toLocaleString("zh-CN")
        : String(v),
  metricLabel = (v: string) =>
    (
      ({
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
      }) as any
    )[v] ?? v;
onMounted(() => {
  void load();
  timer = window.setInterval(() => {
    if (
      exports.value.some((x) =>
        ["queued", "leased", "retry_scheduled"].includes(x.status),
      )
    )
      void load();
  }, 5000);
});
onUnmounted(() => clearInterval(timer));
</script>
<template>
  <section class="report-center">
    <section class="report-guide"><div><p>报表怎么用</p><h3>先看结论，再看分布，最后导出明细</h3><span>机会分析用于判断选品进度，趋势分析用于发现市场变化，团队绩效用于查看任务完成情况。</span></div><ol><li><b>1</b>选择报表</li><li><b>2</b>查看指标和图表</li><li><b>3</b>导出明细留档</li></ol></section>
    <header>
      <div>
        <p>分析与导出</p>
        <h2>报表与导出</h2>
        <span
          >所有指标都来自当前组织和工作区已落库事实；缺失值保持“数据不足”。</span
        >
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
    <div v-if="notice" class="report-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </div>
    <section v-if="state === 'loading'" class="report-state">
      正在聚合当前工作区事实…
    </section>
    <section
      v-else-if="
        ['error', 'expired', 'forbidden', 'rate_limited', 'blocked'].includes(
          state,
        )
      "
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
                  ? "导出尚未就绪"
                  : "报表服务暂不可用"
        }}
      </h3>
      <p>{{ notice }}</p>
      <button @click="load">重新加载</button>
    </section>
    <template v-else
      ><section class="report-metrics">
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
            ><small>{{ item.label }}</small>
          </article>
        </div>
        <div v-else class="report-empty">
          <h3>暂无可聚合记录</h3>
          <p>报表不会用示例值补齐空结果。</p>
        </div>
      </section></template
    >
    <section class="report-exports">
      <header>
        <div>
          <p>导出生命周期</p>
          <h3>导出记录</h3>
        </div>
        <small>文件到期后由 Worker 清理</small>
      </header>
      <div v-if="exports.length" class="report-export-list">
        <article v-for="item in exports" :key="item.id">
          <i :data-status="item.status">{{ item.status }}</i>
          <div>
            <b>{{ labels[item.report_type as ReportType] }} · CSV</b
            ><small
              >{{
                item.row_count == null
                  ? "等待生成"
                  : `${item.row_count} 行 · ${item.byte_size} 字节`
              }}
              · 到期
              {{
                new Date(item.expires_at).toLocaleString("zh-CN", {
                  hour12: false,
                })
              }}</small
            >
          </div>
          <button v-if="item.status === 'succeeded'" @click="download(item)">
            下载</button
          ><span v-else>{{ item.last_error_code || "处理中" }}</span><button class="secondary" @click="selectedExport = item">查看详情</button>
        </article>
      </div>
      <div v-else class="report-empty">尚无导出任务。</div>
    </section>
    <aside v-if="selectedExport" class="report-detail"><button aria-label="关闭导出详情" @click="selectedExport=null">×</button><p>导出详情</p><h3>{{ labels[selectedExport.report_type as ReportType] }}</h3><dl><div><dt>状态</dt><dd>{{ selectedExport.status === 'succeeded' ? '已完成' : selectedExport.status === 'failed' ? '失败' : '处理中' }}</dd></div><div><dt>数据行数</dt><dd>{{ selectedExport.row_count ?? '等待生成' }}</dd></div><div><dt>文件大小</dt><dd>{{ selectedExport.byte_size == null ? '等待生成' : `${selectedExport.byte_size} 字节` }}</dd></div><div><dt>到期时间</dt><dd>{{ new Date(selectedExport.expires_at).toLocaleString('zh-CN',{hour12:false}) }}</dd></div></dl><p v-if="selectedExport.last_error_code">失败原因：{{ selectedExport.last_error_code }}</p></aside>
  </section>
</template>
