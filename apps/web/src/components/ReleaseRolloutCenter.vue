<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import ResponsiveDataView from "./ResponsiveDataView.vue";
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<
  | "loading"
  | "empty"
  | "blocked"
  | "stale"
  | "verified"
  | "stopped"
  | "rolled_back"
  | "forbidden"
  | "expired"
>("loading");
const data = ref<any>(null),
  requestId = ref(""),
  hint = ref("");
const time = (value?: string | null) => (value ? new Date(value).toLocaleString() : "尚无记录");
const sha = (value?: string) => (value ? value.slice(0, 10) : "—");
const statusText = (value?: string | null) =>
    (
      ({
        healthy: "健康",
        pending: "待观察",
        passed: "已通过",
        failed: "失败",
        stopped: "已停止",
        rolled_back: "已回滚",
      }) as Record<string, string>
    )[value ?? ""] ?? "尚无状态",
  blockerText = (value: string) =>
    (
      ({
        rollout_gates_incomplete: "发布观察门未完成",
        rollout_evidence_stale: "发布观察证据已过期",
      }) as Record<string, string>
    )[value] ?? "发布条件未满足";
async function load() {
  state.value = "loading";
  try {
    const response = await request<any>("/platform/operations/releases");
    requestId.value = response.request_id;
    data.value = response.data;
    state.value = response.data.state;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? "";
    hint.value = failure?.actionHint ?? "";
    state.value =
      failure?.kind === "expired" || failure?.kind === "forbidden" ? failure.kind : "blocked";
  }
}
onMounted(load);
</script>

