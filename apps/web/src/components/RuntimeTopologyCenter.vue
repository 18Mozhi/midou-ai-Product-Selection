<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import "../runtime-topology.css";

type ViewState =
  | "loading"
  | "ready"
  | "empty"
  | "blocked"
  | "stale"
  | "forbidden"
  | "expired"
  | "rate_limited"
  | "unavailable";
interface RuntimeNode {
  node_id: string;
  host_id: string;
  role: string;
  status: string;
  region?: string;
  zone?: string;
  build_sha?: string;
  version?: string;
  last_heartbeat_at: string;
}
interface RuntimeBusinessObjectAssociation {
  type: string;
  id: string;
  label: string;
  href: string | null;
}
interface TopologyData {
  state: "ready" | "empty" | "blocked" | "stale";
  mode: "single_host";
  active_api_instances: number;
  single_host: true;
  stale_node_count: number;
  nodes: RuntimeNode[];
  processes: Array<{
    name: string;
    status: string;
    pid: number | null;
    restart_count: number;
    ready_at: string | null;
    circuit_open_until: string | null;
    last_failure: string | null;
  }>;
  restart_trend: Array<{
    process_name: string;
    status: string;
    restart_count: number;
    restart_delta: number;
    counter_reset: boolean;
    observed_at: string;
  }>;
  health_probes: {
    status: "ready" | "empty" | "unavailable";
    interval_ms: number;
    timeout_ms: number;
    window_minutes: number;
    retention_hours: number;
    endpoints: Array<{
      endpoint: "live" | "ready" | "available";
      sample_count: number;
      success_count: number;
      http_error_count: number;
      timeout_count: number;
      network_error_count: number;
      availability_basis_points: number;
      latency_p50_ms: number | null;
      latency_p95_ms: number | null;
      latency_p99_ms: number | null;
      latency_max_ms: number | null;
      last_status_code: number | null;
      last_outcome: "succeeded" | "http_error" | "timeout" | "network_error" | null;
      last_observed_at: string | null;
    }>;
    observed_at: string;
  } | null;
  worker_scheduler?: {
    status: "running" | "stopping" | "stopped";
    max_concurrency: number;
    active_runs: number;
    due_queue_count: number;
    backpressure: boolean;
    max_queue_delay_ms: number;
    suspected_stuck_runs: number;
    snapshot_publish_failed_total: number;
    last_snapshot_error: string | null;
    completed_last_minute: number;
    failed_last_minute: number;
    failure_rate_percent: number;
    queues: Array<{
      name: string;
      priority: number;
      effective_priority: number;
      aging_interval_ms: number;
      maximum_aging_boost: number;
      max_concurrency: number;
      timeout_ms: number;
      max_retries: number;
      active_runs: number;
      running: boolean;
      queue_delay_ms: number;
      longest_running_ms: number;
      suspected_stuck: boolean;
      circuit_state: "closed" | "open";
      circuit_open_until: string | null;
      consecutive_failures: number;
      failed_total: number;
      timed_out_total: number;
      retry_total: number;
      deferred_total: number;
    }>;
    observed_at: string;
  } | null;
  supervisor_pid: number | null;
  blockers: Array<{ code: string; actionHint: string }>;
  alerts?: Array<{
    code: string;
    severity: "warning" | "critical";
    actionHint: string;
    root_cause_code: string | null;
    queues: string[];
    business_objects: RuntimeBusinessObjectAssociation[];
    occurred_at: string | null;
  }>;
  load_balancing_enabled: false;
  backup_server_used: false;
  multi_node_claim: false;
  capacity_claim: "unverified";
  observed_at: string;
}

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<ViewState>("loading");
const data = ref<TopologyData | null>(null);
const requestId = ref("");
const actionHint = ref("");
const verdict = computed(
  () =>
    (
      ({
        loading: ["正在读取单机运行事实", "核对当前 API 心跳、宝塔托管边界和本机入口。"],
        ready: ["单机运行门已满足", "当前 API 心跳和主机身份有效；这不是高可用或容量承诺。"],
        empty: ["尚无当前 API 心跳", "先由宝塔管理的 Node API 写入运行心跳。"],
        blocked: ["单机运行条件未满足", "主机身份或 API 状态不一致，系统保持失败关闭。"],
        stale: ["运行心跳已过期", "通过宝塔检查并恢复当前 Node API 后重新核验。"],
        forbidden: ["没有平台运维权限", actionHint.value || "需要 platform:operate 能力。"],
        expired: ["登录已失效", "重新登录后再核验单机运行状态。"],
        rate_limited: ["刷新过于频繁", "稍后重试；现有结论不会因此升级。"],
        unavailable: ["运行状态暂不可用", actionHint.value || "在宝塔查看 Node API 日志后重试。"],
      }) satisfies Record<ViewState, [string, string]>
    )[state.value],
);
const short = (value?: string) => (value ? value.slice(0, 10) : "—");
const blockerLabels: Record<string, string> = {
  backend_supervisor_degraded: "后端进程异常",
  runtime_node_missing: "运行节点缺失",
  runtime_node_stale: "运行心跳过期",
  runtime_node_stopped: "运行节点已停止",
  runtime_host_mismatch: "运行主机不一致",
};
const alertLabels: Record<string, string> = {
  worker_scheduler_heartbeat_stale: "任务调度心跳过期",
  worker_scheduler_backpressure: "任务调度发生背压",
  worker_scheduler_recent_failures: "最近一分钟存在失败",
  worker_scheduler_suspected_stuck: "存在疑似卡死任务",
  worker_scheduler_queue_circuit_open: "队列连续失败已熔断",
  worker_scheduler_snapshot_publish_failed: "调度状态写入失败",
  backend_restart_loop: "后端连续重启",
  worker_business_result_failed: "业务处理返回失败",
};
const queueLabels: Record<string, string> = {
  collection_tasks: "采集任务",
  auth_delivery: "账号通知",
  business_task_projection: "业务任务投影",
  approval_escalation: "审批升级",
  notification_outbox: "站内通知",
  webhook_deliveries: "Webhook 投递",
  opportunity_refresh: "机会刷新",
  opportunity_scoring: "机会评分",
  opportunity_profit: "利润计算",
  competitor_monitor: "竞品监控",
  sourcing_projection: "供应链投影",
  trend_projection: "趋势投影",
  ai_analysis: "AI 分析",
  report_exports: "报表导出",
  automation_rules: "自动化规则",
  core_collection_projection: "采集事实投影",
  automatic_rule_sources: "规则采集",
  automatic_full_sources: "全量采集",
};
const healthEndpointLabels = {
  live: "进程存活",
  ready: "同步依赖就绪",
  available: "业务可处理",
} as const;
const healthOutcomeLabels = {
  succeeded: "正常",
  http_error: "接口异常",
  timeout: "探测超时",
  network_error: "连接失败",
} as const;
const queueRows = computed(() =>
  (data.value?.worker_scheduler?.queues ?? []).map((queue) => {
    const agingBoost = Math.max(0, queue.effective_priority - queue.priority);
    const maximumAgingBoost = Math.max(0, queue.maximum_aging_boost ?? 0);
    return {
      ...queue,
      aging_boost: agingBoost,
      starvation_risk:
        !queue.running &&
        queue.queue_delay_ms > 0 &&
        maximumAgingBoost > 0 &&
        agingBoost >= maximumAgingBoost,
    };
  }),
);
const agedQueueCount = computed(
  () => queueRows.value.filter((queue) => queue.aging_boost > 0).length,
);
const starvationRiskCount = computed(
  () => queueRows.value.filter((queue) => queue.starvation_risk).length,
);
const visibleQueues = computed(() => {
  const queues = queueRows.value;
  const exceptional = queues.filter(
    (queue) =>
      queue.running ||
      queue.queue_delay_ms > 0 ||
      queue.failed_total > 0 ||
      queue.suspected_stuck ||
      queue.circuit_state === "open" ||
      queue.starvation_risk,
  );
  return (exceptional.length ? exceptional : queues).slice(0, 18);
});
const restartSeries = computed(() => {
  const samples = data.value?.restart_trend ?? [];
  return ["api", "worker"]
    .map((name) => {
      const rows = samples.filter((sample) => sample.process_name === name);
      return {
        name,
        rows,
        restart_delta: rows.reduce((total, sample) => total + sample.restart_delta, 0),
        counter_resets: rows.filter((sample) => sample.counter_reset).length,
      };
    })
    .filter((series) => series.rows.length);
});
const restartPoints = (rows: TopologyData["restart_trend"]) => {
  const maximum = Math.max(1, ...rows.map((sample) => sample.restart_count));
  return rows
    .map((sample, index) => {
      const x = rows.length === 1 ? 0 : (index / (rows.length - 1)) * 240;
      const y = 56 - (sample.restart_count / maximum) * 48;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
};
const time = (value?: string) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚无记录";

async function load() {
  state.value = "loading";
  actionHint.value = "";
  try {
    const response = await request<TopologyData>("/platform/operations/topology");
    requestId.value = response.request_id;
    data.value = response.data;
    state.value = response.data.state;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      actionHint.value = error.actionHint;
      state.value =
        error.kind === "expired"
          ? "expired"
          : error.kind === "forbidden"
            ? "forbidden"
            : error.kind === "rate_limited"
              ? "rate_limited"
              : "unavailable";
    } else state.value = "unavailable";
  }
}
onMounted(load);
</script>

<template>
  <section class="topology-center" :data-state="state">
    <header class="topology-hero">
      <div>
        <p>单服务器</p>
        <h2>单机运行控制台</h2>
        <span>长期固定为一台惠州宝塔服务器，不启用负载均衡、备用服务器或多节点模式。</span>
      </div>
      <button type="button" @click="load">刷新运行事实</button>
    </header>

    <section v-if="state === 'loading'" class="topology-state" aria-live="polite">
      <span class="topology-pulse" aria-hidden="true"></span>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
      </div>
    </section>
    <section
      v-else-if="['forbidden', 'expired', 'rate_limited', 'unavailable'].includes(state)"
      class="topology-state topology-state--danger"
      aria-live="polite"
    >
      <strong aria-hidden="true">!</strong>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
        <code v-if="requestId">request_id {{ requestId }}</code>
      </div>
      <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
      ><button v-else type="button" @click="load">重新核验</button>
    </section>

    <template v-else-if="data">
      <section class="topology-verdict" :data-verdict="state" aria-live="polite">
        <div>
          <small>S0 · {{ state.toUpperCase() }}</small
          ><strong>{{ verdict[0] }}</strong>
        </div>
        <p>{{ verdict[1] }}</p>
        <em>单机 · 无高可用承诺</em>
      </section>
      <section class="topology-metrics" aria-label="单机运行指标">
        <article>
          <span>健康后端实例</span><strong>{{ data.active_api_instances }}</strong
          ><small>固定一个本机实例</small>
        </article>
        <article><span>运行主机</span><strong>1</strong><small>惠州宝塔单机</small></article>
        <article>
          <span>过期节点</span><strong>{{ data.stale_node_count }}</strong
          ><small>心跳失败关闭</small>
        </article>
        <article>
          <span>入口模式</span><strong class="topology-metric-word">单上游</strong
          ><small>不做负载均衡</small>
        </article>
      </section>

      <div class="topology-layout">
        <section class="topology-panel topology-map">
          <header>
            <div>
              <p>实时拓扑</p>
              <h3>网站与本机后端</h3>
            </div>
            <span>{{ data.nodes.length }} 个当前节点</span>
          </header>
          <div v-if="data.nodes.length" class="topology-flow">
            <div class="topology-entry">
              <i>网站</i><b>宝塔网页服务</b><small>单上游反向代理</small>
            </div>
            <div class="topology-rail" aria-hidden="true"><span></span></div>
            <div class="topology-nodes">
              <article
                v-for="node in data.nodes"
                :key="node.node_id"
                :data-node-state="node.status"
              >
                <div>
                  <i>后端</i><span>{{ node.status }}</span>
                </div>
                <h4>{{ node.node_id }}</h4>
                <dl>
                  <div>
                    <dt>主机</dt>
                    <dd>{{ node.host_id }}</dd>
                  </div>
                  <div>
                    <dt>区域</dt>
                    <dd>
                      {{ node.region || "未登记" }} /
                      {{ node.zone || "未登记" }}
                    </dd>
                  </div>
                  <div>
                    <dt>构建</dt>
                    <dd>{{ short(node.build_sha) }}</dd>
                  </div>
                </dl>
                <small>心跳 {{ time(node.last_heartbeat_at) }}</small>
              </article>
            </div>
          </div>
          <div v-else class="topology-empty">
            <b>没有当前节点可绘制</b><span>由宝塔托管的后端写入真实心跳后再核验。</span>
          </div>
          <section v-if="data.processes.length" class="topology-processes">
            <header>
              <div>
                <p>进程监督</p>
                <h3>API 与 Worker</h3>
              </div>
              <small>监督器 PID {{ data.supervisor_pid ?? "—" }}</small>
            </header>
            <article
              v-for="process in data.processes"
              :key="process.name"
              :data-node-state="process.status"
            >
              <span
                ><b>{{ process.name === "api" ? "Node API" : "Node Worker" }}</b
                ><small>{{ process.status }}</small></span
              >
              <dl>
                <div>
                  <dt>PID</dt>
                  <dd>{{ process.pid ?? "—" }}</dd>
                </div>
                <div>
                  <dt>重启次数</dt>
                  <dd>{{ process.restart_count }}</dd>
                </div>
                <div>
                  <dt>真实就绪</dt>
                  <dd>{{ process.ready_at ? time(process.ready_at) : "尚未就绪" }}</dd>
                </div>
              </dl>
              <p v-if="process.circuit_open_until">熔断至 {{ time(process.circuit_open_until) }}</p>
              <details v-if="process.last_failure">
                <summary>最近失败</summary>
                <code>{{ process.last_failure }}</code>
              </details>
            </article>
            <div v-if="restartSeries.length" class="topology-restart-trends">
              <article v-for="series in restartSeries" :key="series.name">
                <header>
                  <span
                    ><b>{{ series.name === "api" ? "Node API" : "Node Worker" }}</b
                    ><small>最近 24 小时 · 五分钟观测桶</small></span
                  >
                  <strong>新增重启 {{ series.restart_delta }}</strong>
                </header>
                <svg
                  viewBox="0 0 240 64"
                  role="img"
                  :aria-label="`${series.name} 最近 24 小时累计重启趋势`"
                  preserveAspectRatio="none"
                >
                  <line x1="0" y1="56" x2="240" y2="56" />
                  <polyline :points="restartPoints(series.rows)" />
                </svg>
                <footer>
                  <span>{{ series.rows.length }} 个真实观测</span>
                  <span v-if="series.counter_resets"
                    >计数器重置 {{ series.counter_resets }} 次</span
                  >
                  <span v-else>未发现计数器重置</span>
                  <span>最新 {{ time(series.rows.at(-1)?.observed_at) }}</span>
                </footer>
              </article>
            </div>
          </section>
          <section v-if="data.health_probes" class="topology-health-probes">
            <header>
              <div>
                <p>连续探测</p>
                <h3>健康接口耗时分位数</h3>
              </div>
              <span :data-node-state="data.health_probes.status">
                {{
                  data.health_probes.status === "ready"
                    ? "持续观测中"
                    : data.health_probes.status === "empty"
                      ? "等待首轮样本"
                      : "观测不可用"
                }}
              </span>
            </header>
            <div v-if="data.health_probes.endpoints.length" class="topology-health-grid">
              <article
                v-for="endpoint in data.health_probes.endpoints"
                :key="endpoint.endpoint"
                :data-probe-outcome="endpoint.last_outcome || 'empty'"
              >
                <header>
                  <span
                    ><b>{{ healthEndpointLabels[endpoint.endpoint] }}</b
                    ><small>/health/{{ endpoint.endpoint }}</small></span
                  >
                  <strong>{{
                    endpoint.last_outcome ? healthOutcomeLabels[endpoint.last_outcome] : "尚无样本"
                  }}</strong>
                </header>
                <dl>
                  <div>
                    <dt>P50</dt>
                    <dd>{{ endpoint.latency_p50_ms ?? "—" }} ms</dd>
                  </div>
                  <div>
                    <dt>P95</dt>
                    <dd>{{ endpoint.latency_p95_ms ?? "—" }} ms</dd>
                  </div>
                  <div>
                    <dt>P99</dt>
                    <dd>{{ endpoint.latency_p99_ms ?? "—" }} ms</dd>
                  </div>
                  <div>
                    <dt>超时</dt>
                    <dd>{{ endpoint.timeout_count }}</dd>
                  </div>
                </dl>
                <footer>
                  <span>可用率 {{ (endpoint.availability_basis_points / 100).toFixed(2) }}%</span>
                  <span>{{ endpoint.sample_count }} 个样本</span>
                  <span>最近 HTTP {{ endpoint.last_status_code ?? "—" }}</span>
                </footer>
              </article>
            </div>
            <div v-else class="topology-empty">
              <b>连续探测样本暂不可用</b>
              <span>运行拓扑仍保留心跳事实；检查迁移和 Node API 日志后重试。</span>
            </div>
            <small>
              最近 {{ data.health_probes.window_minutes }} 分钟 · 每
              {{ Math.round(data.health_probes.interval_ms / 1000) }} 秒 · 超时门
              {{ data.health_probes.timeout_ms }} ms · 样本保留
              {{ data.health_probes.retention_hours }} 小时
            </small>
          </section>
          <section v-if="data.worker_scheduler" class="topology-scheduler">
            <header>
              <div>
                <p>统一调度</p>
                <h3>队列老化与实际调度延迟</h3>
              </div>
              <span :data-node-state="data.worker_scheduler.status">{{
                data.worker_scheduler.status === "running" ? "运行中" : "未运行"
              }}</span>
            </header>
            <dl class="topology-scheduler-metrics">
              <div>
                <dt>活动任务</dt>
                <dd>
                  {{ data.worker_scheduler.active_runs }} /
                  {{ data.worker_scheduler.max_concurrency }}
                </dd>
              </div>
              <div>
                <dt>等待调度</dt>
                <dd>{{ data.worker_scheduler.due_queue_count }}</dd>
              </div>
              <div>
                <dt>最长延迟</dt>
                <dd>{{ data.worker_scheduler.max_queue_delay_ms }} ms</dd>
              </div>
              <div>
                <dt>一分钟失败率</dt>
                <dd>{{ data.worker_scheduler.failure_rate_percent }}%</dd>
              </div>
              <div>
                <dt>疑似卡死</dt>
                <dd>{{ data.worker_scheduler.suspected_stuck_runs }}</dd>
              </div>
              <div>
                <dt>已老化队列</dt>
                <dd>{{ agedQueueCount }}</dd>
              </div>
              <div>
                <dt>饥饿风险</dt>
                <dd>{{ starvationRiskCount }}</dd>
              </div>
            </dl>
            <div class="topology-queue-list">
              <article
                v-for="queue in visibleQueues"
                :key="queue.name"
                :data-queue-alert="
                  queue.suspected_stuck || queue.circuit_state === 'open' || queue.starvation_risk
                "
              >
                <span
                  ><b>{{ queueLabels[queue.name] ?? "后台任务" }}</b
                  ><small
                    >基础优先级 {{ queue.priority }} · 有效优先级
                    {{ queue.effective_priority }}</small
                  ></span
                >
                <span
                  ><b>{{
                    queue.circuit_state === "open"
                      ? "已熔断"
                      : queue.suspected_stuck
                        ? "疑似卡死"
                        : queue.running
                          ? "处理中"
                          : queue.queue_delay_ms > 0
                            ? "等待中"
                            : "空闲"
                  }}</b
                  ><small v-if="queue.running">运行 {{ queue.longest_running_ms }} ms</small
                  ><small v-else>实际调度延迟 {{ queue.queue_delay_ms }} ms</small></span
                >
                <span class="topology-queue-aging" :data-risk="queue.starvation_risk"
                  ><b>{{
                    queue.starvation_risk
                      ? "饥饿风险"
                      : queue.aging_boost > 0
                        ? "老化保护中"
                        : "尚未老化"
                  }}</b
                  ><small v-if="queue.aging_boost > 0"
                    >优先级已提升 {{ queue.aging_boost }} / {{ queue.maximum_aging_boost }}</small
                  ><small v-else>每 {{ queue.aging_interval_ms || "—" }} ms 检查一次</small></span
                >
                <details>
                  <summary>调度策略</summary>
                  <small
                    >并发 {{ queue.active_runs }}/{{ queue.max_concurrency }} · 超时
                    {{ queue.timeout_ms }} ms · 重试 {{ queue.retry_total }}/{{
                      queue.max_retries
                    }}
                    · 连续失败 {{ queue.consecutive_failures }}</small
                  >
                </details>
              </article>
            </div>
            <details v-if="data.worker_scheduler.snapshot_publish_failed_total">
              <summary>状态文件异常</summary>
              <code>{{ data.worker_scheduler.last_snapshot_error || "写入失败" }}</code>
            </details>
            <small>观测 {{ time(data.worker_scheduler.observed_at) }}</small>
          </section>
        </section>

        <aside class="topology-panel topology-evidence">
          <header>
            <div>
              <p>运行边界</p>
              <h3>单机运行边界</h3>
            </div>
          </header>
          <dl>
            <div>
              <dt>管理边界</dt>
              <dd>宝塔面板</dd>
            </div>
            <div>
              <dt>拓扑模式</dt>
              <dd>单机</dd>
            </div>
            <div>
              <dt>负载均衡</dt>
              <dd>{{ data.load_balancing_enabled ? "已启用" : "未启用" }}</dd>
            </div>
            <div>
              <dt>多节点声明</dt>
              <dd>{{ data.multi_node_claim ? "是" : "否" }}</dd>
            </div>
            <div>
              <dt>备用服务器</dt>
              <dd>{{ data.backup_server_used ? "已使用" : "未使用" }}</dd>
            </div>
            <div>
              <dt>运行方式</dt>
              <dd>宝塔 Node + Python</dd>
            </div>
          </dl>
        </aside>
      </div>

      <section v-if="data.alerts?.length" class="topology-panel topology-alerts">
        <header>
          <div>
            <p>需要处理</p>
            <h3>运行告警</h3>
          </div>
          <span>{{ data.alerts.length }} 项</span>
        </header>
        <article
          v-for="item in data.alerts"
          :key="`${item.code}:${item.queues.join(',')}:${item.root_cause_code || ''}`"
          :data-severity="item.severity"
        >
          <strong>{{ alertLabels[item.code] ?? "运行状态异常" }}</strong>
          <p>{{ item.actionHint }}</p>
          <div v-if="item.queues.length" class="topology-alert-associations">
            <span>关联队列</span>
            <b v-for="queue in item.queues" :key="queue">{{ queueLabels[queue] ?? "后台任务" }}</b>
          </div>
          <div v-if="item.business_objects.length" class="topology-alert-associations">
            <span>关联业务对象</span>
            <template v-for="object in item.business_objects" :key="`${object.type}:${object.id}`">
              <RouterLink v-if="object.href" :to="object.href"
                >{{ object.label }} · {{ short(object.id) }}</RouterLink
              >
              <b v-else>{{ object.label }} · {{ short(object.id) }}</b>
            </template>
          </div>
          <small v-if="item.occurred_at">发生于 {{ time(item.occurred_at) }}</small>
          <details>
            <summary>技术详情</summary>
            <code>{{ item.code }}</code>
            <code v-if="item.root_cause_code">root_cause {{ item.root_cause_code }}</code>
            <code v-for="object in item.business_objects" :key="object.id">
              {{ object.type }} {{ object.id }}
            </code>
          </details>
        </article>
      </section>

      <section class="topology-panel topology-blockers">
        <header>
          <div>
            <p>失败时拒绝放行</p>
            <h3>阻断项</h3>
          </div>
          <span>{{ data.blockers.length }} 项</span>
        </header>
        <div v-if="data.blockers.length">
          <article v-for="(item, index) in data.blockers" :key="item.code">
            <span>{{ String(index + 1).padStart(2, "0") }}</span
            ><strong>{{ blockerLabels[item.code] ?? "运行条件未满足" }}</strong>
            <p>{{ item.actionHint }}</p>
            <details>
              <summary>技术详情</summary>
              <code>{{ item.code }}</code>
            </details>
          </article>
        </div>
        <div v-else class="topology-clear">
          <b>当前单机运行门无阻断</b
          ><span>Node 后端负责 API 与 Worker，Python 项目负责采集桥接。</span>
        </div>
      </section>
      <footer class="topology-footer">
        <span>观测 {{ time(data.observed_at) }}</span
        ><span>request_id {{ requestId || "—" }}</span
        ><strong>重启、恢复与回滚只允许通过宝塔执行</strong>
      </footer>
    </template>
  </section>
</template>
