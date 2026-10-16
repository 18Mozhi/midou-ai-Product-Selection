<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  onActivated,
  onDeactivated,
  reactive,
  ref,
} from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import type { DailySelectionProduction } from "@scoutops/contracts";
import HomeAutomationOverview from "./HomeAutomationOverview.vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../home-dashboard.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type RuleReadState = "loading" | "ready" | "error";
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
interface Rule {
  id: string;
  name: string;
  include_keywords: string[];
  negative_keywords: string[];
  market: string;
  language: string;
  category: string | null;
  collection_interval_minutes: number;
  recommendation_min_source_count: number;
  status: "enabled" | "paused";
  version: number;
}
const props = withDefaults(defineProps<{ apiBaseUrl: string; capabilities?: string[] }>(), {
    capabilities: () => [],
  }),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  rulesState = ref<RuleReadState>("loading"),
  rulesError = ref(""),
  data = ref<Summary | null>(null),
  requestId = ref(""),
  traceId = ref(""),
  actionHint = ref(""),
  mutationFeedback = ref(""),
  rules = ref<Rule[]>([]),
  setupOpen = ref(false),
  setupBusy = ref(false),
  setupMessage = ref("");
const setupForm = reactive({
  name: "",
  include_keywords: "",
  negative_keywords: "",
  market: "US",
  category: "",
  collection_interval_minutes: 60,
  recommendation_min_source_count: 1,
});
let loadGeneration = 0;
let readController: AbortController | null = null;
let active = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let liveReadPending = false;
const HOME_REFRESH_INTERVAL_MS = 5000;
const refreshing = ref(false);
const lastRefreshedAt = ref("");
const total = computed(() =>
    data.value
      ? data.value.actions.length +
        data.value.changes.length +
        data.value.follows.length +
        data.value.health.length
      : 0,
  ),
  selection = computed(() => data.value?.automatic_selection ?? null),
  decisionActions = computed(() => selection.value?.recommended_items ?? []),
  otherActions = computed(() =>
    (data.value?.actions ?? []).filter((item) => item.source_module !== "opportunity"),
  ),
  canManageRules = computed(() => props.capabilities.includes("trend:manage")),
  pausedRules = computed(() => rules.value.filter((item) => item.status === "paused")),
  priorityLabel = (value: Item["priority"]) =>
    ({
      overdue: "逾期",
      blocking: "阻断",
      high_risk: "高风险",
      high_value: "高价值",
      normal: "普通",
    })[value ?? "normal"],
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
async function load(options: { keepMutationFeedback?: boolean; background?: boolean } = {}) {
  readController?.abort();
  const controller = new AbortController();
  readController = controller;
  const generation = ++loadGeneration;
  refreshing.value = true;
  if (!data.value) state.value = "loading";
  if (!options.background || rulesState.value !== "ready") {
    rulesState.value = "loading";
    rulesError.value = "";
    rules.value = [];
  }
  actionHint.value = "";
  if (!options.keepMutationFeedback) mutationFeedback.value = "";
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
    try {
      if (!options.background || rulesState.value !== "ready") {
        const ruleResponse = await request<Rule[]>("/trends/monitoring-rules", {
          signal: controller.signal,
        });
        if (generation !== loadGeneration) return;
        rules.value = ruleResponse.data;
        rulesState.value = "ready";
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (generation !== loadGeneration) return;
      rulesState.value = "error";
      rulesError.value =
        error instanceof ApiClientError ? error.actionHint : "规则暂时无法读取，请稍后重试。";
    }
  } catch (error) {
    if (controller.signal.aborted || generation !== loadGeneration) return;
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      traceId.value = error.traceId;
      actionHint.value = error.actionHint;
      rulesState.value = "error";
      rulesError.value = error.actionHint;
      if (error.kind === "expired" || error.kind === "forbidden") {
        data.value = null;
        rules.value = [];
        setupOpen.value = false;
        state.value = failure(error.kind);
      } else if (!data.value) {
        state.value = failure(error.kind);
      }
      return;
    }
    actionHint.value = "网络连接异常，请稍后重试。";
    rulesState.value = "error";
    rulesError.value = actionHint.value;
    if (!data.value) state.value = "blocked";
  } finally {
    if (generation === loadGeneration) {
      refreshing.value = false;
      if (active) scheduleRefresh();
    }
    if (readController === controller) readController = null;
  }
}
const keywordList = (value: string) =>
  value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
