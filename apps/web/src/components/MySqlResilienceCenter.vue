<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { MySqlResilienceDto } from "@scoutops/contracts";
import { ApiClientError, createApiClient } from "../api-client";
import TechnicalDetails from "./TechnicalDetails.vue";
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
  | "timeout"
  | "unavailable"
  | "recovering";
type RefreshFailure = "rate_limited" | "timeout" | "unavailable";
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<ViewState>("loading"),
  data = ref<MySqlResilienceDto | null>(null),
  requestId = ref(""),
  actionHint = ref(""),
  refreshing = ref(false),
  refreshFailure = ref<RefreshFailure | null>(null);
let controller: AbortController | null = null;
let sequence = 0;
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
        rate_limited: ["刷新过于频繁", "稍后重试；现有结论不会因此升级。"],
        timeout: ["读取 MySQL 运行事实超时", "本次请求已在 15 秒后停止，请检查服务状态再重试。"],
        unavailable: [
          "MySQL 运行事实暂不可用",
          actionHint.value || "在宝塔检查 MySQL 与 Node API。",
        ],
        recovering: ["正在执行隔离恢复核验", "恢复结论确认前保持阻断。"],
      }) satisfies Record<ViewState, [string, string]>
    )[state.value],
);
const refreshNotice = computed(() => {
  if (refreshFailure.value === "timeout")
    return "读取超过 15 秒，已停止本次请求并保留上次成功的 MySQL 运行事实。";
  if (refreshFailure.value === "rate_limited")
    return "刷新过于频繁，已保留上次成功的 MySQL 运行事实；请稍后重试。";
  if (refreshFailure.value === "unavailable")
    return `${actionHint.value || "MySQL 运行事实暂不可用，请在宝塔核对 Node API 与 MySQL。"} 已保留上次成功的 MySQL 运行事实。`;
  return "";
});
const percent = (value?: number) => (value === undefined ? "—" : `${(value / 100).toFixed(1)}%`);
const bytes = (value?: number) =>
  value === undefined
    ? "—"
    : value >= 1073741824
      ? `${(value / 1073741824).toFixed(1)} GiB`
      : `${(value / 1048576).toFixed(1)} MiB`;
