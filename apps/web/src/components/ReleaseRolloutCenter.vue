<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import TechnicalDetails from "./TechnicalDetails.vue";
const props = defineProps<{ apiBaseUrl: string; capabilities?: string[] }>();
const request = createApiClient(props.apiBaseUrl);
type ViewState =
  | "loading"
  | "empty"
  | "blocked"
  | "stale"
  | "verified"
  | "stopped"
  | "rolled_back"
  | "forbidden"
  | "expired"
  | "rate_limited"
  | "timeout"
  | "unavailable";
type RefreshFailure = "rate_limited" | "timeout" | "unavailable";
const state = ref<ViewState>("loading");
const data = ref<any>(null),
  requestId = ref(""),
  readFailureId = ref(""),
  hint = ref(""),
  refreshing = ref(false),
  refreshFailure = ref<RefreshFailure | null>(null);
let controller: AbortController | null = null;
let sequence = 0;
const refreshButton = ref<HTMLButtonElement | null>(null),
  retryButton = ref<HTMLButtonElement | null>(null),
  noticeRetryButton = ref<HTMLButtonElement | null>(null);
function handoffReadFocus() {
  const from = [retryButton.value, noticeRetryButton.value].find(
      (button) => button && button.ownerDocument.activeElement === button,
    ),
    to = refreshButton.value;
  if (
    !from?.isConnected ||
    !to?.isConnected ||
    from.closest("[inert]") ||
    to.closest("[inert]") ||
    !from.checkVisibility() ||
    !to.checkVisibility()
  )
    return;
  to.focus({ preventScroll: true });
  if (to.ownerDocument.activeElement !== to) return;
  const rect = to.getBoundingClientRect();
  if (
    rect.top < 0 ||
    rect.bottom > window.innerHeight ||
    !to.contains(
      to.ownerDocument.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
    )
  )
    to.scrollIntoView({ block: "center", inline: "nearest" });
}
const refreshNotice = computed(() => {
  if (refreshFailure.value === "timeout")
    return "读取超过 15 秒，已停止本次请求并保留上次成功的发布事实。";
  if (refreshFailure.value === "rate_limited")
    return "刷新过于频繁，已保留上次成功的发布事实；请稍后重试。";
  if (refreshFailure.value === "unavailable")
    return `${hint.value || "发布事实暂不可用，请在宝塔检查 Node API 与 MySQL。"} 已保留上次成功的发布事实。`;
  return "";
});
const failureTitles: Partial<Record<ViewState, string>> = {
  expired: "登录已失效",
  forbidden: "你没有平台运维权限",
  rate_limited: "刷新过于频繁",
  timeout: "发布事实读取超时",
  unavailable: "发布事实暂不可用",
};
const failureTitle = computed(() => failureTitles[state.value] ?? "发布事实暂不可用");
const time = (value?: string | null) => (value ? new Date(value).toLocaleString() : "尚无记录");
const gate = (kind: string) =>
  data.value?.gates?.find((item: any) => item.gate_kind === kind) ?? null;
