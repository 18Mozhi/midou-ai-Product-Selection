<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
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
  data = ref<Summary | null>(null),
  requestId = ref(""),
  traceId = ref(""),
  actionHint = ref(""),
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
const total = computed(() =>
    data.value
      ? data.value.actions.length +
        data.value.changes.length +
        data.value.follows.length +
        data.value.health.length
      : 0,
  ),
  selection = computed(
    () =>
      data.value?.automatic_selection ?? {
        state: "not_configured" as const,
        enabled_rule_count: 0,
        candidate_count: 0,
        rule_candidate_count: 0,
        recommended_count: 0,
        awaiting_evidence_count: 0,
        adopted_count: 0,
        recommended_items: [],
        last_collection_at: null,
        next_collection_at: null,
      },
  ),
  decisionActions = computed(() => selection.value.recommended_items ?? []),
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
  state.value = "loading";
  requestId.value = "";
  traceId.value = "";
  actionHint.value = "";
  try {
    const response = await request<Summary>("/me/home-dashboard");
    requestId.value = response.request_id;
    traceId.value = response.trace_id;
    data.value = response.data;
    try {
      const ruleResponse = await request<Rule[]>("/trends/monitoring-rules");
      rules.value = ruleResponse.data;
    } catch {
      rules.value = [];
    }
    if (
      canManageRules.value &&
      response.data.automatic_selection?.state === "not_configured" &&
      !rules.value.length
    )
      setupOpen.value = true;
    state.value =
      response.data.actions.length +
      response.data.changes.length +
      response.data.follows.length +
      response.data.health.length
        ? "ready"
        : response.data.automatic_selection?.state === "running"
          ? "ready"
          : "empty";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      traceId.value = error.traceId;
      actionHint.value = error.actionHint;
      state.value = failure(error.kind);
      return;
    }
    actionHint.value = "网络连接异常，请稍后重试。";
    state.value = "blocked";
  }
}
const keywordList = (value: string) =>
  value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
