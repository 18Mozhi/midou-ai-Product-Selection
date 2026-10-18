<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onActivated, onDeactivated, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import type { DailySelectionProduction } from "@scoutops/contracts";
import HomeAutomationOverview from "./HomeAutomationOverview.vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../home-dashboard.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Item {
  id: string;
  kind: "action" | "change" | "follow" | "health";
  title: string;
  reason: string;
  route: string;
  source_module: "projection" | "task" | "approval" | "opportunity";
  source_label: string;
  context_label: string;
  priority: "overdue" | "blocking" | "high_risk" | "high_value" | "normal" | null;
  risk_level: "unknown" | "low" | "normal" | "medium" | "high" | "critical" | null;
  value_score: number | null;
  blocked: boolean;
  owner_label: string | null;
  due_at: string | null;
  source_count: number | null;
  observed_at: string;
  severity: "info" | "warning" | "critical";
  source_version: number;
}
interface Summary {
  actions: Item[];
  changes: Item[];
  follows: Item[];
  health: Item[];
  automatic_selection?: {
    daily_production?: DailySelectionProduction | null;
    state: "not_configured" | "running" | "attention";
    enabled_rule_count: number;
    candidate_count: number;
    rule_candidate_count: number;
    recommended_count: number;
    awaiting_evidence_count: number;
    adopted_count: number;
    recommended_items: Item[];
    last_collection_at: string | null;
    next_collection_at: string | null;
  };
  scope: { organization_id: string; workspace_id: string };
  generated_at: string;
}
const props = withDefaults(defineProps<{ apiBaseUrl: string; capabilities?: string[] }>(), {
    capabilities: () => [],
  }),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  data = ref<Summary | null>(null),
  requestId = ref(""),
  traceId = ref(""),
  actionHint = ref("");
let loadGeneration = 0;
let readController: AbortController | null = null;
let active = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let liveReadPending = false;
const HOME_REFRESH_INTERVAL_MS = 5000;
const refreshing = ref(false);
const lastRefreshedAt = ref("");
const selection = computed(() => data.value?.automatic_selection ?? null),
  decisionActions = computed(() => selection.value?.recommended_items ?? []),
  date = (value: string | null) => (value ? new Date(value).toLocaleString("zh-CN") : "未设置");
const dailyTime = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
const score = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const failure = (kind: ApiFailureKind): State =>
  kind === "expired"
    ? "expired"
    : kind === "forbidden"
      ? "forbidden"
      : kind === "blocked" || kind === "rate_limited"
        ? "blocked"
        : "error";
