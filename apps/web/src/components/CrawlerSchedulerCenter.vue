<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import { statusLabel } from "../ui/status-labels";
import ConfirmDialog from "./ConfirmDialog.vue";
import "../crawler-scheduler.css";

type State =
  | "loading"
  | "ready"
  | "warning"
  | "blocked"
  | "empty"
  | "forbidden"
  | "expired"
  | "rate_limited"
  | "unavailable"
  | "recovering";
interface Dto {
  state: "ready" | "warning" | "blocked";
  topology: {
    mode: "single_host";
    worker_instances: number;
    crawler_instances: number;
    maximum_workers: 1;
    maximum_crawlers: 1;
  };
  leases: {
    active_worker: number;
    active_crawler: number;
    duplicate_count: number;
  };
  active_leases: Array<{
    slot_type: "worker" | "crawler" | "provider";
    provider_name: string | null;
    task_id: string | null;
    task_status: string | null;
    run_id: string | null;
    process_role: "node_worker" | "python_crawler";
    process_ref: string;
    heartbeat_at: string;
    expires_at: string;
  }>;
  providers: Array<{
    id: string;
    code: string;
    configured_concurrency: number;
    effective_concurrency: number;
    active_leases: number;
  }>;
  profiles: Array<{ id: string; active_leases: number }>;
  resource: {
    load_basis_points: number;
    available_memory_mb: number;
    free_disk_mb: number;
    observed_at: string;
  };
  findings: Array<{
    code: string;
    severity: "warning" | "blocked";
    action_hint: string;
  }>;
  observed_at: string;
  capacity_claim: "unverified";
}

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<State>(
  new URLSearchParams(location.search).get("state") === "recovering" ? "recovering" : "loading",
);
const data = ref<Dto | null>(null),
  requestId = ref(""),
  message = ref(""),
  confirming = ref(false),
  saving = ref(false);
const verdict = computed(
  () =>
    (
      ({
        loading: ["正在核验单机调度", "读取进程、租约和来源并发。"],
        recovering: ["正在回收过期租约", "只处理服务端确认已过期的调度槽位。"],
        ready: ["采集调度已就绪", "Node Worker 与 Python Crawler 均为一个实例，来源并发 1。"],
        warning: ["采集调度需要关注", "继续保持来源并发 1，并按告警项处理。"],
        blocked: ["采集调度已阻断", "保持任务排队，按告警动作通过宝塔恢复。"],
        empty: ["尚无调度观测", "确认宝塔 ai选品 统一后端已运行。"],
        forbidden: ["没有平台运维权限", "联系平台管理员授予 platform:operate。"],
        expired: ["登录已失效", "重新登录后核验调度状态。"],
        rate_limited: ["刷新过于频繁", "稍后再试，当前租约不受影响。"],
        unavailable: ["采集调度事实暂不可用", "检查 MySQL、统一后端和受控目录后重试。"],
      }) as const
    )[state.value],
);
const time = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
const processLabel = (value: "node_worker" | "python_crawler") =>
  value === "node_worker" ? "Node Worker" : "Python Crawler";
const status = (kind: ApiFailureKind): State =>
  kind === "expired" || kind === "forbidden" || kind === "rate_limited" ? kind : "unavailable";

async function load() {
  state.value = "loading";
  message.value = "";
  try {
    const response = await request<Dto>("/platform/operations/crawler-scheduler");
    requestId.value = response.request_id;
    data.value = response.data ?? null;
    state.value = data.value ? data.value.state : "empty";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      state.value = status(error.kind);
    } else state.value = "unavailable";
  }
}

async function recover() {
  saving.value = true;
  state.value = "recovering";
  try {
    const response = await request<{ recovered: number }>(
      "/platform/operations/crawler-scheduler/recover-expired",
      { method: "POST", body: {} },
    );
    requestId.value = response.request_id;
    message.value = `已回收 ${response.data.recovered} 个过期调度槽位`;
    await load();
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      state.value = status(error.kind);
    } else state.value = "unavailable";
  } finally {
    saving.value = false;
    confirming.value = false;
  }
}

onMounted(() => {
  if (state.value !== "recovering") void load();
});
</script>

