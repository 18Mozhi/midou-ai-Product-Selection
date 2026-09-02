<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
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
    recommended_count: number;
    awaiting_evidence_count: number;
    adopted_count: number;
    last_collection_at: string | null;
    next_collection_at: string | null;
  };
  scope: { organization_id: string; workspace_id: string };
  generated_at: string;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  data = ref<Summary | null>(null),
  requestId = ref(""),
  traceId = ref(""),
  actionHint = ref("");
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
        recommended_count: 0,
        awaiting_evidence_count: 0,
        adopted_count: 0,
        last_collection_at: null,
        next_collection_at: null,
      },
  ),
  decisionActions = computed(() =>
    (data.value?.actions ?? []).filter((item) => item.source_module === "opportunity"),
  ),
  otherActions = computed(() =>
    (data.value?.actions ?? []).filter((item) => item.source_module !== "opportunity"),
  ),
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
          <RouterLink class="home-secondary-action" to="/trends?tab=rules">管理规则</RouterLink>
          <RouterLink class="home-primary-action" to="/opportunities">查看推荐清单</RouterLink>
        </nav>
      </header>

      <section v-if="selection.state === 'not_configured'" class="home-setup-callout">
        <div>
          <b>先设置第一条选品规则</b
          ><span>填写市场、关键词、排除词和监控周期，系统才会开始全天候发现商品。</span>
        </div>
        <RouterLink to="/trends?tab=rules">设置规则 →</RouterLink>
      </section>

      <section class="home-selection-metrics" aria-label="自动选品状态">
        <article>
          <span>运行规则</span><strong>{{ selection.enabled_rule_count }}</strong
          ><small>持续监控</small>
        </article>
        <article>
          <span>规则候选</span><strong>{{ selection.candidate_count }}</strong
          ><small>等待补证或决策</small>
        </article>
        <article data-tone="positive">
          <span>系统推荐</span><strong>{{ selection.recommended_count }}</strong
          ><small>等待人工采纳</small>
        </article>
        <article>
          <span>已采纳</span><strong>{{ selection.adopted_count }}</strong
          ><small>人工最终确认</small>
        </article>
      </section>

      <section class="home-main-grid">
        <section class="home-review-queue">
          <header>
            <div>
              <span>需要你决定</span>
              <h3>推荐清单</h3>
            </div>
            <RouterLink to="/opportunities">全部 {{ selection.candidate_count }} 条 →</RouterLink>
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
              selection.awaiting_evidence_count
                ? `${selection.awaiting_evidence_count} 条候选正在自动补证。`
                : "系统会在规则命中后自动加入这里。"
            }}</span>
          </div>
        </section>

        <aside class="home-automation-status">
          <header>
            <span>自动流程</span>
            <h3>系统正在做什么</h3>
          </header>
          <ol>
            <li data-done="true">
              <i>1</i>
              <div>
                <b>监控平台</b><span>{{ selection.enabled_rule_count }} 条规则运行中</span>
              </div>
            </li>
            <li :data-done="selection.candidate_count > 0">
              <i>2</i>
              <div>
                <b>筛出候选</b><span>已发现 {{ selection.candidate_count }} 条</span>
              </div>
            </li>
            <li :data-done="selection.recommended_count > 0">
              <i>3</i>
              <div>
                <b>补证与评分</b><span>{{ selection.awaiting_evidence_count }} 条仍在补证</span>
              </div>
            </li>
            <li :data-done="selection.adopted_count > 0">
              <i>4</i>
              <div>
                <b>人工采纳</b><span>已确认 {{ selection.adopted_count }} 条</span>
              </div>
            </li>
          </ol>
          <dl>
            <div>
              <dt>上次采集</dt>
              <dd>{{ date(selection.last_collection_at) }}</dd>
            </div>
            <div>
              <dt>下次采集</dt>
              <dd>{{ date(selection.next_collection_at) }}</dd>
            </div>
          </dl>
        </aside>
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

      <footer class="home-truth">
        <span>共 {{ total }} 条可见投影</span
        ><span>生成时间 {{ date(data?.generated_at ?? null) }}</span
        ><span>自动推荐不等于自动采纳</span>
      </footer></template
    >
  </section>
</template>
