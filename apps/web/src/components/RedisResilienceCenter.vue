<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { RedisResilienceDto } from "@scoutops/contracts";
import { ApiClientError, createApiClient } from "../api-client";
import "../redis-resilience.css";

type ViewState =
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
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<ViewState>("loading"),
  data = ref<RedisResilienceDto | null>(null),
  requestId = ref(""),
  actionHint = ref("");
const verdict = computed(
  () =>
    (
      ({
        loading: ["正在读取单 Redis 运行事实", "核对持久化、内存上限、连接上限与最近错误。"],
        ready: ["单 Redis 韧性门已满足", "AOF/RDB、资源上限和失败关闭规则均通过。"],
        warning: ["Redis 资源接近预警线", "当前仍可用，但需检查增长、积压和连接使用。"],
        blocked: ["Redis 韧性门已阻断", "停止依赖 Redis 的新操作，并通过宝塔按阻断项恢复。"],
        empty: ["尚无 Redis 观测", "确认宝塔 Redis 与 Node API 已运行后重新核验。"],
        forbidden: ["没有平台运维权限", actionHint.value || "需要 platform:operate 能力。"],
        expired: ["登录已失效", "重新登录后再核验 Redis 韧性。"],
        rate_limited: ["刷新过于频繁", "稍后重试；现有结论不会因此升级。"],
        unavailable: [
          "Redis 运行事实暂不可用",
          actionHint.value || "在宝塔检查 API、MySQL 与 Redis 日志。",
        ],
        recovering: ["正在执行恢复核验", "宝塔重启后先验证 PING、持久化、隔离读写与清理。"],
      }) satisfies Record<ViewState, [string, string]>
    )[state.value],
);
const percent = (basis?: number) => (basis === undefined ? "—" : `${(basis / 100).toFixed(1)}%`);
const bytes = (value?: number) =>
  value === undefined
    ? "—"
    : value >= 1073741824
      ? `${(value / 1073741824).toFixed(1)} GiB`
      : `${(value / 1048576).toFixed(1)} MiB`;
const compactBytes = (value: number) =>
  value >= 1048576
    ? `${(value / 1048576).toFixed(1)} MiB`
    : value >= 1024
      ? `${(value / 1024).toFixed(1)} KiB`
      : `${value} B`;
const purposeLabel = {
  cache: "缓存",
  queue: "队列与租约",
  rate: "限流",
  sse: "实时消息",
} as const;
const resourceLabel = {
  collection_ready: "采集就绪队列",
  collection_task: "采集任务租约",
  other: "其他受限键",
} as const;
const sampleStatusLabel = {
  sampled: "采样完成",
  partial: "部分采样",
  empty: "暂无受限键",
  unavailable: "采样不可用",
} as const;
const time = (value?: string) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚无记录";
const evictionRisk = computed(() => {
  if (!data.value) return { level: "unknown", text: "尚无观测" };
  if (data.value.evicted_keys > 0)
    return {
      level: "blocked",
      text: `实例启动后已累计淘汰 ${data.value.evicted_keys} 个键，需先核对受影响队列与实时协调。`,
    };
  if (data.value.max_memory_policy !== "noeviction")
    return { level: "blocked", text: `当前策略 ${data.value.max_memory_policy} 允许静默淘汰。` };
  if (data.value.memory.usage_basis_points >= 8000)
    return {
      level: "warning",
      text: "noeviction 不会静默淘汰，但接近内存上限时新写入会失败。",
    };
  return { level: "ready", text: "noeviction 已启用，当前未记录键淘汰。" };
});

async function load() {
  state.value = "loading";
  actionHint.value = "";
  try {
    const response = await request<RedisResilienceDto | null>("/platform/operations/redis");
    requestId.value = response.request_id;
    if (!response.data) {
      data.value = null;
      state.value = "empty";
      return;
    }
    data.value = response.data;
    state.value = response.data.state;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    actionHint.value = failure?.actionHint ?? "";
    state.value =
      failure?.kind === "expired" ||
      failure?.kind === "forbidden" ||
      failure?.kind === "rate_limited"
        ? failure.kind
        : "unavailable";
  }
}
onMounted(load);
</script>

