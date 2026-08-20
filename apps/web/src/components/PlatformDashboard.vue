<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
const props = defineProps<{ apiBaseUrl: string }>();
type State = "loading" | "ready" | "empty" | "expired" | "forbidden" | "rate_limited" | "blocked";
const state = ref<State>("loading"),
  data = ref<any>(null),
  windowCode = ref("24h"),
  requestId = ref(""),
  hint = ref("");
const stateText = computed(
  () =>
    (
      ({
        loading: ["正在准备管理首页", "正在核对组织、用户、热点来源和采集进度。"],
        empty: ["这段时间还没有采集记录", "系统仍会继续自动获取热点；也可以选择更长时间查看。"],
        expired: ["登录已失效", "重新登录后会回到管理首页。"],
        forbidden: ["当前账号不能进入平台管理后台", "请联系超级管理员分配平台管理权限。"],
        rate_limited: ["刷新太频繁了", "稍等片刻再刷新，不会影响后台自动采集。"],
        blocked: ["管理首页暂时无法读取数据", "请稍后重试；仍失败时联系技术人员检查统一后端。"],
        ready: ["", ""],
      }) as Record<State, string[]>
    )[state.value],
);
const bytes = (v: number) => {
    if (v < 1024) return `${v} B`;
    if (v < 1048576) return `${(v / 1024).toFixed(1)} KB`;
    if (v < 1073741824) return `${(v / 1048576).toFixed(1)} MB`;
    return `${(v / 1073741824).toFixed(1)} GB`;
  },
  short = (v: string) => (v ? `${v.slice(0, 8)}…` : "—");
const queueText = (v: string) =>
  (
    ({
      queued: "等待处理",
      leased: "正在领取",
      running: "正在处理",
      retry_scheduled: "稍后重试",
      failed_terminal: "处理失败",
      dead_letter: "多次失败",
      succeeded: "处理完成",
      succeeded_empty: "完成但无结果",
    }) as Record<string, string>
  )[v] ?? "其他状态";
const signalText = (v: string) =>
  (
    ({
      mysql: "数据库",
      queue: "任务队列",
      data_quality: "数据质量",
      providers: "热点来源",
      storage: "文件存储",
    }) as Record<string, string>
  )[v] ?? "系统检查";
const signalValue = (v: unknown) =>
  v === "query_succeeded"
    ? "正常"
    : v === "ready"
      ? "正常"
      : v === "warning"
        ? "需要关注"
        : String(v);
const alertText = (kind: string, code: string) =>
  (
    ({
      quality: "数据质量问题",
      collection: "采集问题",
      provider: "来源问题",
      system: "系统问题",
    }) as Record<string, string>
  )[kind] ??
  ({ title_accuracy: "标题准确性需要检查" } as Record<string, string>)[code] ??
  "需要人工查看";
