<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import ResponsiveDataView from "./ResponsiveDataView.vue";
const props = defineProps<{ apiBaseUrl: string; capabilities?: string[] }>();
const request = createApiClient(props.apiBaseUrl);
type State = "loading" | "ready" | "empty" | "expired" | "forbidden" | "rate_limited" | "blocked";
type WindowCode = "15m" | "24h" | "7d" | "30d";
const route = useRoute(),
  router = useRouter(),
  windows = new Set<WindowCode>(["15m", "24h", "7d", "30d"]),
  requestedWindow = String(route.query.window ?? "24h") as WindowCode;
const state = ref<State>("loading"),
  data = ref<any>(null),
  windowCode = ref<WindowCode>(windows.has(requestedWindow) ? requestedWindow : "24h"),
  requestId = ref(""),
  hint = ref(""),
  pending = ref(false),
  refreshError = ref("");
const stateText = computed(
  () =>
    (
      ({
        loading: ["正在准备管理首页", "正在核对组织、用户、热点来源和采集进度。"],
        empty: [
          "平台还没有可展示的业务事实",
          "系统仍会继续自动获取热点；也可以先配置来源或创建组织。",
        ],
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
};
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
      expired_leases: "过期任务租约",
      data_quality: "数据质量",
      providers: "热点来源",
      storage: "文件存储",
    }) as Record<string, string>
  )[v] ?? "系统检查";
const signalValue = (code: string, v: unknown) =>
  v === "query_succeeded"
    ? "正常"
    : v === "ready"
      ? "正常"
      : v === "warning"
        ? "需要关注"
        : typeof v === "number" && ["queue", "expired_leases", "data_quality"].includes(code)
          ? `${v} 个`
          : String(v);
const alertText = (kind: string, code: string) =>
  (
    ({
      network_timeout: "采集请求超时",
      parser_changed: "页面解析规则可能变化",
      rate_limited: "来源触发限流",
      blocked_captcha: "采集遇到验证码",
      blocked_login: "采集登录状态失效",
      title_accuracy: "标题准确性需要检查",
    }) as Record<string, string>
  )[code] ??
  (
    {
      quality: "数据质量问题",
      task: "采集任务问题",
      provider: "来源问题",
      system: "系统问题",
    } as Record<string, string>
  )[kind] ??
  "未分类问题";