const time = (value?: string) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚无记录";
const findingSeverity = (codes: string[]) => {
  const finding = data.value?.findings.find((item) => codes.includes(item.code));
  return finding?.severity ?? "ready";
};
const slowQueryImpact = computed(() => {
  if (!data.value) return "尚无观测";
  const severity = findingSeverity(["mysql_slow_query_warning", "mysql_slow_query_stop"]);
  if (severity === "blocked") return "已达到阻断线；高成本任务应停止";
  if (severity === "warning") return "已达到预警线；需核对索引与执行计划";
  return data.value.slow_queries.per_minute > 0
    ? "当前窗口存在慢查询增量，尚未触发门禁"
    : "当前窗口未观察到慢查询增量";
});
const rowLockImpact = computed(() => {
  if (!data.value) return "尚无观测";
  return data.value.io.innodb_row_lock_waits > 0
    ? `实例启动后累计 ${data.value.io.innodb_row_lock_waits} 次；需结合长事务日志判断当前影响`
    : "实例启动后未记录行锁等待";
});
async function load() {
  if (controller) return;
  const currentSequence = ++sequence;
  const requestController = new AbortController();
  const hasSnapshot = Boolean(data.value);
  const correlationId = crypto.randomUUID();
  controller = requestController;
  refreshing.value = true;
  refreshFailure.value = null;
  if (!hasSnapshot) state.value = "loading";
  actionHint.value = "";
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, 15_000);
  try {
    const response = await request<MySqlResilienceDto | null>("/platform/operations/mysql", {
      signal: requestController.signal,
      requestId: correlationId,
      traceId: correlationId,
    });
    if (currentSequence !== sequence) return;
    requestId.value = response.request_id;
    if (!response.data) {
      data.value = null;
      state.value = "empty";
      return;
    }
    data.value = response.data;
    state.value = response.data.state;
  } catch (error) {
    if (
      currentSequence !== sequence ||
      (error instanceof DOMException && error.name === "AbortError" && !timedOut)
    )
      return;
    if (timedOut) {
      requestId.value = correlationId;
      if (hasSnapshot) refreshFailure.value = "timeout";
      else state.value = "timeout";
      return;
    }
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    actionHint.value = failure?.actionHint ?? "";
    const failureState =
      failure?.kind === "expired" ||
      failure?.kind === "forbidden" ||
      failure?.kind === "rate_limited"
        ? failure.kind
        : "unavailable";
    if (hasSnapshot && !["expired", "forbidden"].includes(failureState))
      refreshFailure.value = failureState as RefreshFailure;
    else {
      data.value = null;
      state.value = failureState;
    }
  } finally {
    window.clearTimeout(timeout);
    if (currentSequence === sequence) {
      controller = null;
      refreshing.value = false;
    }
  }
}
onMounted(load);
onBeforeUnmount(() => {
  sequence += 1;
  controller?.abort();
  controller = null;
});
</script>
<template>
  <section class="mysql-resilience mysql-resilience--c" :data-state="state">
    <header class="mysql-resilience__hero">
      <div>
        <p>ScoutOps / 数据库运行</p>
        <h1>MySQL 运行核验</h1>
        <span>惠州单机只运行一个宝塔 MySQL 主实例；不启用读副本、负载均衡或备用服务器。</span>
      </div>
      <button type="button" :disabled="refreshing" :aria-busy="refreshing" @click="load">
        {{ refreshing ? "正在刷新…" : "刷新运行事实" }}
      </button>
    </header>

    <aside class="p68-boundary" aria-label="运行边界">
      <b>惠州同机 / 宝塔受管</b><span>固定单主；不新增读副本、负载均衡或备用服务器。</span>
    </aside>
    <section
      v-if="data && refreshFailure"
      class="mysql-resilience__refresh-notice"
      :data-kind="refreshFailure"
      aria-live="polite"
    >
      <div>
        <b>{{ refreshFailure === "timeout" ? "刷新已超时" : "刷新未完成" }}</b>
        <p>{{ refreshNotice }}</p>
        <TechnicalDetails :request-id="requestId" />
      </div>
      <button type="button" :disabled="refreshing" @click="load">重新核验</button>
    </section>
    <section
      v-if="state === 'loading' || state === 'recovering'"
      class="mysql-resilience__state"
      aria-live="polite"
    >
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
      </div>
    </section>
    <section
      v-else-if="
        ['forbidden', 'expired', 'rate_limited', 'timeout', 'unavailable', 'empty'].includes(state)
      "
      class="mysql-resilience__state mysql-resilience__state--danger"
      aria-live="polite"
    >
      <div>
        <b>{{ verdict[0] }}</b>
        <p>{{ verdict[1] }}</p>
        <TechnicalDetails :request-id="requestId" />
      </div>
      <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
      ><button v-else type="button" :disabled="refreshing" @click="load">重新核验</button>
    </section>
    <template v-else-if="data">
      <section class="p68-paper">
        <section class="p68-conclusion" :data-verdict="state">
          <div>
            <small>S0 / {{ state }}</small>
            <h2>
              {{
                state === "ready"
                  ? "当前单主韧性门满足"
                  : state === "warning"
                    ? "当前观测存在预警"
                    : "当前单主韧性门阻断"
              }}
            </h2>
            <p>返回 {{ data.findings.length }} 项发现；ready 不替代真实恢复或生产验收。</p>
          </div>
          <div>
            <b>观测时间</b><time :datetime="data.observed_at">{{ time(data.observed_at) }}</time>
          </div>
        </section>
        <section v-if="data.findings.length" class="p68-findings">
          <h2>
            当前发现 <small>{{ data.findings.length }} 项</small>
          </h2>
          <article v-for="item in data.findings" :key="item.code" :data-severity="item.severity">
            <b>{{ item.severity === "blocked" ? "阻断" : "预警" }}</b
            ><code>{{ item.code }}</code>
            <p>{{ item.action_hint }}</p>
          </article>
          <small>提示仅供人工核对，不会执行停任务、调优、迁移或恢复。</small>
        </section>
        <div class="p68-evidence">
          <div class="p68-runtime">
            <section class="p68-section">
              <header>
                <h2>资源观测</h2>
                <p>连接和文件系统各自按对应 finding 显示。</p>
              </header>
              <div class="p68-resource-grid">
                <article
                  class="p68-resource"
                  data-resource="connections"
                  :data-severity="
                    findingSeverity(['mysql_connections_warning', 'mysql_connections_stop'])
                  "
                >
                  <h3>连接使用</h3>
                  <strong>{{
                    data.findings.some((item) => item.code === "mysql_unavailable")
                      ? "未取得观测"
                      : data.connections.maximum > 0
                        ? percent(data.connections.usage_basis_points)
                        : "上限 / 容量未知"
                  }}</strong>
                  <p>{{ data.connections.connected }} / {{ data.connections.maximum }}</p>
                  <div
                    v-if="
                      !data.findings.some((item) => item.code === 'mysql_unavailable') &&
                      data.connections.maximum > 0
                    "
                    class="p68-meter"
                    :data-level="
                      findingSeverity(['mysql_connections_warning', 'mysql_connections_stop'])
                    "
                    aria-hidden="true"
                  >
                    <span :style="{ width: percent(data.connections.usage_basis_points) }"></span>
                  </div>
                  <small v-if="data.connections.maximum <= 0"
                    >接口比例为未知上限约定，不是实测满额。</small
                  ><small v-else>已连接为瞬时计数，不是查询吞吐量。</small>
                </article>
                <article
                  class="p68-resource"
                  data-resource="storage"
                  :data-severity="
                    findingSeverity(['mysql_data_capacity_warning', 'mysql_data_capacity_stop'])
                  "
                >
                  <h3>数据盘使用</h3>
                  <strong>{{
                    data.findings.some((item) => item.code === "mysql_unavailable")
                      ? "未取得观测"
                      : data.storage.total_bytes > 0
                        ? percent(data.storage.usage_basis_points)
                        : "上限 / 容量未知"
                  }}</strong>
                  <p>
                    {{ bytes(data.storage.used_bytes) }} / {{ bytes(data.storage.total_bytes) }}
                  </p>
                  <div
                    v-if="
                      !data.findings.some((item) => item.code === 'mysql_unavailable') &&
                      data.storage.total_bytes > 0
                    "
                    class="p68-meter"
                    :data-level="
                      findingSeverity(['mysql_data_capacity_warning', 'mysql_data_capacity_stop'])
                    "
                    aria-hidden="true"
                  >
                    <span :style="{ width: percent(data.storage.usage_basis_points) }"></span>
                  </div>
                  <small v-if="data.storage.total_bytes <= 0"
                    >接口比例为未知容量约定，不是实测满额。</small
                  ><small v-else>数据目录所在文件系统，不等于数据库表体积。</small>
                </article>
              </div>
            </section>
            <section class="p68-section">
              <header>
                <h2>速率、累计与瞬时</h2>
                <p>不同口径分开，不组合成“当前性能分数”。</p>
              </header>
              <dl class="p68-measurements">
                <div>
                  <dt>慢查询近似速率</dt>
                  <dd>{{ data.slow_queries.per_minute.toFixed(2) }} 次/分钟</dd>
                  <p>累计非负增量除以至少一分钟间隔；无上次观测时按运行分钟平均。</p>
                </div>
                <div>
                  <dt>累计缓冲池命中</dt>
                  <dd>{{ percent(data.io.buffer_pool_hit_rate_basis_points) }}</dd>
                  <p>来自启动以来 reads / requests；零 requests 的 100% 不能独立证明实际命中。</p>
                </div>
                <div>
                  <dt>行锁等待</dt>
                  <dd>{{ data.io.innodb_row_lock_waits }} 次累计</dd>
                  <p>{{ rowLockImpact }}</p>
                </div>
                <div>
                  <dt>日志等待</dt>
                  <dd>{{ data.io.innodb_log_waits }} 次累计</dd>
                  <p>累计等待不能直接表示当前磁盘延迟。</p>
                </div>
                <div>
                  <dt>运行线程</dt>
                  <dd>{{ data.connections.running }} 个</dd>
                  <p>当前状态计数，不是活跃用户数或容量。</p>
                </div>
              </dl>
            </section>
          </div>
          <aside class="p68-recovery">
            <header>
              <h2>同机恢复证据</h2>
              <p>与运行资源独立核对，不是高可用或异地容灾。</p>
            </header>
            <div class="p68-recovery-state">
              <b>{{ data.recovery.status }}</b
              ><small>仍需与总体 findings 对照。</small>
            </div>
            <dl>
              <div>
                <dt>RPO / 最多可丢失时间</dt>
                <dd>
                  {{ data.recovery.actual_rpo_minutes ?? "未记录"
                  }}<small>{{
                    data.recovery.actual_rpo_minutes == null ? "未知不填0" : "分钟"
                  }}</small>
                </dd>
              </div>
              <div>
                <dt>RTO / 实际恢复耗时</dt>
                <dd>
                  {{ data.recovery.actual_rto_minutes ?? "未记录"
                  }}<small>{{
                    data.recovery.actual_rto_minutes == null ? "未知不填0" : "分钟"
                  }}</small>
                </dd>
              </div>
              <div>
                <dt>演练距今</dt>
                <dd>
                  {{ data.recovery.drill_age_days ?? "未记录"
                  }}<small>{{ data.recovery.drill_age_days == null ? "未知不填0" : "天" }}</small>
                </dd>
              </div>
            </dl>
            <p class="p68-note">
              探针按15分钟 RPO、240分钟 RTO、90天演练检查；运行 policy
              还会再次检查。页面不发起备份或恢复。
            </p>
          </aside>
        </div>
        <section class="p68-section p68-durability">
          <header>
            <h2>持久化实际值与单主合同</h2>
            <p>目标用于对照，不是可编辑配置表。</p>
          </header>
          <div class="p68-contract p68-contract--head">
            <span>核对项</span><span>当前返回</span><span>合同目标</span>
          </div>
          <div class="p68-contract">
            <code>二进制日志</code
            ><span>{{ data.durability.log_bin_enabled ? "已启用" : "未启用" }}</span
            ><span>启用</span>
          </div>
          <div class="p68-contract">
            <code>binlog_format</code><span>{{ data.durability.binlog_format }}</span
            ><span>ROW</span>
          </div>
          <div class="p68-contract">
            <code>innodb_flush_log_at_trx_commit</code
            ><span>{{ data.durability.innodb_flush_log_at_trx_commit }}</span
            ><span>2</span>
          </div>
          <div class="p68-contract">
            <code>sync_binlog</code><span>{{ data.durability.sync_binlog }}</span
            ><span>1</span>
          </div>
          <p class="p68-note">
            固定单主/无副本是边界，不覆盖只读主库或非预期副本
            findings；接口不返回主机、账号、目录、binlog 文件或 SQL。
          </p>
        </section>
      </section>
      <footer class="mysql-resilience__footer">
        <span>观测 {{ time(data.observed_at) }}</span
        ><TechnicalDetails :request-id="requestId" /><strong
          >配置、重启、备份与恢复只允许通过宝塔</strong
        >
      </footer>
    </template>
  </section>
</template>

<style>
@import "../mysql-resilience-c.css";
</style>
