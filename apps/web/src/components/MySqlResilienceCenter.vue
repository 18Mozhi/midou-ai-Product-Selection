<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { MySqlResilienceDto } from "@scoutops/contracts";
import { ApiClientError, createApiClient } from "../api-client";
import "../mysql-resilience.css";
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
  data = ref<MySqlResilienceDto | null>(null),
  requestId = ref(""),
  actionHint = ref("");
const verdict = computed(
  () =>
    (
      ({
        loading: ["正在读取 MySQL 单主事实", "核对持久化、I/O、慢查询、容量与恢复证据。"],
        ready: ["MySQL 单主韧性门已满足", "当前事实符合 MySQL 5.7 单主基线。"],
        warning: ["MySQL 指标接近预警线", "当前仍可用，需要按告警项处理。"],
        blocked: ["MySQL 韧性门已阻断", "停止新增高成本任务，并通过宝塔恢复。"],
        empty: ["尚无 MySQL 观测", "确认宝塔 MySQL 与 Node API 后重新核验。"],
        forbidden: ["没有平台运维权限", actionHint.value || "需要 platform:operate 能力。"],
        expired: ["登录已失效", "重新登录后再核验。"],
        rate_limited: ["刷新过于频繁", "稍后重试。"],
        unavailable: [
          "MySQL 运行事实暂不可用",
          actionHint.value || "在宝塔检查 MySQL 与 Node API。",
        ],
        recovering: ["正在执行隔离恢复核验", "恢复结论确认前保持阻断。"],
      }) satisfies Record<ViewState, [string, string]>
    )[state.value],
);
const percent = (value?: number) => (value === undefined ? "—" : `${(value / 100).toFixed(1)}%`);
const bytes = (value?: number) =>
  value === undefined
    ? "—"
    : value >= 1073741824
      ? `${(value / 1073741824).toFixed(1)} GiB`
      : `${(value / 1048576).toFixed(1)} MiB`;
const time = (value?: string) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚无记录";
async function load() {
  state.value = "loading";
  actionHint.value = "";
  try {
    const response = await request<MySqlResilienceDto | null>("/platform/operations/mysql");
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
  <section class="mysql-resilience" :data-state="state">
    <header class="mysql-resilience__hero">
      <div>
        <p>单主数据库</p>
        <h2>数据库 5.7 单主韧性</h2>
        <span>惠州单机只运行一个宝塔 MySQL 主实例；不启用读副本、负载均衡或备用服务器。</span>
      </div>
      <button type="button" @click="load">刷新运行事实</button>
    </header>
    <section
      v-if="state === 'loading' || state === 'recovering'"
      class="mysql-resilience__state"
      aria-live="polite"
    >
      <i></i>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
      </div>
    </section>
    <section
      v-else-if="['forbidden', 'expired', 'rate_limited', 'unavailable', 'empty'].includes(state)"
      class="mysql-resilience__state mysql-resilience__state--danger"
      aria-live="polite"
    >
      <strong>!</strong>
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
        <code v-if="requestId">request_id {{ requestId }}</code>
      </div>
      <button type="button" @click="load">重新核验</button>
    </section>
    <template v-else-if="data">
      <section class="mysql-resilience__verdict" :data-verdict="state">
        <div>
          <small>S0 · {{ state.toUpperCase() }}</small
          ><strong>{{ verdict[0] }}</strong>
        </div>
        <p>{{ verdict[1] }}</p>
        <em>单主 · 运行状态已核对</em>
      </section>
      <section class="mysql-resilience__metrics">
        <article>
          <span>连接使用</span><strong>{{ percent(data.connections.usage_basis_points) }}</strong
          ><small>{{ data.connections.connected }} / {{ data.connections.maximum }}</small>
        </article>
        <article>
          <span>数据盘使用</span><strong>{{ percent(data.storage.usage_basis_points) }}</strong
          ><small
            >{{ bytes(data.storage.used_bytes) }} / {{ bytes(data.storage.total_bytes) }}</small
          >
        </article>
        <article>
          <span>缓冲池命中</span
          ><strong>{{ percent(data.io.buffer_pool_hit_rate_basis_points) }}</strong
          ><small>{{ bytes(data.io.buffer_pool_data_bytes) }} 数据</small>
        </article>
        <article>
          <span>慢查询速率</span><strong>{{ data.slow_queries.per_minute.toFixed(2) }}</strong
          ><small>次/分钟 · 阈值 {{ data.slow_queries.long_query_time_seconds }} 秒</small>
        </article>
      </section>
      <div class="mysql-resilience__layout">
        <section class="mysql-resilience__panel">
          <header>
            <div>
              <p>持久化保障</p>
              <h3>持久化与单主合同</h3>
            </div>
            <span>宝塔管理</span>
          </header>
          <dl>
            <div>
              <dt>二进制日志</dt>
              <dd>
                {{ data.durability.log_bin_enabled ? "已启用" : "未启用" }}
              </dd>
            </div>
            <div>
              <dt>数据库日志格式</dt>
              <dd>{{ data.durability.binlog_format }}</dd>
            </div>
            <div>
              <dt>事务日志刷盘</dt>
              <dd>{{ data.durability.innodb_flush_log_at_trx_commit }}</dd>
            </div>
            <div>
              <dt>数据库日志同步</dt>
              <dd>{{ data.durability.sync_binlog }}</dd>
            </div>
            <div>
              <dt>副本</dt>
              <dd>{{ data.replica_enabled ? "已启用" : "未启用" }}</dd>
            </div>
          </dl>
        </section>
        <aside class="mysql-resilience__panel">
          <header>
            <div>
              <p>恢复能力</p>
              <h3>同机加密恢复事实</h3>
            </div>
          </header>
          <dl>
            <div>
              <dt>状态</dt>
              <dd>{{ data.recovery.status }}</dd>
            </div>
            <div>
              <dt>实际最多可丢失时间</dt>
              <dd>{{ data.recovery.actual_rpo_minutes ?? "—" }} 分钟</dd>
            </div>
            <div>
              <dt>实际恢复耗时</dt>
              <dd>{{ data.recovery.actual_rto_minutes ?? "—" }} 分钟</dd>
            </div>
            <div>
              <dt>演练距今</dt>
              <dd>{{ data.recovery.drill_age_days ?? "—" }} 天</dd>
            </div>
            <div>
              <dt>备用服务器</dt>
              <dd>{{ data.backup_server_used ? "已启用" : "未启用" }}</dd>
            </div>
          </dl>
        </aside>
      </div>
      <section class="mysql-resilience__panel mysql-resilience__findings">
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
        <div v-else class="mysql-resilience__clear">
          <b>当前无数据库韧性阻断</b><span>连接、持久化、慢查询与恢复功能均处于可用状态。</span>
        </div>
      </section>
      <footer class="mysql-resilience__footer">
        <span>观测 {{ time(data.observed_at) }}</span
        ><span>request_id {{ requestId || "—" }}</span
        ><strong>配置、重启、备份与恢复只允许通过宝塔</strong>
      </footer>
    </template>
  </section>
</template>