<template>
  <section class="redis-resilience" :data-state="state">
    <header class="redis-resilience__hero">
      <div>
        <p>单实例缓存服务</p>
        <h2>缓存服务单实例韧性</h2>
        <span>当前惠州单机只运行一个宝塔 Redis；不启用 Sentinel、集群、副本或备用服务器。</span>
      </div>
      <button type="button" @click="load">刷新运行事实</button>
    </header>
    <section
      v-if="state === 'loading' || state === 'recovering'"
      class="redis-resilience__state"
      aria-live="polite"
    >
      <i aria-hidden="true"></i>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
      </div>
    </section>
    <section
      v-else-if="['forbidden', 'expired', 'rate_limited', 'unavailable', 'empty'].includes(state)"
      class="redis-resilience__state redis-resilience__state--danger"
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
      <section class="redis-resilience__verdict" :data-verdict="state">
        <div>
          <small>S0 · {{ state.toUpperCase() }}</small
          ><strong>{{ verdict[0] }}</strong>
        </div>
        <p>{{ verdict[1] }}</p>
        <em>单实例 · 运行状态已核对</em>
      </section>
      <section class="redis-resilience__metrics" aria-label="Redis 资源指标">
        <article>
          <span>内存使用</span><strong>{{ percent(data.memory.usage_basis_points) }}</strong
          ><small>{{ bytes(data.memory.used_bytes) }} / {{ bytes(data.memory.max_bytes) }}</small>
        </article>
        <article>
          <span>连接使用</span><strong>{{ percent(data.connections.usage_basis_points) }}</strong
          ><small>{{ data.connections.connected }} / {{ data.connections.maximum }}</small>
        </article>
        <article>
          <span>拒绝连接</span><strong>{{ data.connections.rejected }}</strong
          ><small>任何非零均阻断</small>
        </article>
        <article>
          <span>淘汰键</span><strong>{{ data.evicted_keys }}</strong
          ><small>不静默丢弃数据</small>
        </article>
      </section>
      <div class="redis-resilience__layout">
        <section class="redis-resilience__panel redis-resilience__persistence">
          <header>
            <div>
              <p>持久化</p>
              <h3>双持久化状态</h3>
            </div>
            <span>宝塔管理</span>
          </header>
          <div class="redis-resilience__persistence-grid">
            <article
              :data-ok="
                data.persistence.aof_enabled && data.persistence.aof_last_write_status === 'ok'
              "
            >
              <i>追加日志</i><b>{{ data.persistence.aof_enabled ? "已启用" : "未启用" }}</b
              ><small>everysec · {{ data.persistence.aof_last_write_status }}</small>
            </article>
            <article
              :data-ok="
                data.persistence.rdb_enabled && data.persistence.rdb_last_save_status === 'ok'
              "
            >
              <i>快照</i><b>{{ data.persistence.rdb_enabled ? "已启用" : "未启用" }}</b
              ><small>定时快照 · {{ data.persistence.rdb_last_save_status }}</small>
            </article>
          </div>
          <p>缓存服务只保存缓存、队列、限流与实时消息协调；数据库仍是事实源。</p>
        </section>
        <aside class="redis-resilience__panel">
          <header>
            <div>
              <p>运行状态</p>
              <h3>运行方式</h3>
            </div>
          </header>
          <dl>
            <div>
              <dt>运行模式</dt>
              <dd>单实例</dd>
            </div>
            <div>
              <dt>哨兵模式</dt>
              <dd>{{ data.sentinel_enabled ? "已启用" : "未启用" }}</dd>
            </div>
            <div>
              <dt>缓存服务集群</dt>
              <dd>{{ data.cluster_enabled ? "已启用" : "未启用" }}</dd>
            </div>
            <div>
              <dt>事实来源</dt>
              <dd>宝塔受管实例</dd>
            </div>
          </dl>
        </aside>
      </div>
      <section class="redis-resilience__panel redis-resilience__risk">
        <header>
          <div>
            <p>内存风险</p>
            <h3>键淘汰风险</h3>
          </div>
          <span>{{ data.max_memory_policy }}</span>
        </header>
        <article :data-severity="evictionRisk.level">
          <strong>{{ percent(data.memory.usage_basis_points) }} 内存水位</strong>
          <p>{{ evictionRisk.text }}</p>
          <small>累计值覆盖当前实例 {{ Math.floor(data.uptime_seconds / 86400) }} 天运行期。</small>
        </article>
        <section class="redis-resilience__hotspots" aria-labelledby="redis-hotspot-heading">
          <header>
            <div>
              <small>脱敏有界采样</small>
              <h4 id="redis-hotspot-heading">键空间占用热点</h4>
            </div>
            <span>{{ sampleStatusLabel[data.keyspace_sample.status] }}</span>
          </header>
          <div v-if="data.keyspace_sample.hotspots.length" class="redis-resilience__hotspot-list">
            <article
              v-for="item in data.keyspace_sample.hotspots"
              :key="`${item.purpose}:${item.resource}`"
            >
              <div>
                <strong>{{ resourceLabel[item.resource] }}</strong>
                <small>{{ purposeLabel[item.purpose] }} · {{ item.sampled_keys }} 个采样键</small>
              </div>
              <div class="redis-resilience__hotspot-value">
                <b>{{ percent(item.sampled_share_basis_points) }}</b>
                <small>{{ compactBytes(item.sampled_bytes) }}</small>
              </div>
              <i aria-hidden="true"
                ><span :style="{ width: `${item.sampled_share_basis_points / 100}%` }"></span
              ></i>
            </article>
          </div>
          <div v-else class="redis-resilience__hotspot-empty">
            <b>{{ sampleStatusLabel[data.keyspace_sample.status] }}</b>
            <span v-if="data.keyspace_sample.unavailable_reason === 'command_unsupported'"
              >当前客户端不支持受限 SCAN 与 MEMORY USAGE。</span
            >
            <span v-else-if="data.keyspace_sample.unavailable_reason === 'scan_failed'"
              >本次采样失败；Redis 总体韧性结论仍由独立运行事实决定。</span
            >
            <span v-else>当前采样范围内没有可归类的 ScoutOps 业务键。</span>
          </div>
          <footer>
            <span
              >已测 {{ data.keyspace_sample.measured_keys }} / 已扫描
              {{ data.keyspace_sample.scanned_keys }}，上限
              {{ data.keyspace_sample.sample_limit }}</span
            >
            <span v-if="data.keyspace_sample.truncated">已达到有界采样范围</span>
          </footer>
        </section>
        <p class="redis-resilience__truth-note">
          这里只显示受限键的采样内存占比，不返回键名、组织、工作区或载荷，也不把内存占比冒充访问频率；
          noeviction 模式不提供可信 LFU 热度。
        </p>
      </section>
      <section class="redis-resilience__panel redis-resilience__findings">
        <header>
          <div>
            <p>失败时拒绝放行</p>
            <h3>告警与阻断项</h3>
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
        <div v-else class="redis-resilience__clear">
          <b>当前无缓存服务韧性阻断</b><span>持久化、连接、队列与限流功能均处于可用状态。</span>
        </div>
      </section>
      <footer class="redis-resilience__footer">
        <span>观测 {{ time(data.observed_at) }}</span
        ><span>request_id {{ requestId || "—" }}</span
        ><strong>重启、配置与恢复只允许通过宝塔</strong>
      </footer>
    </template>
  </section>
</template>