async function createRule() {
  if (setupBusy.value || rulesState.value !== "ready") return;
  const included = keywordList(setupForm.include_keywords);
  if (!included.length || !canManageRules.value) {
    setupMessage.value = "至少填写一个希望持续寻找的商品关键词。";
    return;
  }
  setupBusy.value = true;
  setupMessage.value = "";
  try {
    await request("/trends/monitoring-rules", {
      method: "POST",
      body: {
        name: setupForm.name.trim() || `自动选品 · ${included[0]}`,
        include_keywords: included,
        negative_keywords: keywordList(setupForm.negative_keywords),
        market: setupForm.market,
        language:
          setupForm.market === "JP"
            ? "ja-JP"
            : setupForm.market === "KR"
              ? "ko-KR"
              : setupForm.market === "DE"
                ? "de-DE"
                : setupForm.market === "FR"
                  ? "fr-FR"
                  : "en-US",
        category: setupForm.category.trim() || null,
        notification_channel: "in_app",
        collection_interval_minutes: setupForm.collection_interval_minutes,
        recommendation_min_source_count: setupForm.recommendation_min_source_count,
      },
    });
    setupOpen.value = false;
    setupMessage.value = "规则创建请求已受理。实际采集进度以首页运行状态为准。";
    mutationFeedback.value = setupMessage.value;
    await load({ keepMutationFeedback: true });
  } catch (error) {
    setupMessage.value =
      error instanceof ApiClientError ? error.actionHint : "暂时无法保存，请稍后重试。";
  } finally {
    setupBusy.value = false;
  }
}
async function resumeRule(item: Rule | undefined) {
  if (!item || !canManageRules.value || setupBusy.value) return;
  setupBusy.value = true;
  setupMessage.value = "";
  try {
    await request(`/trends/monitoring-rules/${item.id}`, {
      method: "PATCH",
      body: {
        status: "enabled",
        expected_version: item.version,
        collection_interval_minutes: item.collection_interval_minutes,
        recommendation_min_source_count: item.recommendation_min_source_count,
      },
    });
    setupMessage.value = `“${item.name}”恢复请求已受理。实际采集进度以首页运行状态为准。`;
    mutationFeedback.value = setupMessage.value;
    await load({ keepMutationFeedback: true });
  } catch (error) {
    setupMessage.value =
      error instanceof ApiClientError ? error.actionHint : "暂时无法恢复，请稍后重试。";
  } finally {
    setupBusy.value = false;
  }
}
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (active && !["expired", "forbidden"].includes(state.value))
    refreshTimer = setTimeout(() => void refreshLive(), HOME_REFRESH_INTERVAL_MS);
}
async function refreshLive() {
  if (!active || liveReadPending) return;
  if (document.visibilityState !== "visible" || setupBusy.value || refreshing.value) {
    scheduleRefresh();
    return;
  }
  liveReadPending = true;
  try {
    await load({ background: true, keepMutationFeedback: true });
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
  void load({ background: Boolean(data.value), keepMutationFeedback: Boolean(data.value) });
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
    <p v-if="mutationFeedback" class="home-write-feedback" role="status">{{ mutationFeedback }}</p>
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
          <h2>选品控制台</h2>
        </div>
        <nav>
          <div class="home-live-status" role="status" aria-live="off">
            <span>{{
              refreshing ? "正在更新" : lastRefreshedAt ? `已更新 ${lastRefreshedAt}` : "等待数据"
            }}</span>
            <button
              type="button"
              :disabled="refreshing"
              @click="load({ keepMutationFeedback: true })"
            >
              刷新
            </button>
          </div>
          <RouterLink class="home-secondary-action so-action-secondary" to="/trends?section=rules"
            >管理规则</RouterLink
          >
          <RouterLink class="home-secondary-action so-action-secondary" to="/opportunities"
            >查看推荐清单</RouterLink
          >
          <RouterLink class="home-primary-action so-action-primary" to="/opportunities/start"
            >创建选品 →</RouterLink
          >
        </nav>
      </header>
      <section class="home-daily-production" aria-label="每日选品产出">
        <header>
          <h3>今日新增商品</h3>
          <span
            >{{ selection?.daily_production?.date ?? "日期未读取" }} · 北京时间 · 当前工作区</span
          >
        </header>
        <template v-if="selection?.daily_production">
          <dl>
            <div>
              <dt>新增主品 ASIN</dt>
              <dd>{{ selection.daily_production.discovered_count }}</dd>
            </div>
            <div>
              <dt>当前通过质量门</dt>
              <dd>
                {{ selection.daily_production.qualified_count }}
                <small>/ {{ selection.daily_production.target_minimum }} 目标</small>
              </dd>
            </div>
          </dl>
          <progress
            :value="selection.daily_production.qualified_count"
            :max="selection.daily_production.target_minimum"
            aria-label="今日新增合格商品目标进度"
          ></progress>
          <p>按主品 ASIN 去重，历史已有商品不算新增；缺数据或未通过质量门不计入目标。</p>
          <small
            >统计时间
            {{
              dailyTime(selection.daily_production.measured_at)
            }}；当前快照不能证明全天不间断运行。</small
          >
        </template>
        <p v-else>每日产出尚未读取，暂不显示数量或目标达成状态。</p>
      </section>

      <section v-if="selection?.state === 'not_configured'" class="home-setup-callout">
        <div>
          <b>等待采集来源就绪</b>
          <span>可用来源开始采集后，系统会自动分析情报并寻找商品；关键词监控可按需设置。</span>
        </div>
        <button
          v-if="rulesState === 'ready' && pausedRules.length && canManageRules"
          type="button"
          :disabled="setupBusy"
          @click="resumeRule(pausedRules[0])"
        >
          {{ setupBusy ? "正在恢复…" : "恢复关键词监控" }}
        </button>
        <button
          v-else-if="rulesState === 'ready' && canManageRules"
          type="button"
          :disabled="setupBusy"
          @click="setupOpen = !setupOpen"
        >
          {{ setupOpen ? "收起设置" : "设置关键词监控" }}
        </button>
        <span v-else-if="rulesState === 'loading'">正在核对现有规则…</span>
        <button v-else-if="canManageRules" type="button" @click="load()">重新读取规则</button>
        <RouterLink v-else to="/trends?section=rules">查看规则 →</RouterLink>
      </section>
      <p v-if="rulesState === 'error'" class="home-rules-alert" role="alert">
        选品规则读取失败，请重试。{{ rulesError }}
        <button type="button" @click="load()">重新读取</button>
      </p>
      <p v-if="setupMessage && !mutationFeedback" class="home-setup-message" role="status">
        {{ setupMessage }}
      </p>

      <form
        v-if="setupOpen && canManageRules && rulesState === 'ready'"
        class="home-rule-setup"
        @submit.prevent="createRule"
      >
        <header>
          <div>
            <span>可选监控</span>
            <h3>添加关键词监控</h3>
          </div>
        </header>
        <div class="home-rule-fields">
          <label class="home-rule-keywords">
            <span>想找的商品关键词</span>
            <input
              v-model="setupForm.include_keywords"
              required
              maxlength="500"
              :disabled="setupBusy"
              placeholder="例如：egg washer, egg cleaning brush"
            />
            <small>多个关键词用逗号分隔。</small>
          </label>
          <label>
            <span>目标市场</span>
            <select v-model="setupForm.market" :disabled="setupBusy">
              <option value="US">美国</option>
              <option value="GB">英国</option>
              <option value="DE">德国</option>
              <option value="FR">法国</option>
              <option value="JP">日本</option>
              <option value="KR">韩国</option>
              <option value="AU">澳大利亚</option>
              <option value="CA">加拿大</option>
              <option value="SG">新加坡</option>
              <option value="GLOBAL">全球</option>
            </select>
          </label>
          <label>
            <span>采集频率</span>
            <select v-model.number="setupForm.collection_interval_minutes" :disabled="setupBusy">
              <option :value="15">每 15 分钟</option>
              <option :value="60">每小时</option>
              <option :value="360">每 6 小时</option>
              <option :value="720">每 12 小时</option>
              <option :value="1440">每天</option>
            </select>
          </label>
          <label>
            <span>排除词（可选）</span>
            <input
              v-model="setupForm.negative_keywords"
              maxlength="500"
              :disabled="setupBusy"
              placeholder="例如：used, replacement"
            />
          </label>
          <label>
            <span>商品分类（可选）</span>
            <input
              v-model="setupForm.category"
              maxlength="80"
              :disabled="setupBusy"
              placeholder="例如：Home & Kitchen"
            />
          </label>
        </div>
        <footer>
          <label>
            <span>规则名称（可选）</span>
            <input
              v-model="setupForm.name"
              maxlength="120"
              :disabled="setupBusy"
              placeholder="留空将按第一个关键词命名"
            />
          </label>
          <button type="submit" :disabled="setupBusy">
            {{ setupBusy ? "正在保存…" : "保存关键词监控" }}
          </button>
        </footer>
      </form>

      <div class="home-discovery-layout">
        <section class="home-main-grid" aria-labelledby="home-review-title">
          <section class="home-review-queue so-ledger-surface">
            <header>
              <div>
                <span>01 / 人工决策</span>
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
              <span v-if="item.value_score !== null">{{ score(item.value_score) }} 分</span
              ><b>查看 →</b>
            </RouterLink>
            <div v-if="!selection" class="home-quiet-empty" role="status">
              <b>自动选品数据暂不可用</b>
              <span>推荐与运行统计暂不可用，待办仍可查看。</span>
            </div>
            <div v-else-if="!decisionActions.length" class="home-quiet-empty">
              <b>当前没有待人工采纳的推荐</b
              ><span>{{
                selection.rule_candidate_count > 0
                  ? `${selection.rule_candidate_count} 条选品候选正在完成五项质量门校验。`
                  : selection.awaiting_evidence_count > 0
                    ? `${selection.awaiting_evidence_count} 条商品仍在采集。`
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
        </section>

        <aside class="home-monitoring-rail" aria-label="监听与待办">
          <HomeAutomationOverview v-if="selection" :selection="selection" />
          <section
            v-if="otherActions.length || data?.health.length"
            class="home-operations-strip so-ledger-surface"
          >
            <header>
              <div>
                <span>02 / 本人事项</span>
                <h3>其他待办与异常</h3>
              </div>
              <span>只显示与你有关的事项</span>
            </header>
            <div>
              <RouterLink
                v-for="item in [...otherActions, ...(data?.health ?? [])]"
                :key="`${item.kind}-${item.id}`"
                :to="item.route"
              >
                <i :data-severity="item.severity">{{ item.severity === "critical" ? "!" : "·" }}</i
                ><span
                  ><b>{{ item.title }}</b
                  ><small>{{ item.reason }}</small></span
                ><em>{{ priorityLabel(item.priority) }} →</em>
              </RouterLink>
            </div>
          </section>
        </aside>
      </div>

      <details v-if="selection" class="home-truth">
        <summary>数据说明</summary>
        <div>
          <span>共 {{ total }}条记录</span
          ><span>生成时间 {{ date(data?.generated_at ?? null) }}</span
          ><span>推荐需人工采纳</span>
        </div>
      </details>
      <p v-else class="home-truth-unknown">自动选品统计暂不可用。</p>
    </template>
  </section>
</template>