const trendTotals = computed(() =>
  (data.value?.task_trend ?? []).reduce(
    (total: { succeeded: number; failed: number }, item: any) => ({
      succeeded: total.succeeded + (Number(item.succeeded) || 0),
      failed: total.failed + (Number(item.failed) || 0),
    }),
    { succeeded: 0, failed: 0 },
  ),
);
const successRateText = computed(() => {
  const value = data.value?.summary?.task_success_rate;
  return value === null || value === undefined ? "暂无样本" : `${Number(value).toFixed(1)}%`;
});
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
  if (pending.value) return;
  pending.value = true;
  refreshError.value = "";
  hint.value = "";
  if (!data.value) {
    state.value = "loading";
    requestId.value = "";
  }
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 12000);
  try {
    const response = await request<any>(`/platform/dashboard?window=${windowCode.value}`, {
      signal: controller.signal,
    });
    requestId.value = response.request_id;
    data.value = response.data;
    const summary = response.data?.summary ?? {},
      factual =
        Number(summary.active_organizations ?? 0) +
        Number(summary.active_users ?? 0) +
        Number(summary.enabled_providers ?? 0) +
        Number(summary.storage_bytes ?? 0) +
        (response.data?.queues?.length ?? 0) +
        (response.data?.alerts?.length ?? 0);
    state.value = factual === 0 ? "empty" : "ready";
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    if (data.value && state.value === "ready") {
      refreshError.value = timedOut
        ? "刷新超过 12 秒，继续显示上一份观测结果。"
        : "刷新失败，继续显示上一份观测结果。";
      requestId.value = failure?.requestId ?? requestId.value;
    } else {
      requestId.value = failure?.requestId ?? "";
      hint.value = timedOut
        ? "请求超过 12 秒，请检查 API 与数据库状态。"
        : (failure?.actionHint ?? "");
      state.value =
        failure?.kind === "expired" ||
        failure?.kind === "forbidden" ||
        failure?.kind === "rate_limited"
          ? failure.kind
          : "blocked";
    }
  } finally {
    window.clearTimeout(timeout);
    pending.value = false;
  }
}
async function changeWindow() {
  await router.replace({ query: { ...route.query, window: windowCode.value } });
  await load();
}
onMounted(load);
</script>
<template>
  <section class="platform-dashboard" aria-live="polite" :aria-busy="pending">
    <div class="platform-dashboard-toolbar">
      <div>
        <p>管理员首页</p>
        <h2>平台现在怎么样，一眼看懂</h2>
        <span
          >先看有没有需要处理的问题，再进入对应页面。系统会自动获取热点，不需要守着页面操作。</span
        >
      </div>
      <label
        >查看范围<select v-model="windowCode" :disabled="pending" @change="changeWindow">
          <option value="15m">最近 15 分钟</option>
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
        </select></label
      ><button type="button" :disabled="pending" @click="load">
        {{ pending ? "刷新中…" : "刷新" }}
      </button>
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
      ><RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink>
    </section>
    <template v-else-if="data"
      ><div v-if="refreshError" class="platform-refresh-feedback" role="alert">
        <span>{{ refreshError }}</span
        ><button type="button" :disabled="pending" @click="load">重新刷新</button>
      </div>
      <div class="platform-action-summary">
        <RouterLink to="/platform-admin/collection">
          <span>等待处理</span><strong>{{ data.summary.queue_backlog }}</strong
          ><small>查看排队、运行或受阻的采集任务 →</small>
        </RouterLink>
        <RouterLink to="/platform-admin/collection/overview?root_cause=1">
          <span>需要关注</span><strong>{{ data.summary.open_alerts }}</strong
          ><small>按错误根因查看异常 →</small>
        </RouterLink>
      </div>
      <section class="platform-facts" aria-labelledby="platform-facts-heading">
        <header>
          <div>
            <p>真实数据概览</p>
            <h3 id="platform-facts-heading">平台事实</h3>
          </div>
          <span>来自当前 MySQL 5.7 与所选时间范围</span>
        </header>
        <div>
          <article>
            <span>活跃组织</span><strong>{{ data.summary.active_organizations }}</strong
            ><RouterLink
              v-if="capabilities?.includes('platform:superadmin')"
              to="/platform-admin/organizations"
              >查看组织</RouterLink
            ><small v-else>仅超级管理员可查看明细</small>
          </article>
          <article>
            <span>活跃用户</span><strong>{{ data.summary.active_users }}</strong
            ><RouterLink
              v-if="capabilities?.includes('platform:superadmin')"
              to="/platform-admin/users"
              >查看用户</RouterLink
            ><small v-else>仅超级管理员可查看明细</small>
          </article>
          <article>
            <span>启用来源</span><strong>{{ data.summary.enabled_providers }}</strong
            ><RouterLink to="/platform-admin/providers/sources">查看来源</RouterLink>
          </article>
          <article>
            <span>任务成功率</span><strong>{{ successRateText }}</strong
            ><RouterLink to="/platform-admin/collection">查看任务</RouterLink>
          </article>
          <article>
            <span>窗内文件增长</span><strong>{{ bytes(data.summary.file_growth_bytes) }}</strong
            ><RouterLink to="/platform-admin/data">查看数据</RouterLink>
          </article>
        </div>
      </section>
      <section class="platform-get-started">
        <header>
          <h3>今天先做什么</h3>
          <span>按需要进入，不懂技术参数也能管理</span>
        </header>
        <div>
          <RouterLink
            v-if="capabilities?.includes('platform:superadmin')"
            to="/platform-admin/organizations"
            ><b>管理组织和用户</b><span>新建组织、停用账号、分配管理员</span></RouterLink
          ><RouterLink to="/platform-admin/providers/sources"
            ><b>查看热点来源</b><span>确认自动来源、待配置来源和手动来源</span></RouterLink
          ><RouterLink to="/platform-admin/collection/overview"
            ><b>查看采集进度</b><span>看看自动获取是否完成、哪里需要处理</span></RouterLink
          >
        </div>
      </section>
      <div class="platform-dashboard-grid">
        <section class="platform-trend-chart">
          <header>
            <h3>采集任务趋势</h3>
            <span
              ><i data-series="success"></i>成功 {{ trendTotals.succeeded }}
              <i data-series="failed"></i>失败 {{ trendTotals.failed }} ·
              {{ data.task_trend.length }} 个时间点</span
            >
          </header>
          <div v-if="!data.task_trend.length" class="platform-inline-empty">
            当前时间范围还没有趋势数据。<RouterLink to="/platform-admin/providers/sources"
              >检查来源是否启用</RouterLink
            >，或<RouterLink to="/platform-admin/collection/overview">查看采集队列</RouterLink>。
          </div>
          <svg
            v-else
            viewBox="0 0 600 180"
            role="img"
            :aria-label="`采集任务成功和失败趋势折线图：成功 ${trendTotals.succeeded}，失败 ${trendTotals.failed}`"
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
          <ResponsiveDataView
            v-else
            :rows="data.provider_health"
            :row-key="(item) => item.id"
            title="来源健康"
            :detail-title="(item) => item.name"
          >
            <template #desktop>
              <table>
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
                      <b>{{ p.name }}</b>
                    </td>
                    <td>
                      <i :data-health="p.status">{{
                        p.status === "healthy" ? "健康" : p.status === "degraded" ? "降级" : "未知"
                      }}</i>
                    </td>
                    <td>{{ p.success_count }} / {{ p.failed_count }}</td>
                    <td>
                      {{
                        p.last_observed_at
                          ? new Date(p.last_observed_at).toLocaleString()
                          : "无样本"
                      }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template #summary="{ row }">
              <span class="responsive-record-summary">
                <strong
                  >{{ row.name }} ·
                  {{
                    row.status === "healthy" ? "健康" : row.status === "degraded" ? "降级" : "未知"
                  }}</strong
                >
                <small>{{ row.success_count }} 次成功 · {{ row.failed_count }} 次失败</small>
              </span>
            </template>
            <template #detail="{ row }">
              <dl>
                <div>
                  <dt>健康状态</dt>
                  <dd>
                    {{
                      row.status === "healthy"
                        ? "健康"
                        : row.status === "degraded"
                          ? "降级"
                          : "未知"
                    }}
                  </dd>
                </div>
                <div>
                  <dt>成功 / 失败</dt>
                  <dd>{{ row.success_count }} / {{ row.failed_count }}</dd>
                </div>
                <div>
                  <dt>观测样本</dt>
                  <dd>{{ row.observed_count }} 条</dd>
                </div>
                <div>
                  <dt>最近观测</dt>
                  <dd>
                    {{
                      row.last_observed_at
                        ? new Date(row.last_observed_at).toLocaleString()
                        : "无样本"
                    }}
                  </dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <dl>
                  <div>
                    <dt>来源 ID</dt>
                    <dd>{{ row.id }}</dd>
                  </div>
                  <div>
                    <dt>来源代码</dt>
                    <dd>{{ row.code }}</dd>
                  </div>
                </dl>
              </details>
            </template>
          </ResponsiveDataView>
        </section>
        <section>
          <header>
            <h3>系统检查</h3>
            <span>实时状态</span>
          </header>
          <ul class="platform-signals">
            <li v-for="s in data.health_signals" :key="s.code">
              <i :data-health="s.status"></i><span>{{ signalText(s.code) }}</span
              ><strong>{{ signalValue(s.code, s.value) }}</strong>
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
                ><small>已关联组织与工作区 · {{ new Date(a.observed_at).toLocaleString() }}</small>
                <details>
                  <summary>技术详情</summary>
                  <small>组织 ID {{ a.organization_id }} · 工作区 ID {{ a.workspace_id }}</small>
                </details>
              </div>
            </li>
            <li v-if="!data.alerts.length">当前没有需要处理的问题</li>
          </ul>
        </section>
      </div>
      <footer class="platform-observed">
        观测时间 {{ new Date(data.observed_at).toLocaleString() }}
        <details>
          <summary>技术详情</summary>
          <span>请求 ID {{ requestId }}</span>
        </details>
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
  font-size: 13px;
}
.platform-alerts details summary,
.platform-observed details summary {
  min-height: var(--so-touch-target);
  display: inline-flex;
  align-items: center;
  color: var(--so-primary);
  cursor: pointer;
}
.platform-observed details span {
  overflow-wrap: anywhere;
}
</style>
