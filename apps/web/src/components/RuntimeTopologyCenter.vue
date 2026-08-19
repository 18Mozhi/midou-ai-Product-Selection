<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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
interface TopologyData {
  state: "ready" | "empty" | "blocked" | "stale";
  mode: "single_host";
  active_api_instances: number;
  single_host: true;
  stale_node_count: number;
  nodes: RuntimeNode[];
  blockers: Array<{ code: string; actionHint: string }>;
  load_balancing_enabled: false;
  backup_server_used: false;
  multi_node_claim: false;
  capacity_claim: "unverified";
  observed_at: string;
}

const props = defineProps<{ apiBaseUrl: string }>();
const state = ref<ViewState>("loading");
const data = ref<TopologyData | null>(null);
const requestId = ref("");
const actionHint = ref("");
const verdict = computed(
  () =>
    (
      ({
        loading: [
          "正在读取单机运行事实",
          "核对当前 API 心跳、宝塔托管边界和本机入口。",
        ],
        ready: [
          "单机运行门已满足",
          "当前 API 心跳和主机身份有效；这不是高可用或容量承诺。",
        ],
        empty: ["尚无当前 API 心跳", "先由宝塔管理的 Node API 写入运行心跳。"],
        blocked: [
          "单机运行条件未满足",
          "主机身份或 API 状态不一致，系统保持失败关闭。",
        ],
        stale: [
          "运行心跳已过期",
          "通过宝塔检查并恢复当前 Node API 后重新核验。",
        ],
        forbidden: [
          "没有平台运维权限",
          actionHint.value || "需要 platform:operate 能力。",
        ],
        expired: ["登录已失效", "重新登录后再核验单机运行状态。"],
        rate_limited: ["刷新过于频繁", "稍后重试；现有结论不会因此升级。"],
        unavailable: [
          "运行状态暂不可用",
          actionHint.value || "在宝塔查看 Node API 日志后重试。",
        ],
      }) satisfies Record<ViewState, [string, string]>
    )[state.value],
);
const short = (value?: string) => (value ? value.slice(0, 10) : "—");
const time = (value?: string) =>
  value
    ? new Date(value).toLocaleString("zh-CN", { hour12: false })
    : "尚无记录";

async function load() {
  state.value = "loading";
  actionHint.value = "";
  try {
    const response = await fetch(
      `${props.apiBaseUrl}/platform/operations/topology`,
      { credentials: "include", headers: { accept: "application/json" } },
    );
    const body = await response.json().catch(() => null);
    requestId.value = body?.request_id ?? "";
    actionHint.value = body?.error?.action_hint ?? "";
    if (!response.ok) {
      state.value =
        response.status === 401
          ? "expired"
          : response.status === 403
            ? "forbidden"
            : response.status === 429
              ? "rate_limited"
              : "unavailable";
      return;
    }
    data.value = body.data;
    state.value = body.data.state;
  } catch {
    state.value = "unavailable";
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
        <span
          >长期固定为一台惠州宝塔服务器，不启用负载均衡、备用服务器或多节点模式。</span
        >
      </div>
      <button type="button" @click="load">刷新运行事实</button>
    </header>

    <section
      v-if="state === 'loading'"
      class="topology-state"
      aria-live="polite"
    >
      <span class="topology-pulse" aria-hidden="true"></span>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
      </div>
    </section>
    <section
      v-else-if="
        ['forbidden', 'expired', 'rate_limited', 'unavailable'].includes(state)
      "
      class="topology-state topology-state--danger"
      aria-live="polite"
    >
      <strong aria-hidden="true">!</strong>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
        <code v-if="requestId">request_id {{ requestId }}</code>
      </div>
      <a v-if="state === 'expired'" href="/login">重新登录</a
      ><button v-else type="button" @click="load">重新核验</button>
    </section>

    <template v-else-if="data">
      <section
        class="topology-verdict"
        :data-verdict="state"
        aria-live="polite"
      >
        <div>
          <small>S0 · {{ state.toUpperCase() }}</small
          ><strong>{{ verdict[0] }}</strong>
        </div>
        <p>{{ verdict[1] }}</p>
        <em>单机 · 无高可用承诺</em>
      </section>
      <section class="topology-metrics" aria-label="单机运行指标">
        <article>
          <span>健康后端实例</span
          ><strong>{{ data.active_api_instances }}</strong
          ><small>固定一个本机实例</small>
        </article>
        <article>
          <span>运行主机</span><strong>1</strong><small>惠州宝塔单机</small>
        </article>
        <article>
          <span>过期节点</span><strong>{{ data.stale_node_count }}</strong
          ><small>心跳失败关闭</small>
        </article>
        <article>
          <span>入口模式</span
          ><strong class="topology-metric-word">单上游</strong
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
            <b>没有当前节点可绘制</b
            ><span>由宝塔托管的后端写入真实心跳后再核验。</span>
          </div>
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
              <dd>智能选品统一后端</dd>
            </div>
          </dl>
        </aside>
      </div>

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
            ><code>{{ item.code }}</code>
            <p>{{ item.actionHint }}</p>
          </article>
        </div>
        <div v-else class="topology-clear">
          <b>当前单机运行门无阻断</b
          ><span>后端接口、任务处理器与采集执行器均由统一后端管理。</span>
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