<template>
  <section class="release-center">
    <header class="hero">
      <div>
        <p>发布控制</p>
        <h2>发布与回滚控制台</h2>
        <span>只展示宝塔发布任务写入的版本、观察门、自动停止与回滚事实。</span>
      </div>
      <button type="button" @click="load">刷新发布事实</button>
    </header>
    <section v-if="state === 'loading'" class="state">
      <b>正在核验当前发布</b><span>读取构建身份、迁移、备份前置和 5% / 25% / 100% 观察门。</span>
    </section>
    <section v-else-if="state === 'forbidden' || state === 'expired'" class="state danger">
      <b>{{ state === "expired" ? "登录已失效" : "你没有平台运维权限" }}</b
      ><span>{{ hint || "请重新登录或联系平台管理员。" }}</span>
    </section>
    <template v-else-if="data">
      <section class="verdict" :data-state="state">
        <div>
          <small>当前结论</small
          ><strong>{{
            state === "verified"
              ? "发布门已通过"
              : state === "rolled_back"
                ? "已回滚到稳定版本"
                : state === "stopped"
                  ? "发布已自动停止"
                  : state === "stale"
                    ? "观察证据已过期"
                    : state === "empty"
                      ? "尚无发布记录"
                      : "发布条件未满足"
          }}</strong>
        </div>
        <p>
          {{
            state === "verified"
              ? "当前版本完成全部观察门；后续指标退化仍应停止新发布。"
              : state === "rolled_back"
                ? "回滚事实已审计，需重新完成发布门才可签发新版本。"
                : "失败关闭：任何门缺失、超阈值或版本不一致都不会显示为健康。"
          }}
        </p>
      </section>
      <div class="identity-grid">
        <article>
          <span>构建</span><strong>{{ sha(data.latest_release?.build_sha) }}</strong
          ><small>{{ data.latest_release?.app_version || "未签发" }}</small>
        </article>
        <article>
          <span>迁移</span><strong>{{ data.latest_release?.migration_version || "—" }}</strong
          ><small>数据库 5.7</small>
        </article>
        <article>
          <span>发布状态</span><strong>{{ statusText(data.latest_release?.status) }}</strong
          ><small>{{ time(data.latest_release?.finished_at) }}</small>
        </article>
        <article>
          <span>自动停止</span
          ><strong>{{ data.automatic_stop_verified ? "已触发验证" : "待命" }}</strong
          ><small>服务错误 / 请求耗时 / 异步积压</small>
        </article>
      </div>
      <section class="panel">
        <header>
          <div>
            <h3>渐进观察门</h3>
            <span>每阶段生产至少 {{ data.policy.minimum_observation_seconds / 60 }} 分钟</span>
          </div>
          <code>5% → 25% → 100%</code>
        </header>
        <div class="gate-grid">
          <article v-for="percent in data.policy.percentages" :key="percent">
            <div
              class="ring"
              :data-pass="
                data.gates.some(
                  (g: any) => g.gate_kind === `canary_${percent}` && g.status === 'passed',
                )
              "
            >
              <strong>{{ percent }}%</strong>
            </div>
            <b>{{
              statusText(data.gates.find((g: any) => g.gate_kind === `canary_${percent}`)?.status)
            }}</b
            ><small
              >观察
              {{
                data.gates.find((g: any) => g.gate_kind === `canary_${percent}`)?.observe_seconds ||
                0
              }}
              秒</small
            >
          </article>
        </div>
      </section>
      <div class="detail-grid">
        <section class="panel">
          <header>
            <h3>门禁指标</h3>
            <span>超过任一阈值自动停止</span>
          </header>
          <ResponsiveDataView
            :rows="data.gates.filter((gate: any) => gate.gate_kind.startsWith('canary_'))"
            :row-key="(gate) => gate.id"
            title="发布门禁指标"
            :detail-title="(gate) => `${gate.traffic_percent}% 观察门`"
          >
            <template #desktop
              ><table>
                <thead>
                  <tr>
                    <th>阶段</th>
                    <th>服务错误</th>
                    <th>95% 读取耗时</th>
                    <th>95% 写入耗时</th>
                    <th>异步延迟</th>
                    <th>技术信息</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="gate in data.gates.filter((g: any) => g.gate_kind.startsWith('canary_'))"
                    :key="gate.id"
                  >
                    <td>{{ gate.traffic_percent }}%</td>
                    <td>{{ gate.error_rate_percent }}%</td>
                    <td>{{ gate.read_p95_ms }} ms</td>
                    <td>{{ gate.write_p95_ms }} ms</td>
                    <td>{{ gate.async_lag_seconds }} s</td>
                    <td>
                      <details>
                        <summary>技术详情</summary>
                        <dl>
                          <div>
                            <dt>门禁 ID</dt>
                            <dd>{{ gate.id }}</dd>
                          </div>
                          <div>
                            <dt>门禁类型</dt>
                            <dd>{{ gate.gate_kind }}</dd>
                          </div>
                          <div>
                            <dt>发布 ID</dt>
                            <dd>{{ gate.release_id }}</dd>
                          </div>
                        </dl>
                      </details>
                    </td>
                  </tr>
                </tbody>
              </table></template
            >
            <template #summary="{ row }"
              ><span class="responsive-record-summary"
                ><strong>{{ row.traffic_percent }}% · {{ statusText(row.status) }}</strong
                ><small
                  >错误 {{ row.error_rate_percent }}% · 读取 {{ row.read_p95_ms }} ms</small
                ></span
              ></template
            >
            <template #detail="{ row }"
              ><dl>
                <div>
                  <dt>观察状态</dt>
                  <dd>{{ statusText(row.status) }}</dd>
                </div>
                <div>
                  <dt>观察时长 / 样本</dt>
                  <dd>{{ row.observe_seconds }} 秒 / {{ row.sample_count }} 个</dd>
                </div>
                <div>
                  <dt>服务错误率</dt>
                  <dd>{{ row.error_rate_percent }}%</dd>
                </div>
                <div>
                  <dt>95% 读取耗时</dt>
                  <dd>{{ row.read_p95_ms }} ms</dd>
                </div>
                <div>
                  <dt>95% 写入耗时</dt>
                  <dd>{{ row.write_p95_ms }} ms</dd>
                </div>
                <div>
                  <dt>异步延迟</dt>
                  <dd>{{ row.async_lag_seconds }} 秒</dd>
                </div>
              </dl>
              <details>
                <summary>技术详情</summary>
                <dl>
                  <div>
                    <dt>门禁 ID</dt>
                    <dd>{{ row.id }}</dd>
                  </div>
                  <div>
                    <dt>门禁代码</dt>
                    <dd>{{ row.gate_kind }}</dd>
                  </div>
                  <div>
                    <dt>发布 ID</dt>
                    <dd>{{ row.release_id }}</dd>
                  </div>
                </dl>
              </details></template
            >
          </ResponsiveDataView>
        </section>
        <section class="panel threshold">
          <header>
            <h3>停止阈值</h3>
            <span>固定失败关闭</span>
          </header>
          <dl>
            <div>
              <dt>服务错误率</dt>
              <dd>&lt; {{ data.policy.error_rate_stop_percent }}%</dd>
            </div>
            <div>
              <dt>95% 核心读取耗时</dt>
              <dd>≤ {{ data.policy.read_p95_stop_ms }} ms</dd>
            </div>
            <div>
              <dt>95% 核心写入耗时</dt>
              <dd>≤ {{ data.policy.write_p95_stop_ms }} ms</dd>
            </div>
            <div>
              <dt>异步等待</dt>
              <dd>≤ {{ data.policy.async_lag_stop_seconds }} s</dd>
            </div>
          </dl>
        </section>
      </div>
      <section v-if="data.blockers.length" class="blockers">
        <h3>阻断项</h3>
        <article v-for="item in data.blockers" :key="item.code">
          <strong>{{ blockerText(item.code) }}</strong>
          <p>{{ item.action_hint }}</p>
          <details>
            <summary>技术详情</summary>
            <code>{{ item.code }}</code>
          </details>
        </article>
      </section>
      <footer>
        观测 {{ time(data.observed_at) }} · 发布和回滚只能由宝塔任务执行
        <details>
          <summary>技术详情</summary>
          <span>请求 ID {{ requestId || "—" }}</span>
        </details>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.release-center {
  --line: var(--so-border);
  --muted: var(--so-text-muted);
  --cyan: var(--so-primary);
  --green: var(--so-success);
  --amber: var(--so-warning);
  color: var(--so-text);
  display: grid;
  gap: 17px;
}
.hero {
  align-items: end;
  background:
    radial-gradient(
      circle at 78% -20%,
      color-mix(in srgb, var(--so-info) 40%, transparent),
      transparent 47%
    ),
    linear-gradient(140deg, var(--so-bg-elevated), var(--so-bg-elevated));
  border: 1px solid var(--line);
  border-radius: 18px;
  display: flex;
  justify-content: space-between;
  min-height: 145px;
  padding: 27px;
}
.hero p {
  color: var(--cyan);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.17em;
  margin: 0 0 8px;
}
.hero h2 {
  font-size: 28px;
  margin: 0 0 8px;
}
.hero span,
.state span {
  color: var(--muted);
}
button {
  background: var(--so-primary-strong);
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
  color: var(--so-on-primary);
  padding: 10px 15px;
}
.state,
.panel,
.blockers,
.identity-grid article {
  background: linear-gradient(155deg, var(--so-panel-soft), var(--so-panel-soft));
  border: 1px solid var(--line);
  border-radius: 13px;
}
.state {
  display: grid;
  gap: 7px;
  padding: 24px;
}
.verdict {
  align-items: center;
  background: var(--so-panel);
  border: 1px solid var(--line);
  border-left: 4px solid var(--amber);
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  padding: 16px 20px;
}
.verdict[data-state="verified"] {
  border-left-color: var(--green);
}
.verdict[data-state="stopped"] {
  border-left-color: var(--so-danger);
}
.verdict small,
.identity-grid span,
.identity-grid small {
  color: var(--muted);
  display: block;
}
.verdict strong {
  display: block;
  font-size: 20px;
  margin-top: 5px;
}
.verdict p {
  color: var(--so-text-muted);
  margin: 0;
  max-width: 660px;
}
.identity-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, 1fr);
}
.identity-grid article {
  padding: 17px;
}
.identity-grid strong {
  display: block;
  font-size: 20px;
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.panel {
  padding: 19px;
}
.panel > header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.panel h3,
.blockers h3 {
  font-size: 15px;
  margin: 0;
}
.panel header span {
  color: var(--muted);
  font-size: 12px;
}
.panel header code {
  color: var(--cyan);
}
.gate-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 22px;
}
.gate-grid article {
  align-items: center;
  border-right: 1px solid var(--so-border);
  display: grid;
  justify-items: center;
  gap: 8px;
}
.gate-grid article:last-child {
  border: 0;
}
.ring {
  align-items: center;
  background: conic-gradient(var(--so-border-strong) 0 100%);
  border-radius: 50%;
  display: flex;
  height: 88px;
  justify-content: center;
  position: relative;
  width: 88px;
}
.ring:after {
  background: var(--so-panel);
  border-radius: 50%;
  content: "";
  inset: 8px;
  position: absolute;
}
.ring[data-pass="true"] {
  background: conic-gradient(var(--green) 0 100%);
}
.ring strong {
  position: relative;
  z-index: 1;
}
.gate-grid small {
  color: var(--muted);
}
.detail-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: 1.55fr 1fr;
}
table {
  border-collapse: collapse;
  margin-top: 16px;
  width: 100%;
}
th,
td {
  border-bottom: 1px solid var(--so-border);
  padding: 11px 7px;
  text-align: left;
}
th {
  color: var(--muted);
  font-size: 11px;
}
td {
  font-size: 13px;
}
dl {
  margin: 12px 0 0;
}
dl div {
  border-bottom: 1px solid var(--so-border);
  display: flex;
  justify-content: space-between;
  padding: 11px 0;
}
dt {
  color: var(--muted);
}
dd {
  font-weight: 700;
  margin: 0;
}
.blockers {
  padding: 19px;
}
.blockers article {
  border-top: 1px solid var(--so-border);
  display: grid;
  gap: 14px;
  grid-template-columns: 210px 1fr;
  padding: 13px 0;
}
.blockers strong,
.blockers code {
  color: var(--amber);
}
.blockers p {
  color: var(--so-text-muted);
  margin: 0;
}
footer {
  color: var(--muted);
  font-size: 12px;
  text-align: right;
}
.blockers details summary,
footer details summary {
  min-height: var(--so-touch-target);
  display: inline-flex;
  align-items: center;
  color: var(--so-primary);
  cursor: pointer;
}
.blockers details {
  grid-column: 2;
}
footer details span {
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .hero,
  .verdict {
    align-items: flex-start;
    flex-direction: column;
    gap: 15px;
  }
  .identity-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .panel {
    overflow-x: auto;
  }
  .blockers article {
    grid-template-columns: 1fr;
  }
  .blockers details {
    grid-column: auto;
  }
  .hero {
    padding: 21px;
  }
  .gate-grid {
    gap: 6px;
  }
  .ring {
    height: 72px;
    width: 72px;
  }
}
</style>