async function createRule() {
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
    setupMessage.value = "规则已启用，系统会立即开始首轮采集。";
    await load();
  } catch (error) {
    setupMessage.value =
      error instanceof ApiClientError ? error.actionHint : "暂时无法保存，请稍后重试。";
  } finally {
    setupBusy.value = false;
  }
}
async function resumeRule(item: Rule | undefined) {
  if (!item || !canManageRules.value) return;
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
    setupMessage.value = `“${item.name}”已恢复，系统会立即开始采集。`;
    await load();
  } catch (error) {
    setupMessage.value =
      error instanceof ApiClientError ? error.actionHint : "暂时无法恢复，请稍后重试。";
  } finally {
    setupBusy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="home-dashboard" :data-state="state">
    <UiStatePanel
      v-if="state !== 'ready' && state !== 'empty'"
      :kind="state"
      :request-id="requestId"
      :trace-id="traceId"
      :action-hint="actionHint"
      primary-label="重新读取"
      @primary="load"
    /><template v-else>
      <header class="home-command-bar">
        <div>
          <span class="home-system-state" :data-state="selection.state">
            <i></i
            >{{
              selection.state === "running"
                ? "自动选品运行中"
                : selection.state === "attention"
                  ? "自动选品需检查"
                  : "自动选品未配置"
            }}
          </span>
          <h2>选品控制台</h2>
          <p>系统持续发现和补证，你只负责最终采纳。</p>
        </div>
        <nav>
          <RouterLink class="home-secondary-action" to="/trends?section=rules">管理规则</RouterLink>
          <RouterLink class="home-primary-action" to="/opportunities">查看推荐清单</RouterLink>
        </nav>
      </header>

      <section v-if="selection.state === 'not_configured'" class="home-setup-callout">
        <div>
          <b>{{ pausedRules.length ? "自动选品当前已暂停" : "先告诉系统要找什么" }}</b
          ><span>{{
            pausedRules.length
              ? "恢复已有规则后，系统会继续采集；达到来源门槛先进入候选，五项质量门全部通过后才推荐。"
              : "设置市场、关键词和来源门槛后，系统会持续发现候选；五项质量门全部通过后才推荐。"
          }}</span>
        </div>
        <button
          v-if="pausedRules.length && canManageRules"
          type="button"
          :disabled="setupBusy"
          @click="resumeRule(pausedRules[0])"
        >
          {{ setupBusy ? "正在恢复…" : "恢复自动选品" }}
        </button>
        <button v-else-if="canManageRules" type="button" @click="setupOpen = !setupOpen">
          {{ setupOpen ? "收起设置" : "开始设置" }}
        </button>
        <RouterLink v-else to="/trends?section=rules">查看规则 →</RouterLink>
      </section>
      <p v-if="setupMessage" class="home-setup-message" role="status">{{ setupMessage }}</p>

      <form v-if="setupOpen && canManageRules" class="home-rule-setup" @submit.prevent="createRule">
        <header>
          <div>
            <span>首次设置</span>
            <h3>创建自动选品规则</h3>
          </div>
          <small>推荐由真实商品证据触发，最终采纳始终由你决定。</small>
        </header>
        <div class="home-rule-fields">
          <label class="home-rule-keywords">
            <span>想找的商品关键词</span>
            <input
              v-model="setupForm.include_keywords"
              required
              maxlength="500"
              placeholder="例如：egg washer, egg cleaning brush"
            />
            <small>多个关键词用逗号分隔。</small>
          </label>
          <label>
            <span>目标市场</span>
            <select v-model="setupForm.market">
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
            <select v-model.number="setupForm.collection_interval_minutes">
              <option :value="15">每 15 分钟</option>
              <option :value="60">每小时</option>
              <option :value="360">每 6 小时</option>
              <option :value="720">每 12 小时</option>
              <option :value="1440">每天</option>
            </select>
          </label>
          <label>
            <span>形成候选的来源门槛</span>
            <select v-model.number="setupForm.recommendation_min_source_count">
              <option :value="1">命中 1 个真实来源</option>
              <option :value="2">至少 2 个独立来源</option>
              <option :value="3">至少 3 个独立来源</option>
            </select>
          </label>
          <label>
            <span>排除词（可选）</span>
            <input
              v-model="setupForm.negative_keywords"
              maxlength="500"
              placeholder="例如：used, replacement"
            />
          </label>
          <label>
            <span>商品分类（可选）</span>
            <input v-model="setupForm.category" maxlength="80" placeholder="例如：Home & Kitchen" />
          </label>
        </div>
        <footer>
          <label>
            <span>规则名称（可选）</span>
            <input
              v-model="setupForm.name"
              maxlength="120"
              placeholder="留空将按第一个关键词命名"
            />
          </label>
          <button type="submit" :disabled="setupBusy">
            {{ setupBusy ? "正在启用…" : "保存并开始自动选品" }}
          </button>
        </footer>
      </form>

      <HomeAutomationOverview :selection="selection" />

      <section class="home-main-grid">
        <section class="home-review-queue">
          <header>
            <div>
              <span>需要你决定</span>
              <h3>推荐清单</h3>
            </div>
            <RouterLink to="/opportunities">全部 {{ selection.recommended_count }} 条 →</RouterLink>
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
          <div v-if="!decisionActions.length" class="home-quiet-empty">
            <b>当前没有待人工采纳的推荐</b
            ><span>{{
              selection.rule_candidate_count
                ? `${selection.rule_candidate_count} 条规则命中候选正在完成五项质量门校验。`
                : selection.awaiting_evidence_count
                  ? `${selection.awaiting_evidence_count} 条商品仍在采集。`
                  : "系统会在五项质量门全部通过后自动加入这里。"
            }}</span>
            <RouterLink
              v-if="selection.rule_candidate_count"
              to="/opportunities?view=rule_candidates"
              >查看候选进度</RouterLink
            >
            <RouterLink
              v-else-if="selection.awaiting_evidence_count"
              to="/opportunities?view=evidence_pending"
              >查看采集进度</RouterLink
            >
          </div>
        </section>
      </section>

      <section v-if="otherActions.length || data?.health.length" class="home-operations-strip">
        <header>
          <h3>其他待办与异常</h3>
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

      <details class="home-truth">
        <summary>数据说明</summary>
        <div>
          <span>共 {{ total }} 条可见投影</span
          ><span>生成时间 {{ date(data?.generated_at ?? null) }}</span
          ><span>自动推荐不等于自动采纳</span>
        </div>
      </details></template
    >
  </section>
</template>