async function load() {
  readController?.abort();
  const controller = new AbortController();
  readController = controller;
  const generation = ++loadGeneration;
  refreshing.value = true;
  if (!data.value) state.value = "loading";
  actionHint.value = "";
  try {
    const response = await request<Summary>("/me/home-dashboard", { signal: controller.signal });
    if (generation !== loadGeneration) return;
    requestId.value = response.request_id;
    traceId.value = response.trace_id;
    data.value = response.data;
    lastRefreshedAt.value = new Date().toLocaleTimeString("zh-CN");
    state.value =
      response.data.actions.length +
        response.data.changes.length +
        response.data.follows.length +
        response.data.health.length || response.data.automatic_selection?.state === "running"
        ? "ready"
        : "empty";
  } catch (error) {
    if (controller.signal.aborted || generation !== loadGeneration) return;
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      traceId.value = error.traceId;
      actionHint.value = error.actionHint;
      if (error.kind === "expired" || error.kind === "forbidden") {
        data.value = null;
        state.value = failure(error.kind);
      } else if (!data.value) {
        state.value = failure(error.kind);
      }
      return;
    }
    actionHint.value = "网络连接异常，请稍后重试。";
    if (!data.value) state.value = "blocked";
  } finally {
    if (generation === loadGeneration) {
      refreshing.value = false;
      if (active) scheduleRefresh();
    }
    if (readController === controller) readController = null;
  }
}
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (active && !["expired", "forbidden"].includes(state.value))
    refreshTimer = setTimeout(() => void refreshLive(), HOME_REFRESH_INTERVAL_MS);
}
async function refreshLive() {
  if (!active || liveReadPending) return;
  if (document.visibilityState !== "visible" || refreshing.value) {
    scheduleRefresh();
    return;
  }
  liveReadPending = true;
  try {
    await load();
  } finally {
    liveReadPending = false;
  }
}
function resumeVisible() {
  if (document.visibilityState === "visible") void refreshLive();
}
function activate() {
  if (active) return;
  active = true;
  document.addEventListener("visibilitychange", resumeVisible);
  window.addEventListener("focus", resumeVisible);
  void load();
}
function deactivate() {
  active = false;
  loadGeneration += 1;
  readController?.abort();
  readController = null;
  refreshing.value = false;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  document.removeEventListener("visibilitychange", resumeVisible);
  window.removeEventListener("focus", resumeVisible);
}
onMounted(activate);
onActivated(activate);
onDeactivated(deactivate);
onBeforeUnmount(deactivate);
</script>
<template>
  <section class="home-dashboard" :data-state="state">
    <p v-if="actionHint && data" class="home-read-alert" role="alert">
      首页数据暂未刷新，当前显示上次成功读取的快照。{{ actionHint }}
      <button type="button" @click="load()">重新读取</button>
      <span v-if="requestId">追踪编号：{{ requestId }}</span>
    </p>
    <UiStatePanel
      v-if="state !== 'ready' && state !== 'empty'"
      :kind="state"
      :request-id="requestId"
      :trace-id="traceId"
      :action-hint="actionHint"
      :hide-secondary="true"
      primary-label="重新读取"
      @primary="load"
    /><template v-else>
      <header class="home-command-bar">
        <div>
          <span class="home-system-state" :data-state="selection?.state ?? 'unknown'">
            <i></i>
            {{
              selection?.state === "running"
                ? "采集调度已配置"
                : selection?.state === "attention"
                  ? "自动选品需检查"
                  : selection?.state === "not_configured"
                    ? "自动选品未配置"
                    : "自动选品状态暂不可用"
            }}
          </span>
          <h2>选品工作台</h2>
        </div>
        <nav>
          <div class="home-live-status" role="status" aria-live="off">
            <span>{{
              refreshing ? "正在更新" : lastRefreshedAt ? `已更新 ${lastRefreshedAt}` : "等待数据"
            }}</span>
            <button type="button" :disabled="refreshing" @click="load()">刷新</button>
          </div>
          <RouterLink class="home-secondary-action so-action-secondary" to="/trends"
            >市场情报</RouterLink
          >
          <RouterLink class="home-primary-action so-action-primary" to="/opportunities"
            >查看选品库</RouterLink
          >
        </nav>
      </header>
      <div class="home-overview-panel">
        <section class="home-daily-production" aria-label="每日选品产出">
          <header>
            <h3>今日选品产出</h3>
            <span
              >{{ selection?.daily_production?.date ?? "日期未读取" }} · 北京时间 · 当前工作区</span
            >
          </header>
          <template v-if="selection?.daily_production">
            <dl>
              <div class="home-daily-completion">
                <dt>完成整条流程</dt>
                <dd v-if="selection.daily_production.completed_count != null">
                  {{ selection.daily_production.completed_count }}
                  <small>/ {{ selection.daily_production.target_minimum }} 目标</small>
                </dd>
                <dd v-else>未读取</dd>
                <progress
                  v-if="selection.daily_production.completed_count != null"
                  :value="selection.daily_production.completed_count"
                  :max="selection.daily_production.target_minimum"
                  aria-label="今日完成整条选品流程目标进度"
                ></progress>
              </div>
              <div>
                <dt>新增主品 ASIN</dt>
                <dd>{{ selection.daily_production.discovered_count }}</dd>
              </div>
              <div>
                <dt>新增合格推荐</dt>
                <dd>{{ selection.daily_production.qualified_count }}</dd>
              </div>
            </dl>
            <p v-if="selection.daily_production.completed_count == null" class="home-read-hint">
              完成流程数尚未读取，不使用新增数或推荐数代替。
            </p>
            <footer class="home-daily-meta">
              <small>统计时间 {{ dailyTime(selection.daily_production.measured_at) }}</small>
            </footer>
          </template>
          <p v-else>每日产出尚未读取，暂不显示数量或目标达成状态。</p>
        </section>
        <HomeAutomationOverview v-if="selection" :selection="selection" />
      </div>

      <section v-if="selection?.state === 'not_configured'" class="home-setup-callout">
        <div>
          <b>等待采集来源就绪</b
          ><span>来源和采集调度由后台管理；可用来源开始采集后，系统会自动分析情报并寻找商品。</span>
        </div>
      </section>
      <section class="home-review-queue so-ledger-surface" aria-labelledby="home-review-title">
        <header>
          <div>
            <h3 id="home-review-title">推荐清单</h3>
          </div>
          <RouterLink v-if="selection" to="/opportunities">
            全部 {{ selection.recommended_count }} 条 →
          </RouterLink>
        </header>
        <RouterLink
          v-for="item in decisionActions"
          :key="item.id"
          :to="item.route"
          class="home-review-row"
        >
          <div>
            <strong>{{ item.title }}</strong
            ><small>{{ item.reason }}</small>
          </div>
          <span>{{
            item.value_score === null ? "评分未读取" : `${score(item.value_score)} 分`
          }}</span
          ><b>查看 →</b>
        </RouterLink>
        <div v-if="!selection" class="home-quiet-empty" role="status">
          <b>自动选品数据暂不可用</b>
          <span>推荐与运行统计暂不可用，请稍后刷新。</span>
        </div>
        <div v-else-if="!decisionActions.length" class="home-quiet-empty">
          <b>当前没有待人工采纳的推荐</b
          ><span>{{
            selection.rule_candidate_count > 0
              ? `${selection.rule_candidate_count} 条选品候选尚待五项质量门校验，可查看缺失资料。`
              : selection.awaiting_evidence_count > 0
                ? `${selection.awaiting_evidence_count} 条商品等待补充主品证据。`
                : "系统会在五项质量门全部通过后自动加入这里。"
          }}</span>
          <RouterLink
            v-if="selection.rule_candidate_count > 0"
            to="/opportunities?view=rule_candidates"
            >查看候选进度</RouterLink
          >
          <RouterLink
            v-else-if="selection.awaiting_evidence_count > 0"
            to="/opportunities?view=evidence_pending"
            >查看采集进度</RouterLink
          >
        </div>
      </section>

      <details v-if="selection" class="home-truth">
        <summary>数据说明</summary>
        <div class="home-truth-body">
          <p v-if="selection.daily_production">
            目标包含低分、不推荐及明确标注利润未知的已分析商品；按首次核验完成的主品 ASIN
            去重，重复刷新不重复计数。
          </p>
          <p v-if="selection.daily_production">当前快照不能证明全天不间断运行。</p>
          <div class="home-truth-meta">
            <span>当前工作区快照</span><span>生成时间 {{ date(data?.generated_at ?? null) }}</span
            ><span>推荐需人工采纳</span>
          </div>
        </div>
      </details>
      <p v-else class="home-truth-unknown">自动选品统计暂不可用。</p>
    </template>
  </section>
</template>
