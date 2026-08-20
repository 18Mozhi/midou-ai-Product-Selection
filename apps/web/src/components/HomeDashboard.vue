<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import AppIcon from "./AppIcon.vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../home-dashboard.css";
import "../home-dashboard-priority.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Item {
  id: string;
  kind: "action" | "change" | "follow" | "health";
  title: string;
  reason: string;
  route: string;
  priority: "overdue" | "blocking" | "high_risk" | "high_value" | "normal" | null;
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
  priorityLabel = (value: Item["priority"]) =>
    ({
      overdue: "逾期",
      blocking: "阻断",
      high_risk: "高风险",
      high_value: "高价值",
      normal: "普通",
    })[value ?? "normal"],
  date = (value: string | null) => (value ? new Date(value).toLocaleString("zh-CN") : "未设置");
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
    /><template v-else
      ><section class="home-hero">
        <div>
          <p>今日已核验范围</p>
          <h2>今天最值得做什么？</h2>
          <span>只汇总当前组织、工作区和本人可见的真实投影。</span>
        </div>
        <dl>
          <div>
            <dt>今日行动</dt>
            <dd>{{ data?.actions.length ?? 0 }}</dd>
          </div>
          <div>
            <dt>异常与健康</dt>
            <dd>{{ data?.health.length ?? 0 }}</dd>
          </div>
        </dl>
      </section>
      <section v-if="state === 'empty'" class="home-empty">
        <div>
          <p>暂无已核验信号</p>
          <h2>当前范围还没有首页数据</h2>
          <span>真实任务、趋势、机会和来源状态写入后会自动出现；现在不展示模拟指标。</span>
        </div>
        <nav>
          <RouterLink to="/opportunities?create=1"
            ><AppIcon name="diamond" /><b>开始一次选品</b
            ><small>进入机会创建入口</small></RouterLink
          ><RouterLink to="/competitors?create=1"
            ><AppIcon name="target" /><b>添加竞品</b><small>进入竞品入口</small></RouterLink
          ><RouterLink to="/sourcing?create=1"
            ><AppIcon name="box" /><b>从 1688 找货</b><small>进入供应链搜索</small></RouterLink
          >
        </nav>
      </section>
      <template v-else>
        <div class="home-priority-grid">
          <section class="home-actions">
            <header>
              <div>
                <p>01 / 优先事项</p>
                <h3>今日行动</h3>
              </div>
              <span>最多 5 项</span>
            </header>
            <RouterLink
              v-for="item in data?.actions"
              :key="item.id"
              :to="item.route"
              :data-priority="item.priority"
              ><i>{{ item.priority === "overdue" ? "!" : "→" }}</i>
              <div>
                <em>{{ priorityLabel(item.priority) }}</em
                ><strong>{{ item.title }}</strong
                ><small>{{ item.reason }}</small>
              </div>
              <dl>
                <div>
                  <dt>负责人</dt>
                  <dd>{{ item.owner_label || "未分配" }}</dd>
                </div>
                <div>
                  <dt>截止</dt>
                  <dd>{{ date(item.due_at) }}</dd>
                </div>
              </dl></RouterLink
            >
          </section>
          <section class="home-health">
            <header>
              <div>
                <p>02 / 异常</p>
                <h3>异常与数据健康</h3>
              </div>
              <span>仅影响本人</span>
            </header>
            <RouterLink
              v-for="item in data?.health"
              :key="item.id"
              :to="item.route"
              :data-severity="item.severity"
              ><i>{{ item.severity === "critical" ? "!" : "i" }}</i>
              <div>
                <strong>{{ item.title }}</strong
                ><small>{{ item.reason }}</small>
              </div>
              <b>去处理 →</b></RouterLink
            >
          </section>
        </div>
        <section class="home-secondary" aria-labelledby="home-secondary-title">
          <header>
            <div>
              <p>后续关注</p>
              <h3 id="home-secondary-title">变化与关注</h3>
            </div>
            <span>完成今日行动和异常处理后再查看</span>
          </header>
          <div class="home-secondary-grid">
            <section class="home-radar">
              <header>
                <div>
                  <p>03 / 信号</p>
                  <h3>变化雷达</h3>
                </div>
                <RouterLink to="/trends">全部变化 →</RouterLink>
              </header>
              <RouterLink v-for="item in data?.changes" :key="item.id" :to="item.route"
                ><i>⌁</i>
                <div>
                  <strong>{{ item.title }}</strong
                  ><small>{{ item.reason }}</small>
                </div>
                <span
                  >{{ item.source_count ?? 0 }} 来源<br />{{ date(item.observed_at)
                  }}<b>去处理 →</b></span
                ></RouterLink
              >
            </section>
            <section class="home-follows">
              <header>
                <div>
                  <p>04 / 关注中</p>
                  <h3>我的关注</h3>
                </div>
              </header>
              <RouterLink v-for="item in data?.follows" :key="item.id" :to="item.route"
                ><i>◎</i>
                <div>
                  <strong>{{ item.title }}</strong
                  ><small>{{ item.reason }}</small>
                </div>
                <span>{{ date(item.observed_at) }}</span></RouterLink
              >
            </section>
          </div>
        </section>
      </template>
      <footer class="home-truth">
        <span>共 {{ total }} 条可见投影</span
        ><span>生成时间 {{ date(data?.generated_at ?? null) }}</span
        ><span>无跨组织、无推测数据</span>
      </footer></template
    >
  </section>
</template>