const trendPoints = (key: "succeeded" | "failed") => {
  const rows = data.value?.task_trend ?? [],
    max = Math.max(
      1,
      ...rows.flatMap((item: any) => [Number(item.succeeded) || 0, Number(item.failed) || 0]),
    );
  return rows
    .map(
      (item: any, index: number) =>
        `${rows.length < 2 ? 0 : (index * 600) / (rows.length - 1)},${170 - ((Number(item[key]) || 0) * 150) / max}`,
    )
    .join(" ");
};
async function load() {
  state.value = "loading";
  requestId.value = "";
  try {
    const r = await fetch(`${props.apiBaseUrl}/platform/dashboard?window=${windowCode.value}`, {
        credentials: "include",
        headers: { accept: "application/json" },
      }),
      b = await r.json().catch(() => null);
    requestId.value = b?.request_id ?? "";
    hint.value = b?.error?.action_hint ?? "";
    if (!r.ok) {
      state.value =
        r.status === 401
          ? "expired"
          : r.status === 403
            ? "forbidden"
            : r.status === 429
              ? "rate_limited"
              : "blocked";
      return;
    }
    data.value = b.data;
    const operational =
      b.data.queues.length +
      b.data.provider_health.reduce((n: number, p: any) => n + p.observed_count, 0) +
      b.data.alerts.length;
    state.value = operational === 0 ? "empty" : "ready";
  } catch {
    state.value = "blocked";
  }
}
onMounted(load);
</script>
<template>
  <section class="platform-dashboard" aria-live="polite">
    <div class="platform-dashboard-toolbar">
      <div>
        <p>管理员首页</p>
        <h2>平台现在怎么样，一眼看懂</h2>
        <span
          >先看有没有需要处理的问题，再进入对应页面。系统会自动获取热点，不需要守着页面操作。</span
        >
      </div>
      <label
        >查看范围<select v-model="windowCode" @change="load">
          <option value="15m">最近 15 分钟</option>
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
        </select></label
      ><button type="button" @click="load">刷新</button>
    </div>
    <section v-if="state !== 'ready'" class="platform-dashboard-state" :data-kind="state">
      <span>{{ state === "loading" ? "···" : "!" }}</span>
      <h3>{{ stateText[0] }}</h3>
      <p>{{ stateText[1] }}</p>
      <small v-if="hint">{{ hint }}</small
      ><code v-if="requestId">request_id: {{ requestId }}</code
      ><button
        v-if="!['loading', 'expired', 'forbidden'].includes(state)"
        type="button"
        @click="load"
      >
        重新读取</button
      ><a v-if="state === 'expired'" href="/login">重新登录</a>
    </section>
    <template v-else-if="data"
      ><section class="platform-get-started">
        <header>
          <h3>今天先做什么</h3>
          <span>按需要进入，不懂技术参数也能管理</span>
        </header>
        <div>
          <a href="/platform-admin/accounts"
            ><b>管理组织和用户</b><span>新建组织、停用账号、分配管理员</span></a
          ><a href="/platform-admin/providers/sources"
            ><b>查看热点来源</b><span>确认自动来源、待配置来源和手动来源</span></a
          ><a href="/platform-admin/collection/overview"
            ><b>查看采集进度</b><span>看看自动获取是否完成、哪里需要处理</span></a
          >
        </div>
      </section>
      <div class="platform-action-summary">
        <a href="/platform-admin/collection/tasks">
          <span>等待处理</span><strong>{{ data.summary.queue_backlog }}</strong
          ><small>查看排队、运行或受阻的采集任务 →</small>
        </a>
        <a href="/platform-admin/collection/overview?root_cause=1">
          <span>需要关注</span><strong>{{ data.summary.open_alerts }}</strong
          ><small>按错误根因查看异常 →</small>
        </a>
      </div>
      <div class="platform-dashboard-grid">
        <section class="platform-trend-chart">
          <header>
            <h3>采集任务趋势</h3>
            <span
              ><i data-series="success"></i>成功 <i data-series="failed"></i>失败 ·
              {{ data.task_trend.length }} 个时间点</span
            >
          </header>
          <div v-if="!data.task_trend.length" class="platform-inline-empty">
            当前时间范围还没有趋势数据。<a href="/platform-admin/providers/sources"
              >检查来源是否启用</a
            >，或<a href="/platform-admin/collection/overview">查看采集队列</a>。
          </div>
          <svg
            v-else
            viewBox="0 0 600 180"
            role="img"
            aria-label="采集任务成功和失败趋势折线图"
            preserveAspectRatio="none"
          >
            <line v-for="y in [20, 70, 120, 170]" :key="y" x1="0" :y1="y" x2="600" :y2="y" />
            <polyline data-series="success" :points="trendPoints('succeeded')" />
            <polyline data-series="failed" :points="trendPoints('failed')" />
          </svg>
          <footer v-if="data.task_trend.length">
            <span>{{ new Date(data.task_trend[0].bucket).toLocaleString() }}</span
            ><span>{{
              new Date(data.task_trend[data.task_trend.length - 1].bucket).toLocaleString()
            }}</span>
          </footer>
        </section>
        <section>
          <header>
            <h3>来源健康</h3>
            <span>{{ data.provider_health.length }} 个启用来源</span>
          </header>
          <div v-if="!data.provider_health.length" class="platform-inline-empty">尚无启用来源</div>
          <table v-else>
            <thead>
              <tr>
                <th>来源</th>
                <th>状态</th>
                <th>成功 / 失败</th>
                <th>最近观测</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in data.provider_health" :key="p.id">
                <td>
                  <b>{{ p.name }}</b
                  ><small>{{ p.code }}</small>
                </td>
                <td>
                  <i :data-health="p.status">{{
                    p.status === "healthy" ? "健康" : p.status === "degraded" ? "降级" : "未知"
                  }}</i>
                </td>
                <td>{{ p.success_count }} / {{ p.failed_count }}</td>
                <td>
                  {{
                    p.last_observed_at ? new Date(p.last_observed_at).toLocaleString() : "无样本"
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        <section>
          <header>
            <h3>系统检查</h3>
            <span>实时状态</span>
          </header>
          <ul class="platform-signals">
            <li v-for="s in data.health_signals" :key="s.code">
              <i :data-health="s.status"></i><span>{{ signalText(s.code) }}</span
              ><strong>{{ signalValue(s.value) }}</strong>
            </li>
          </ul>
          <dl class="platform-storage">
            <div>
              <dt>活动文件体积</dt>
              <dd>{{ bytes(data.summary.storage_bytes) }}</dd>
            </div>
            <div>
              <dt>窗内文件增长</dt>
              <dd>+{{ bytes(data.summary.file_growth_bytes) }}</dd>
            </div>
          </dl>
        </section>
        <section>
          <header>
            <h3>后台任务</h3>
            <span>最近时间范围</span>
          </header>
          <div class="platform-queue-bars">
            <div v-for="q in data.queues" :key="q.status">
              <span>{{ queueText(q.status) }}</span
              ><b
                :style="{
                  width: `${Math.max(4, Math.min(100, q.total * 10))}%`,
                }"
              ></b
              ><strong>{{ q.total }}</strong>
            </div>
            <p v-if="!data.queues.length">当前没有积压或失败任务</p>
          </div>
        </section>
        <section>
          <header>
            <h3>需要关注</h3>
            <span>最近 {{ data.alerts.length }} 条</span>
          </header>
          <ul class="platform-alerts">
            <li v-for="a in data.alerts" :key="a.id">
              <i :data-health="a.severity"></i>
              <div>
                <b>{{ alertText(a.kind, a.code) }}</b
                ><small
                  >组织 {{ short(a.organization_id) }} · 工作区 {{ short(a.workspace_id) }} ·
                  {{ new Date(a.observed_at).toLocaleString() }}</small
                >
              </div>
            </li>
            <li v-if="!data.alerts.length">当前没有需要处理的问题</li>
          </ul>
        </section>
      </div>
      <footer class="platform-observed">
        观测时间 {{ new Date(data.observed_at).toLocaleString() }} · request_id
        {{ requestId }}
      </footer></template
    >
  </section>
</template>
<style scoped>
.platform-trend-chart {
  grid-column: 1/-1;
}
.platform-trend-chart svg {
  display: block;
  width: 100%;
  height: 190px;
}
.platform-trend-chart svg line {
  stroke: var(--so-border);
  stroke-width: 1;
}
.platform-trend-chart svg polyline {
  fill: none;
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
}
.platform-trend-chart svg polyline[data-series="success"] {
  stroke: var(--so-primary);
}
.platform-trend-chart svg polyline[data-series="failed"] {
  stroke: var(--so-danger);
}
.platform-trend-chart header i {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin: 0 4px 0 10px;
  border-radius: 50%;
}
.platform-trend-chart header i[data-series="success"] {
  background: var(--so-primary);
}
.platform-trend-chart header i[data-series="failed"] {
  background: var(--so-danger);
}
.platform-trend-chart footer {
  display: flex;
  justify-content: space-between;
  color: var(--so-text-muted);
  font-size: 11px;
}
</style>