const duration = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "尚无记录";
  const milliseconds = Number(value);
  return milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(1)} 秒`;
};
const metric = (value: number | null | undefined, unit: string) =>
  value == null || !Number.isFinite(value) ? "尚无记录" : `${value}${unit}`;
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
        current_release_evidence_missing: "当前版本缺少发布证据",
        release_identity_mismatch: "版本、迁移或配置不同源",
        release_source_mismatch: "本地、远端与生产版本不一致",
      }) as Record<string, string>
    )[value] ?? "发布条件未满足";
async function load() {
  if (controller) return;
  handoffReadFocus();
  const currentSequence = ++sequence;
  const requestController = new AbortController();
  const hasSnapshot = Boolean(data.value);
  const correlationId = crypto.randomUUID();
  controller = requestController;
  refreshing.value = true;
  refreshFailure.value = null;
  readFailureId.value = "";
  if (!hasSnapshot) state.value = "loading";
  hint.value = "";
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, 15_000);
  try {
    const response = await request<any>("/platform/operations/releases", {
      signal: requestController.signal,
      requestId: correlationId,
      traceId: correlationId,
    });
    if (currentSequence !== sequence) return;
    requestId.value = response.request_id;
    data.value = response.data;
    state.value = response.data?.state ?? "empty";
  } catch (error) {
    if (
      currentSequence !== sequence ||
      (error instanceof DOMException && error.name === "AbortError" && !timedOut)
    )
      return;
    if (timedOut) {
      readFailureId.value = correlationId;
      if (hasSnapshot) refreshFailure.value = "timeout";
      else state.value = "timeout";
      return;
    }
    const failure = error instanceof ApiClientError ? error : null;
    readFailureId.value = failure?.requestId ?? "";
    hint.value = failure?.actionHint ?? "";
    const failureState =
      failure?.kind === "expired" ||
      failure?.kind === "forbidden" ||
      failure?.kind === "rate_limited"
        ? failure.kind
        : "unavailable";
    if (hasSnapshot && failureState !== "expired" && failureState !== "forbidden")
      refreshFailure.value = failureState;
    else {
      data.value = null;
      requestId.value = "";
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
  <section class="release-center release-center--c">
    <header class="hero">
      <div>
        <p>P65 / 只读核验</p>
        <h1>发布证据</h1>
        <span>区分运行身份、部署捕获与历史观察记录。</span>
      </div>
      <button
        ref="refreshButton"
        class="release-read-action"
        type="button"
        :aria-disabled="refreshing"
        :aria-busy="refreshing"
        @click="load"
      >
        {{ refreshing ? "正在刷新…" : "刷新发布事实" }}
      </button>
      <RouterLink
        v-if="capabilities?.includes('platform:superadmin')"
        class="release-center__secondary-tool"
        to="/platform-admin/api-coverage"
        >查看接口覆盖证据</RouterLink
      >
    </header>
    <section
      v-if="data && refreshFailure"
      class="refresh-notice"
      :data-kind="refreshFailure"
      aria-live="polite"
      aria-labelledby="release-refresh-title"
      :aria-busy="refreshing"
    >
      <div>
        <h3 id="release-refresh-title">
          {{ refreshFailure === "timeout" ? "刷新已超时" : "刷新未完成" }}
        </h3>
        <span>{{ refreshNotice }}</span>
        <TechnicalDetails :request-id="readFailureId" summary="本次失败读取追踪" />
      </div>
      <button ref="noticeRetryButton" type="button" :disabled="refreshing" @click="load">
        重新核验
      </button>
    </section>
    <section
      v-if="state === 'loading'"
      class="state"
      :data-kind="state"
      aria-live="polite"
      aria-labelledby="release-read-title"
      :aria-busy="refreshing"
    >
      <h3 id="release-read-title">正在核验当前发布</h3>
      <span>读取运行身份、部署捕获与历史观察证据。</span>
    </section>
    <section
      v-else-if="['forbidden', 'expired', 'rate_limited', 'timeout', 'unavailable'].includes(state)"
      class="state danger"
      :data-kind="state"
      aria-live="polite"
      aria-labelledby="release-read-title"
      :aria-busy="refreshing"
    >
      <h3 id="release-read-title">{{ failureTitle }}</h3>
      <span>{{
        hint ||
        (state === "timeout"
          ? "读取超过 15 秒，已停止本次等待。请重新核验。"
          : "请重新登录、稍后重试或联系平台管理员。")
      }}</span>
      <TechnicalDetails :request-id="readFailureId" summary="本次失败读取追踪" />
      <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink>
      <button
        v-else-if="state !== 'forbidden'"
        ref="retryButton"
        type="button"
        :disabled="refreshing"
        @click="load"
      >
        重新核验
      </button>
    </section>
    <template v-else-if="data">
      <div class="p65-layout">
        <aside class="p65-directory">
          <h2>阅读发布证据</h2>
          <p>当前为单后端固定目录部署。5% / 25% / 100% 仅用于阅读历史观察记录。</p>
          <nav v-if="data" aria-label="发布证据页内导航">
            <a href="#p65-identities">运行身份</a>
            <a href="#p65-metrics">历史观察</a>
            <a href="#p65-actions">动作与历史</a>
          </nav>
          <p>此页没有发布、停止、回滚或迁移执行入口。</p>
        </aside>
        <div class="p65-content">
          <section class="verdict" :data-state="state">
            <div>
              <small>当前结论</small
              ><strong>{{
                state === "verified"
                  ? "发布门已通过"
                  : state === "rolled_back"
                    ? "服务返回回滚结论"
                    : state === "stopped"
                      ? "服务返回停止结论"
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
                  ? "服务返回观察门通过结论；不代表独立来源核验或本页执行了发布。"
                  : state === "rolled_back"
                    ? "请结合下方回滚记录与证据标记核对；该结论不表示本页执行或独立核验了回滚。"
                    : "结论由服务返回；请结合当前构建匹配记录、历史门指标和阻断说明核对。"
              }}
            </p>
          </section>
          <section
            id="p65-identities"
            class="p65-identities"
            tabindex="-1"
            aria-labelledby="p65-identities-title"
          >
            <h2 id="p65-identities-title">运行身份与部署捕获</h2>
            <p class="p65-source-note">
              来源字段可能由服务回退填充；返回文本一致不代表独立核验。部署捕获值不是刷新时实时查询
              Git。
            </p>
            <section class="p65-version p65-version-production" aria-label="生产运行身份">
              <h3>生产运行身份</h3>
              <dl>
                <div>
                  <dt>完整构建 SHA</dt>
                  <dd>
                    <code>{{ data.versions?.production?.build_sha || "未记录" }}</code>
                  </dd>
                </div>
                <div>
                  <dt>应用版本</dt>
                  <dd>{{ data.versions?.production?.app_version || "未记录" }}</dd>
                </div>
                <div>
                  <dt>迁移版本</dt>
                  <dd>
                    <code>{{ data.versions?.production?.migration_version || "未记录" }}</code>
                  </dd>
                </div>
              </dl>
              <details>
                <summary>配置技术详情</summary>
                <dl>
                  <div>
                    <dt>配置指纹</dt>
                    <dd>
                      <code>{{ data.versions?.production?.config_fingerprint || "未记录" }}</code>
                    </dd>
                  </div>
                </dl>
              </details>
            </section>
            <div class="p65-sources">
              <section class="p65-version p65-version-local" aria-label="本地构建输入">
                <h3>本地构建输入</h3>
                <dl>
                  <div>
                    <dt>完整构建 SHA</dt>
                    <dd>
                      <code>{{ data.versions?.local?.build_sha || "未记录" }}</code>
                    </dd>
                  </div>
                </dl>
              </section>
              <section class="p65-version p65-version-remote" aria-label="远端部署捕获">
                <h3>远端部署捕获</h3>
                <dl>
                  <div>
                    <dt>完整构建 SHA</dt>
                    <dd>
                      <code>{{ data.versions?.remote?.build_sha || "未记录" }}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>仓库</dt>
                    <dd>
                      <code>{{ data.versions?.remote?.repository || "未记录仓库" }}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>分支</dt>
                    <dd>
                      <code>{{ data.versions?.remote?.branch || "未记录" }}</code>
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
            <section class="p65-match">
              <h3>当前构建匹配记录</h3>
              <p v-if="!data.latest_release">当前构建尚无匹配发布记录。</p>
              <dl v-else>
                <div>
                  <dt>构建 SHA</dt>
                  <dd>
                    <code>{{ data.latest_release.build_sha || "未记录" }}</code>
                  </dd>
                </div>
                <div>
                  <dt>记录状态</dt>
                  <dd>{{ statusText(data.latest_release.status) }}</dd>
                </div>
                <div>
                  <dt>完成时间</dt>
                  <dd>{{ time(data.latest_release.finished_at) }}</dd>
                </div>
              </dl>
            </section>
          </section>
          <div v-if="false" class="identity-grid">
            <article>
              <span>本地发布提交</span><strong>{{ sha(data.versions?.local?.build_sha) }}</strong
              ><small>部署器构建输入</small>
            </article>
            <article>
              <span>远端主分支</span><strong>{{ sha(data.versions?.remote?.build_sha) }}</strong
              ><small
                >{{ data.versions?.remote?.repository || "未记录仓库" }} ·
                {{ data.versions?.remote?.branch || "—" }}</small
              >
            </article>
            <article>
              <span>生产运行版本</span
              ><strong>{{ sha(data.versions?.production?.build_sha) }}</strong
              ><small>{{ data.versions?.production?.app_version || "未签发" }}</small>
            </article>
            <article>
              <span>版本同源</span
              ><strong>{{
                data.blockers.some(
                  (item: any) =>
                    item.code === "release_source_mismatch" ||
                    item.code === "release_identity_mismatch",
                )
                  ? "已阻断"
                  : "一致"
              }}</strong
              ><small>SHA / 配置指纹 / 迁移</small>
            </article>
            <article>
              <span>迁移</span
              ><strong>{{ data.versions?.production?.migration_version || "—" }}</strong
              ><small>迁移耗时 {{ duration(gate("migration")?.duration_ms) }}</small>
            </article>
            <article>
              <span>回滚耗时</span><strong>{{ duration(gate("rollback")?.duration_ms) }}</strong
              ><small>{{
                gate("rollback") ? statusText(gate("rollback")?.status) : "尚未发生回滚"
              }}</small>
            </article>
            <article>
              <span>发布状态</span><strong>{{ statusText(data.latest_release?.status) }}</strong
              ><small>{{ time(data.latest_release?.finished_at) }}</small>
            </article>
          </div>
          <section v-if="false" class="panel p65-legacy-stages">
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
                  statusText(
                    data.gates.find((g: any) => g.gate_kind === `canary_${percent}`)?.status,
                  )
                }}</b
                ><small
                  >观察
                  {{
                    data.gates.find((g: any) => g.gate_kind === `canary_${percent}`)
                      ?.observe_seconds || 0
                  }}
                  秒</small
                >
              </article>
            </div>
          </section>
          <div class="detail-grid">
            <section
              id="p65-metrics"
              class="panel p65-metrics"
              tabindex="-1"
              aria-labelledby="p65-metrics-title"
            >
              <header>
                <h2 id="p65-metrics-title">历史观察门指标</h2>
                <span>只读历史记录，不是当前分流或发布操作</span>
              </header>
              <ResponsiveDataView
                :rows="data.gates.filter((gate: any) => gate.gate_kind.startsWith('canary_'))"
                :row-key="(gate) => gate.id"
                title="发布门禁指标"
                :detail-title="(gate) => `${gate.traffic_percent}% 观察门`"
                :column-labels="true"
                column-help="至少保留一列"
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
                        v-for="gate in data.gates.filter((g: any) =>
                          g.gate_kind.startsWith('canary_'),
                        )"
                        :key="gate.id"
                      >
                        <td>{{ gate.traffic_percent }}%</td>
                        <td>{{ metric(gate.error_rate_percent, "%") }}</td>
                        <td>{{ metric(gate.read_p95_ms, " ms") }}</td>
                        <td>{{ metric(gate.write_p95_ms, " ms") }}</td>
                        <td>{{ metric(gate.async_lag_seconds, " s") }}</td>
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
                      >错误 {{ metric(row.error_rate_percent, "%") }} · 读取
                      {{ metric(row.read_p95_ms, " ms") }}</small
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
                      <dd>{{ metric(row.error_rate_percent, "%") }}</dd>
                    </div>
                    <div>
                      <dt>95% 读取耗时</dt>
                      <dd>{{ metric(row.read_p95_ms, " ms") }}</dd>
                    </div>
                    <div>
                      <dt>95% 写入耗时</dt>
                      <dd>{{ metric(row.write_p95_ms, " ms") }}</dd>
                    </div>
                    <div>
                      <dt>异步延迟</dt>
                      <dd>{{ metric(row.async_lag_seconds, " 秒") }}</dd>
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
                <h3>历史观察策略</h3>
                <span>记录对应的阈值要求</span>
              </header>
              <p>
                每阶段至少 {{ data.policy.minimum_observation_seconds }} 秒；证据有效期
                {{ data.policy.maximum_evidence_age_minutes }} 分钟。比例要求
                {{ data.policy.percentages.join(" / ") }}%。
              </p>
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
          <section
            id="p65-actions"
            class="p65-actions"
            tabindex="-1"
            aria-labelledby="p65-actions-title"
          >
            <h2 id="p65-actions-title">动作计时与最近历史</h2>
            <div class="p65-sources">
              <section>
                <h3>迁移记录</h3>
                <dl>
                  <div>
                    <dt>耗时</dt>
                    <dd>{{ duration(gate("migration")?.duration_ms) }}</dd>
                  </div>
                  <div>
                    <dt>门状态</dt>
                    <dd>
                      {{ gate("migration") ? statusText(gate("migration")?.status) : "尚无记录" }}
                    </dd>
                  </div>
                </dl>
              </section>
              <section>
                <h3>回滚记录</h3>
                <dl>
                  <div>
                    <dt>耗时</dt>
                    <dd>{{ duration(gate("rollback")?.duration_ms) }}</dd>
                  </div>
                  <div>
                    <dt>门状态</dt>
                    <dd>
                      {{ gate("rollback") ? statusText(gate("rollback")?.status) : "尚无记录" }}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
            <dl>
              <div>
                <dt>自动停止证据</dt>
                <dd>{{ data.automatic_stop_verified ? "已记录" : "未核验" }}</dd>
              </div>
              <div>
                <dt>回滚证据</dt>
                <dd>{{ data.rollback_verified ? "已记录" : "未核验" }}</dd>
              </div>
            </dl>
            <section class="p65-history">
              <h3>最近一条历史记录</h3>
              <p>该记录不一定属于当前构建，不能据此推导其观察门。</p>
              <p v-if="!data.latest_historical_release">尚无历史发布记录。</p>
              <dl v-else>
                <div>
                  <dt>构建 SHA</dt>
                  <dd>
                    <code>{{ data.latest_historical_release.build_sha || "未记录" }}</code>
                  </dd>
                </div>
                <div>
                  <dt>记录状态</dt>
                  <dd>{{ statusText(data.latest_historical_release.status) }}</dd>
                </div>
                <div>
                  <dt>完成时间</dt>
                  <dd>{{ time(data.latest_historical_release.finished_at) }}</dd>
                </div>
              </dl>
            </section>
          </section>
          <section v-if="data.blockers.length" class="blockers">
            <h2>阻断项</h2>
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
            观测 {{ time(data.observed_at) }}
            <TechnicalDetails :request-id="requestId" summary="快照读取追踪" />
          </footer>
        </div>
      </div>
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
  font-size: 13px;
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
button:disabled {
  cursor: wait;
  opacity: 0.7;
}
.release-read-action[aria-disabled="true"] {
  cursor: wait;
  opacity: 0.7;
}
.state h3,
.refresh-notice h3 {
  margin: 0;
  font-size: 18px;
}
.refresh-notice {
  align-items: center;
  background: color-mix(in srgb, var(--so-warning) 10%, var(--so-panel));
  border: 1px solid color-mix(in srgb, var(--so-warning) 55%, var(--so-border));
  border-radius: 12px;
  display: flex;
  gap: 18px;
  justify-content: space-between;
  padding: 16px 20px;
}
.refresh-notice div {
  display: grid;
  gap: 5px;
}
.refresh-notice span,
.refresh-notice code {
  color: var(--muted);
  overflow-wrap: anywhere;
}
.state a {
  color: var(--so-primary);
  font-weight: 700;
  width: fit-content;
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
  grid-template-columns: repeat(3, 1fr);
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
  font-size: 13px;
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
  font-size: 13px;
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
  font-size: 13px;
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
  .verdict,
  .refresh-notice {
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

<style scoped>
:global(html body:has(#app .release-center--c)) {
  background: #f3f6fb;
  color: #172d4c;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
}
:global(html body:has(#app .release-center--c) #app .role-shell) {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  grid-template-rows: 76px minmax(0, 1fr);
  min-height: 100dvh;
  padding: 0;
  background: #f3f6fb;
  color: #172d4c;
  font-family: inherit;
}
:global(html body:has(#app .release-center--c) #app .role-topbar) {
  grid-column: 1 / -1;
  position: relative;
  inset: auto;
  height: 76px;
  min-height: 0;
  padding: 0 24px;
  border: 0;
  border-bottom: 1px solid #d8e2ef;
  background: #fff;
}
:global(html body:has(#app .release-center--c) #app .role-brand) {
  gap: 12px;
  color: #172d4c;
}
:global(html body:has(#app .release-center--c) #app .role-brand > span) {
  border: 0;
  border-radius: 8px;
  background: #244bb0;
  color: #fff;
}
:global(html body:has(#app .release-center--c) #app .role-brand > b) {
  font-family: inherit;
  font-size: 16px;
  letter-spacing: 0.06em;
}
:global(html body:has(#app .release-center--c) #app .role-brand > em) {
  color: #536985;
  font-size: 13px;
  letter-spacing: 0;
}
:global(html body:has(#app .release-center--c) #app .role-top-actions :is(a, button)) {
  min-height: 44px;
  min-width: 44px;
  border: 1px solid #d8e2ef;
  border-radius: 7px;
  background: #fff;
  color: #172d4c;
}
:global(html body:has(#app .release-center--c) #app .role-sidebar) {
  grid-column: 1;
  grid-row: 2;
  position: sticky;
  inset: auto;
  top: 0;
  align-self: start;
  box-sizing: border-box;
  width: 240px;
  height: calc(100dvh - 76px);
  padding: 22px 16px;
  overflow-y: auto;
  border: 0;
  border-radius: 0;
  background: #244bb0;
  color: #fff;
  transform: none;
  transition: none;
}
:global(html body:has(#app .release-center--c) #app .role-sidebar-head) {
  width: auto;
  padding: 0 8px 20px;
  gap: 7px;
  border: 0;
}
:global(html body:has(#app .release-center--c) #app .role-sidebar-head strong) {
  color: #fff;
  font:
    700 18px/1.5 "Microsoft YaHei",
    sans-serif;
}
:global(html body:has(#app .release-center--c) #app .role-sidebar-head small) {
  color: #e2ebff;
  font:
    13px/1.7 "Microsoft YaHei",
    sans-serif;
  white-space: normal;
}
:global(html body:has(#app .release-center--c) #app .role-menu-search) {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  margin-bottom: 16px;
  padding: 0 10px;
  border: 1px solid #91afea;
  border-radius: 7px;
  background: #fff;
  color: #172d4c;
}
:global(html body:has(#app .release-center--c) #app .role-menu-search input) {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  border: 0;
  background: #fff;
  color: #172d4c;
  font:
    16px/1.5 "Microsoft YaHei",
    sans-serif;
}
:global(html body:has(#app .release-center--c) #app .role-nav-groups) {
  display: grid;
  flex: none;
  gap: 8px;
  overflow: visible;
}
:global(html body:has(#app .release-center--c) #app .role-nav-groups details) {
  border: 0;
}
:global(html body:has(#app .release-center--c) #app .role-nav-groups details > summary) {
  height: auto;
  min-height: 44px;
  padding: 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #fff;
  font-size: 14px;
  letter-spacing: 0;
}
:global(html body:has(#app .release-center--c) #app .role-nav-groups summary:hover),
:global(html body:has(#app .release-center--c) #app .role-nav-menu a:hover) {
  background: #365fc6;
}
:global(html body:has(#app .release-center--c) #app .role-nav-menu) {
  position: static;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
:global(html body:has(#app .release-center--c) #app .role-nav-menu a) {
  min-width: 0;
  min-height: 44px;
  margin: 3px 0;
  padding: 10px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #eef3ff;
  font-size: 14px;
}
:global(html body:has(#app .release-center--c) #app .role-nav-menu a[aria-current="page"]) {
  background: #fff;
  color: #244bb0;
  font-weight: 700;
}
:global(html body:has(#app .release-center--c) #app .role-sidebar-utility) {
  display: grid;
  margin: 24px 0 0;
  border: 0;
}
:global(html body:has(#app .release-center--c) #app .role-sidebar-utility a) {
  width: auto;
  min-height: 44px;
  padding: 10px 8px;
  border: 0;
  border-top: 1px solid #7595db;
  border-radius: 0;
  background: transparent;
  color: #fff;
  font-size: 14px;
  white-space: normal;
}
:global(html body:has(#app .release-center--c) #app .role-content) {
  grid-column: 2;
  grid-row: 2;
  min-width: 0;
  max-width: none;
  margin: 0;
  padding: 24px 32px 48px;
}
:global(html body:has(#app .release-center--c) #app .role-context-rail) {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin: 0 0 24px;
  padding: 12px 0;
  border: 0;
  border-block: 1px solid #d8e2ef;
  border-radius: 0;
  background: transparent;
}
:global(html body:has(#app .release-center--c) #app .role-context-rail > div) {
  padding: 0;
  border: 0;
}
:global(html body:has(#app .release-center--c) #app .role-context-rail small) {
  color: #536985;
  font:
    13px/1.5 "Microsoft YaHei",
    sans-serif;
}
:global(html body:has(#app .release-center--c) #app .role-context-rail strong) {
  margin-top: 3px;
  color: #172d4c;
  font-size: 14px;
}
:global(html body:has(#app .release-center--c) #app .role-context-drawer) {
  display: none;
}
:global(html body:has(#app .release-center--c) #app .role-mobile-nav) {
  display: none;
}
:global(
  html
    body:has(#app .release-center--c)
    #app
    .role-shell
    :is(a, button, input, summary):focus-visible
) {
  outline: 3px solid #4878e9;
  outline-offset: 3px;
}
@media (max-width: 1100px) and (min-width: 841px) {
  :global(html body:has(#app .release-center--c) #app .role-shell) {
    grid-template-columns: 220px minmax(0, 1fr);
  }
  :global(html body:has(#app .release-center--c) #app .role-sidebar) {
    width: 220px;
    padding-inline: 12px;
  }
  :global(html body:has(#app .release-center--c) #app .role-content) {
    padding-inline: 20px;
  }
}
@media (max-width: 840px) {
  :global(html body:has(#app .release-center--c) #app .role-shell) {
    display: block;
    padding: 0 0 calc(80px + env(safe-area-inset-bottom));
  }
  :global(html body:has(#app .release-center--c) #app .role-topbar) {
    height: 64px;
    padding: 0 12px;
    gap: 8px;
  }
  :global(html body:has(#app .release-center--c) #app .role-brand) {
    margin-right: auto;
    gap: 0;
  }
  :global(html body:has(#app .release-center--c) #app .role-brand > :is(b, em)) {
    display: none;
  }
  :global(html body:has(#app .release-center--c) #app .role-menu-toggle) {
    display: inline-flex;
  }
  :global(html body:has(#app .release-center--c) #app .role-content) {
    padding: 18px 16px 32px;
  }
  :global(html body:has(#app .release-center--c) #app .role-context-rail) {
    display: none;
  }
  :global(html body:has(#app .release-center--c) #app .role-context-drawer) {
    display: block;
    margin-bottom: 20px;
    border: 1px solid #d8e2ef;
    border-radius: 7px;
    background: #fff;
  }
  :global(html body:has(#app .release-center--c) #app .role-context-drawer > div) {
    grid-template-columns: 1fr 1fr;
  }
  :global(html body:has(#app .release-center--c) #app .platform-secondary-nav) {
    display: flex;
    overflow-x: auto;
  }
  :global(html body:has(#app .release-center--c) #app .role-sidebar) {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 100;
    width: min(340px, calc(100vw - 32px));
    height: 100dvh;
    max-height: 100dvh;
    padding: 16px;
    overflow-y: auto;
    box-shadow: 12px 0 32px rgb(12 29 54 / 24%);
  }
  :global(html body:has(#app .release-center--c) #app .role-sidebar:not(.is-open)) {
    display: none;
  }
  :global(html body:has(#app .release-center--c) #app .role-mobile-nav) {
    position: fixed;
    inset: auto 0 0;
    z-index: 90;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    min-height: 72px;
    border: 0;
    border-top: 1px solid #d8e2ef;
    background: #fff;
  }
  :global(html body:has(#app .release-center--c) #app .role-mobile-nav :is(a, button, i)) {
    color: #536985;
  }
  :global(html body:has(#app .release-center--c) #app .role-mobile-nav [aria-current="page"]) {
    background: #e8efff;
    color: #244bb0;
  }
}
:global(body:has(.release-center--c) #app .platform-secondary-nav) {
  background: #fff;
  border: 1px solid #c7d3e4;
  gap: 0;
}
:global(body:has(.release-center--c) #app .platform-secondary-nav a) {
  min-height: 44px;
  background: #fff;
  color: #526278;
  border: 0;
  border-bottom: 3px solid transparent;
  box-shadow: none;
}
:global(body:has(.release-center--c) #app .platform-secondary-nav a[aria-current="page"]) {
  color: #1249b8;
  background: #edf3ff;
  border-bottom-color: #1249b8;
}
.release-center--c {
  --so-text: #182739;
  --so-text-muted: #526278;
  --so-border: #c7d3e4;
  --so-primary: #1249b8;
  --so-primary-strong: #1249b8;
  --so-on-primary: #fff;
  --so-panel: #fff;
  --so-panel-soft: #fff;
  --so-bg-elevated: #fff;
  color: #182739;
  font:
    16px/1.65 "Microsoft YaHei",
    "PingFang SC",
    sans-serif;
  gap: 20px;
  min-width: 0;
}
.release-center--c h1,
.release-center--c h2,
.release-center--c h3 {
  color: #182739;
  font-family: inherit;
  font-weight: 700;
}
.release-center--c h1 {
  font-size: 32px;
  line-height: 1.3;
  margin: 4px 0 10px;
}
.release-center--c h2 {
  font-size: 23px;
  line-height: 1.4;
  margin: 0 0 16px;
}
.release-center--c h3 {
  font-size: 18px;
  margin: 0 0 14px;
}
.release-center--c p {
  overflow-wrap: anywhere;
}
.release-center--c .hero {
  align-items: center;
  background: none;
  border: 0;
  border-radius: 0;
  flex-wrap: wrap;
  gap: 20px;
  min-height: 0;
  padding: 0;
}
.release-center--c .hero > div {
  flex: 1 1 420px;
}
.release-center--c .hero p {
  color: #1249b8;
  letter-spacing: 0.08em;
  margin: 0;
}
.release-center--c .hero span {
  color: #526278;
}
.release-center--c .release-read-action,
.release-center--c .release-center__secondary-tool {
  align-items: center;
  background: #1249b8;
  border: 1px solid #1249b8;
  border-radius: 0;
  color: #fff;
  display: inline-flex;
  justify-content: center;
  min-height: 44px;
  padding: 10px 16px;
  text-decoration: none;
}
.release-center--c :is(button, a, summary, select, input):focus-visible {
  outline: 3px solid #1249b8;
  outline-offset: 3px;
}
.release-center--c button:disabled,
.release-center--c [aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.58;
}
.release-center--c .p65-layout {
  align-items: start;
  display: grid;
  gap: 28px;
  grid-template-columns: 220px minmax(0, 1fr);
}
.release-center--c .p65-directory {
  align-self: start;
  background: #1249b8;
  color: #fff;
  padding: 24px;
}
.release-center--c .p65-directory :is(h2, p, a) {
  color: #fff;
}
.release-center--c .p65-directory nav {
  display: grid;
  gap: 8px;
  margin: 24px 0;
}
.release-center--c .p65-directory a {
  border-bottom: 1px solid #7196e2;
  min-height: 44px;
  padding: 12px 0;
  text-decoration: none;
}
.release-center--c .p65-directory a:hover {
  text-decoration: underline;
}
.release-center--c .p65-directory p:last-child {
  font-size: 14px;
  margin: 0;
}
.release-center--c .p65-content {
  display: grid;
  gap: 24px;
  min-width: 0;
}
.release-center--c
  :is(.verdict, .p65-identities, .p65-actions, .panel, .blockers, .state, .refresh-notice) {
  background: #fff;
  border: 1px solid #c7d3e4;
  border-radius: 0;
  min-width: 0;
  padding: 24px;
}
.release-center--c .identity-grid,
.release-center--c .p65-legacy-stages {
  display: none;
}
.release-center--c .verdict {
  border-left: 4px solid #1249b8;
  display: block;
}
.release-center--c .verdict strong {
  font-size: 23px;
}
.release-center--c .verdict p {
  margin: 12px 0 0;
  max-width: none;
}
.release-center--c .p65-identities {
  display: block;
}
.release-center--c .p65-source-note {
  background: #edf3ff;
  color: #29446e;
  padding: 16px;
}
.release-center--c .p65-sources {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr 1fr;
}
.release-center--c .p65-version,
.release-center--c .p65-match,
.release-center--c .p65-history {
  margin-top: 24px;
  min-width: 0;
}
.release-center--c .p65-version-production {
  border-bottom: 1px solid #c7d3e4;
  margin-top: 0;
  padding-bottom: 12px;
}
.release-center--c .p65-match,
.release-center--c .p65-history {
  border-top: 1px solid #c7d3e4;
  padding-top: 20px;
}
.release-center--c dl {
  margin: 0;
}
.release-center--c dl > div {
  border-bottom: 1px solid #e5ebf3;
  display: block;
  min-width: 0;
  padding: 12px 0;
}
.release-center--c dt {
  color: #526278;
  font-size: 14px;
}
.release-center--c dd {
  color: #182739;
  font-size: 16px;
  font-weight: 600;
  margin: 5px 0 0;
  overflow-wrap: anywhere;
  text-align: left;
}
.release-center--c code {
  color: #29446e;
  font:
    15px/1.65 Consolas,
    monospace;
  overflow-wrap: anywhere;
  white-space: normal;
}
.release-center--c .panel > header {
  display: block;
  margin-bottom: 18px;
}
.release-center--c .panel header span {
  color: #526278;
  font-size: 14px;
}
.release-center--c .threshold > dl {
  display: grid;
  gap: 0 24px;
  grid-template-columns: 1fr 1fr;
}
.release-center--c .p65-metrics,
.release-center--c .responsive-data-view__desktop {
  overflow: visible;
}
.release-center--c .responsive-data-view {
  min-width: 0;
}
.release-center--c table {
  border: 0;
  border-collapse: collapse;
  box-shadow: none;
  min-width: 640px;
  width: 100%;
}
.release-center--c :is(th, td) {
  border: 0;
  border-bottom: 1px solid #c7d3e4;
  font-size: 14px;
  padding: 12px 10px;
  text-align: left;
  vertical-align: top;
}
.release-center--c th {
  background: #f3f6fa;
  color: #526278;
}
.release-center--c td {
  background: #fff;
}
.release-center--c .blockers h2 {
  margin-bottom: 16px;
}
.release-center--c .blockers article {
  border-top: 1px solid #c7d3e4;
  display: grid;
  gap: 14px;
  grid-template-columns: 210px 1fr;
  padding: 13px 0;
}
.release-center--c .blockers details {
  grid-column: 2;
}
.release-center--c footer {
  color: #526278;
  font-size: 13px;
}
.release-center--c :is(.blockers details summary, footer details summary) {
  align-items: center;
  color: #1249b8;
  cursor: pointer;
  display: inline-flex;
  min-height: var(--so-touch-target);
}
.release-center--c :is(.blockers p, footer details span) {
  overflow-wrap: anywhere;
}
@media (max-width: 900px) {
  .release-center--c .p65-layout {
    grid-template-columns: 1fr;
  }
  .release-center--c .p65-directory nav {
    display: flex;
    flex-wrap: wrap;
  }
}
@media (max-width: 760px) {
  .release-center--c :is(.hero, .verdict, .refresh-notice) {
    align-items: flex-start;
    flex-direction: column;
    gap: 15px;
  }
  .release-center--c .p65-sources,
  .release-center--c .threshold > dl {
    grid-template-columns: 1fr;
  }
  .release-center--c .panel {
    overflow-x: auto;
  }
  .release-center--c .blockers article {
    grid-template-columns: 1fr;
  }
  .release-center--c .blockers details {
    grid-column: auto;
  }
  .release-center--c .hero {
    padding: 0;
  }
}
</style>