<template>
  <section class="crawler-scheduler" :data-state="state">
    <header class="crawler-scheduler__hero">
      <div>
        <p>单机采集调度</p>
        <h2>运行与配额</h2>
        <span
          >惠州单机由 ai选品 Worker 领取采集任务，宝塔 Python 3.12 项目提供采集心跳与 Playwright
          桥接；来源并发上限 1。</span
        >
      </div>
      <div>
        <button type="button" @click="load">刷新运行事实</button
        ><button class="danger" type="button" :disabled="saving" @click="confirming = true">
          回收过期租约
        </button>
      </div>
    </header>
    <section
      v-if="!['ready', 'warning', 'blocked'].includes(state)"
      class="crawler-scheduler__state"
      :data-kind="state"
      aria-live="polite"
    >
      <i></i>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ message || verdict[1] }}</p>
        <code v-if="requestId">request_id {{ requestId }}</code>
      </div>
      <button v-if="!['loading', 'recovering'].includes(state)" type="button" @click="load">
        重新核验
      </button>
    </section>
    <template v-else-if="data">
      <section class="crawler-scheduler__verdict" :data-verdict="state">
        <div>
          <small>S0 · {{ state.toUpperCase() }}</small
          ><strong>{{ verdict[0] }}</strong>
        </div>
        <p>{{ verdict[1] }}</p>
        <em>统一后端 · 运行就绪</em>
      </section>
      <section class="crawler-scheduler__metrics">
        <article>
          <span>任务处理器</span
          ><strong
            >{{ data.topology.worker_instances }} / {{ data.topology.maximum_workers }}</strong
          ><small>全局任务槽位 {{ data.leases.active_worker }}</small>
        </article>
        <article>
          <span>Python 采集运行时</span
          ><strong
            >{{ data.topology.crawler_instances }} / {{ data.topology.maximum_crawlers }}</strong
          ><small>活动浏览器槽位 {{ data.leases.active_crawler }}</small>
        </article>
        <article>
          <span>重复租约</span><strong>{{ data.leases.duplicate_count }}</strong
          ><small>必须保持为 0</small>
        </article>
        <article>
          <span>已启用来源</span><strong>{{ data.providers.length }}</strong
          ><small>来源并发由调度器统一管理</small>
        </article>
      </section>
      <div class="crawler-scheduler__layout">
        <section class="crawler-scheduler__panel">
          <header>
            <div>
              <p>来源配额</p>
              <h3>来源并发门</h3>
            </div>
            <span>配置值会被单机上限收紧到 1</span>
          </header>
          <div class="crawler-scheduler__sources">
            <article v-for="item in data.providers" :key="item.id">
              <div>
                <b>{{ item.code }}</b
                ><span>{{ item.active_leases }} / {{ item.effective_concurrency }}</span>
              </div>
              <progress
                :value="item.active_leases"
                :max="item.effective_concurrency || 1"
              ></progress
              ><small
                >来源配置 {{ item.configured_concurrency }} · 当前有效
                {{ item.effective_concurrency }}</small
              >
            </article>
            <p v-if="!data.providers.length">当前没有启用来源。</p>
          </div>
        </section>
        <aside class="crawler-scheduler__panel">
          <header>
            <div>
              <p>独占登录档案</p>
              <h3>浏览器档案独占</h3>
            </div>
            <span>{{ data.profiles.length }} 个活动档案</span>
          </header>
          <dl>
            <div>
              <dt>重复租约</dt>
              <dd>{{ data.leases.duplicate_count }}</dd>
            </div>
            <div>
              <dt>独占上限</dt>
              <dd>每档案 1</dd>
            </div>
            <div>
              <dt>全局采集执行器</dt>
              <dd>1</dd>
            </div>
            <div>
              <dt>租约真相</dt>
              <dd>数据库 5.7</dd>
            </div>
          </dl>
        </aside>
      </div>
      <section
        v-if="data.active_leases.length"
        class="crawler-scheduler__panel crawler-scheduler__associations"
      >
        <header>
          <div>
            <p>实时关联</p>
            <h3>租约、进程与采集任务</h3>
          </div>
          <span>{{ data.active_leases.length }} 个活动槽位</span>
        </header>
        <div>
          <article
            v-for="(item, index) in data.active_leases"
            :key="`${item.slot_type}:${item.task_id}:${item.run_id}:${index}`"
          >
            <div>
              <b>{{ processLabel(item.process_role) }}</b>
              <span>{{ item.provider_name || "全局调度槽位" }}</span>
            </div>
            <p>
              采集任务：{{ statusLabel(item.task_status) }} · 最近心跳
              {{ time(item.heartbeat_at) }} · 租约到期 {{ time(item.expires_at) }}
            </p>
            <details>
              <summary>查看技术详情</summary>
              <code>任务 UUID {{ item.task_id || "未关联" }}</code>
              <code>进程标识 {{ item.process_ref }}</code>
              <code>槽位类型 {{ item.slot_type }}</code>
              <code v-if="item.run_id">运行 UUID {{ item.run_id }}</code>
            </details>
          </article>
        </div>
      </section>
      <section class="crawler-scheduler__panel crawler-scheduler__findings">
        <header>
          <div>
            <p>失败时拒绝放行</p>
            <h3>调度告警</h3>
          </div>
          <span>{{ data.findings.length }} 项</span>
        </header>
        <div v-if="data.findings.length">
          <article
            v-for="(item, index) in data.findings"
            :key="item.code"
            :data-severity="item.severity"
          >
            <span>{{ String(index + 1).padStart(2, "0") }}</span
            ><code>{{ item.code }}</code>
            <p>{{ item.action_hint }}</p>
          </article>
        </div>
        <div v-else class="crawler-scheduler__clear">
          <b>当前无采集调度阻断</b><span>Node Worker 与 Python Crawler 均可正常接收任务。</span>
        </div>
      </section>
      <footer>
        <span>运行观测 {{ time(data.observed_at) }}</span
        ><span>request_id {{ requestId || "—" }}</span
        ><strong>服务、重启与有限任务只允许通过宝塔</strong>
      </footer>
    </template>
    <ConfirmDialog
      :open="confirming"
      title="回收过期调度租约？"
      description="仅删除服务端确认已经过期的 Worker、Crawler 与来源调度槽位。"
      impact="不会终止有效任务，不会删除采集历史、审计或浏览器档案。"
      confirm-label="确认回收"
      confirmation-text="确认回收"
      @cancel="confirming = false"
      @confirm="recover"
    />
  </section>
</template>
