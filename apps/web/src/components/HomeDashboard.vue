<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../home-dashboard.css";
type State =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Item {
  id: string;
  kind: "action" | "change" | "follow" | "health";
  title: string;
  reason: string;
  route: string;
  priority:
    "overdue" | "blocking" | "high_risk" | "high_value" | "normal" | null;
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
  state = ref<State>("loading"),
  data = ref<Summary | null>(null),
  requestId = ref("");
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
  date = (value: string | null) =>
    value ? new Date(value).toLocaleString("zh-CN") : "未设置";
async function load() {
  state.value = "loading";
  requestId.value = "";
  try {
    const response = await fetch(`${props.apiBaseUrl}/me/home-dashboard`, {
        credentials: "include",
        headers: { accept: "application/json" },
      }),
      body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    if (!response.ok) {
      state.value =
        response.status === 401
          ? "expired"
          : response.status === 403
            ? "forbidden"
            : [408, 429, 502, 503, 504].includes(response.status)
              ? "blocked"
              : "error";
      return;
    }
    data.value = body.data;
    state.value =
      body.data.actions.length +
      body.data.changes.length +
      body.data.follows.length +
      body.data.health.length
        ? "ready"
        : "empty";
  } catch {
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
            <dt>值得关注</dt>
            <dd>
              {{ (data?.changes.length ?? 0) + (data?.follows.length ?? 0) }}
            </dd>
          </div>
          <div>
            <dt>健康提示</dt>
            <dd>{{ data?.health.length ?? 0 }}</dd>
          </div>
        </dl>
      </section>
      <section class="home-overview" aria-label="选品流程数据总览">
        <header><div><p>全链路总览</p><h3>从全网信号到可执行选品</h3></div><a href="/automations">设置持续采集规则 →</a></header>
        <div><article><i>↗</i><span>热点变化</span><b>{{ data?.changes.length ?? 0 }}</b><small>全网信号进入趋势池</small></article><article><i>◇</i><span>待办分析</span><b>{{ data?.actions.length ?? 0 }}</b><small>需要继续验证的机会</small></article><article><i>◎</i><span>持续关注</span><b>{{ data?.follows.length ?? 0 }}</b><small>竞品与机会动态</small></article><article><i>▣</i><span>数据提醒</span><b>{{ data?.health.length ?? 0 }}</b><small>证据、采集与完整度</small></article></div>
        <ol><li><b>1</b><span>按规则定时抓取</span></li><li><b>2</b><span>识别商品与热点</span></li><li><b>3</b><span>匹配竞品和货源</span></li><li><b>4</b><span>计算利润与风险</span></li><li><b>5</b><span>保留证据再决策</span></li></ol>
      </section>
      <section v-if="state === 'empty'" class="home-empty">
        <div>
          <p>暂无已核验信号</p>
          <h2>当前范围还没有首页数据</h2>
          <span
            >真实任务、趋势、机会和来源状态写入后会自动出现；现在不展示模拟指标。</span
          >
        </div>
        <nav>
          <a href="/opportunities?create=1"
            >◇<b>开始一次选品</b><small>进入机会创建入口</small></a
          ><a href="/competitors?create=1"
            >◎<b>添加竞品</b><small>进入竞品入口</small></a
          ><a href="/sourcing?create=1"
            >▣<b>从 1688 找货</b><small>进入供应链搜索</small></a
          >
        </nav>
      </section>
      <div v-else class="home-grid">
        <section class="home-actions">
          <header>
            <div>
              <p>01 / 优先事项</p>
              <h3>今日行动</h3>
            </div>
            <span>最多 5 项</span>
          </header>
          <a
            v-for="item in data?.actions"
            :key="item.id"
            :href="item.route"
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
            </dl></a
          >
        </section>
        <section class="home-radar">
          <header>
            <div>
              <p>02 / 信号</p>
              <h3>变化雷达</h3>
            </div>
            <a href="/trends">全部变化 →</a>
          </header>
          <a v-for="item in data?.changes" :key="item.id" :href="item.route"
            ><i>⌁</i>
            <div>
              <strong>{{ item.title }}</strong
              ><small>{{ item.reason }}</small>
            </div>
            <span
              >{{ item.source_count ?? 0 }} 来源<br />{{
                date(item.observed_at)
              }}</span
            ></a
          >
        </section>
        <section class="home-follows">
          <header>
            <div>
              <p>03 / 关注中</p>
              <h3>我的关注</h3>
            </div>
          </header>
          <a v-for="item in data?.follows" :key="item.id" :href="item.route"
            ><i>◎</i>
            <div>
              <strong>{{ item.title }}</strong
              ><small>{{ item.reason }}</small>
            </div>
            <span>{{ date(item.observed_at) }}</span></a
          >
        </section>
        <section class="home-health">
          <header>
            <div>
              <p>04 / 可信度</p>
              <h3>数据健康提示</h3>
            </div>
            <span>仅影响本人</span>
          </header>
          <a
            v-for="item in data?.health"
            :key="item.id"
            :href="item.route"
            :data-severity="item.severity"
            ><i>{{ item.severity === "critical" ? "!" : "i" }}</i>
            <div>
              <strong>{{ item.title }}</strong
              ><small>{{ item.reason }}</small>
            </div>
            <b>去处理 →</b></a
          >
        </section>
      </div>
      <footer class="home-truth">
        <span>共 {{ total }} 条可见投影</span
        ><span>生成时间 {{ date(data?.generated_at ?? null) }}</span
        ><span>无跨组织、无推测数据</span>
      </footer></template
    >
  </section>
</template>
