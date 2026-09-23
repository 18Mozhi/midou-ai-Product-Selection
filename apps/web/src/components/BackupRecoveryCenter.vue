<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import TechnicalDetails from "./TechnicalDetails.vue";
import BackupRecoveryDirectory from "./BackupRecoveryDirectory.vue";
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
type ViewState =
  | "loading"
  | "empty"
  | "blocked"
  | "stale"
  | "verified"
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
    return "读取超过 15 秒，已停止本次请求并保留上次成功的备份恢复事实。";
  if (refreshFailure.value === "rate_limited")
    return "刷新过于频繁，已保留上次成功的备份恢复事实；请稍后重试。";
  if (refreshFailure.value === "unavailable")
    return `${hint.value || "备份与恢复事实暂不可用，请在宝塔检查 Node API 与 MySQL。"} 已保留上次成功的备份恢复事实。`;
  return "";
});
const failureTitles: Partial<Record<ViewState, string>> = {
  expired: "登录已失效",
  forbidden: "你没有平台运维权限",
  rate_limited: "刷新过于频繁",
  timeout: "备份与恢复事实读取超时",
  unavailable: "备份与恢复事实暂不可用",
};
const failureTitle = computed(() => failureTitles[state.value] ?? "备份与恢复事实暂不可用");
const when = (value?: string | null) => (value ? new Date(value).toLocaleString() : "尚无记录");
const bytes = (value: number) => (value ? `${(value / 1024 / 1024).toFixed(1)} MB` : "0 MB");
const drillReminder = (remaining?: number | null) => {
  if (remaining == null) return "尚无演练证据";
  if (remaining < 0) return `已到期 ${Math.abs(remaining)} 天`;
  if (remaining === 0) return "今天到期";
  return `还剩 ${remaining} 天到期`;
};
const assetText = (value: string) =>
    (
      ({
        mysql_full: "数据库完整备份",
        mysql_binlog: "数据库增量日志",
        evidence: "采集证据",
        export: "导出文件",
        config: "非秘密配置",
      }) as Record<string, string>
    )[value] ?? "其他备份对象",
  roleText = (value: string) => (value === "recovery_copy" ? "恢复副本" : "主备份"),
  blockerText = (value: string) =>
    (
      ({
        backup_objective_unverified: "备份目标尚未核验",
        recovery_copy_unverified: "恢复副本尚未核验",
        isolated_restore_unverified: "隔离恢复尚未核验",
        restore_drill_stale: "恢复演练已过期",
      }) as Record<string, string>
    )[value] ?? "恢复条件未满足";
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
    const response = await request<any>("/platform/operations/backup-recovery", {
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
  <section class="backup-center backup-center--c">
    <header class="backup-hero">
      <div>
        <p class="eyebrow">P64 / 恢复证据</p>
        <h1>备份与恢复控制台</h1>
        <span>核对结论、目标和证据；此页只读取事实。</span>
      </div>
      <button
        ref="refreshButton"
        class="backup-read-action"
        type="button"
        :aria-disabled="refreshing"
        :aria-busy="refreshing"
        @click="load"
      >
        {{ refreshing ? "正在刷新…" : "刷新事实" }}
      </button>
    </header>
    <div class="p64-layout">
      <BackupRecoveryDirectory :has-data="Boolean(data)" />
      <div class="p64-content">
        <section
          v-if="data && refreshFailure"
          class="refresh-notice"
          :data-kind="refreshFailure"
          aria-live="polite"
          aria-labelledby="backup-refresh-title"
          :aria-busy="refreshing"
        >
          <div>
            <h2 id="backup-refresh-title">
              {{ refreshFailure === "timeout" ? "刷新已超时" : "刷新未完成" }}
            </h2>
            <span>{{ refreshNotice }}</span>
            <TechnicalDetails :request-id="readFailureId" summary="本次失败读取追踪" />
          </div>
          <button ref="noticeRetryButton" type="button" :disabled="refreshing" @click="load">
            重新核验
          </button>
        </section>
        <section
          v-if="state === 'loading'"
          class="state-card"
          data-kind="loading"
          aria-live="polite"
          aria-labelledby="backup-read-title"
          :aria-busy="refreshing"
        >
          <h2 id="backup-read-title">正在读取备份事实</h2>
          <span>校验数据库记录、恢复副本和最近演练。</span>
        </section>
        <section
          v-else-if="
            ['forbidden', 'expired', 'rate_limited', 'timeout', 'unavailable'].includes(state)
          "
          class="state-card"
          :data-kind="state"
          aria-live="polite"
          aria-labelledby="backup-read-title"
          :aria-busy="refreshing"
        >
          <h2 id="backup-read-title">{{ failureTitle }}</h2>
          <span>{{ hint || "请重新登录、稍后重试或联系平台管理员。" }}</span>
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
          <section class="truth-banner" :data-kind="state">
            <div>
              <small>当前结论</small
              ><strong>{{
                state === "verified"
                  ? "同机恢复链路已验证"
                  : state === "stale"
                    ? "恢复演练已过期"
                    : state === "empty"
                      ? "尚无备份记录"
                      : "恢复链路受阻"
              }}</strong>
            </div>
            <p>
              {{
                state === "verified"
                  ? "同机加密副本与隔离恢复均在有效期内；整机故障仍不受保护。"
                  : "未满足的条件不会被标记为健康；请按阻断项完成宝塔任务与隔离演练。"
              }}
            </p>
          </section>
          <section
            class="p64-objectives"
            id="p64-objectives"
            tabindex="-1"
            aria-labelledby="p64-objectives-title"
          >
            <h2 id="p64-objectives-title">恢复目标与实际</h2>
            <dl class="p64-regions">
              <div>
                <dt>主站 · 单机运行</dt>
                <dd>{{ data.policy.primary_region }}</dd>
              </div>
              <div>
                <dt>恢复目标</dt>
                <dd>
                  {{ data.policy.recovery_region }} ·
                  {{ data.recovery_copy_verified ? "同机副本已核验" : "同机副本未核验" }}
                </dd>
              </div>
            </dl>
            <div class="p64-comparisons">
              <section aria-label="数据库最多可丢失时间">
                <h3>数据库最多可丢失时间</h3>
                <dl>
                  <div>
                    <dt>目标上限</dt>
                    <dd>{{ data.policy.rpo_minutes }} min</dd>
                  </div>
                  <div>
                    <dt>实际记录</dt>
                    <dd>
                      {{
                        data.latest_backup?.actual_rpo_minutes == null
                          ? "未记录"
                          : `${data.latest_backup.actual_rpo_minutes} min`
                      }}
                    </dd>
                  </div>
                </dl>
              </section>
              <section aria-label="数据库恢复耗时">
                <h3>数据库恢复耗时</h3>
                <dl>
                  <div>
                    <dt>目标上限</dt>
                    <dd>{{ data.policy.rto_minutes }} min</dd>
                  </div>
                  <div>
                    <dt>实际记录</dt>
                    <dd>
                      {{
                        data.latest_drill?.actual_rto_minutes == null
                          ? "未记录"
                          : `${data.latest_drill.actual_rto_minutes} min`
                      }}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </section>
          <div class="backup-grid p64-sections">
            <section
              class="panel p64-evidence"
              id="p64-evidence"
              tabindex="-1"
              aria-labelledby="p64-evidence-title"
            >
              <div class="panel-title">
                <h2 id="p64-evidence-title">恢复证据</h2>
                <span>{{ data.policy.maximum_drill_age_days }} 天有效期</span>
              </div>
              <dl>
                <div>
                  <dt>最近备份</dt>
                  <dd>{{ when(data.latest_backup?.finished_at) }}</dd>
                </div>
                <div>
                  <dt>最近隔离恢复</dt>
                  <dd>{{ when(data.latest_drill?.finished_at) }}</dd>
                </div>
                <div class="drill-expiry" :data-expired="data.days_until_drill_expiry < 0">
                  <dt>演练证据到期</dt>
                  <dd>
                    {{ when(data.drill_expires_at) }}
                    <small>{{ drillReminder(data.days_until_drill_expiry) }}</small>
                  </dd>
                </div>
                <div>
                  <dt>权限边界</dt>
                  <dd>
                    {{ data.latest_drill?.permission_boundary_verified ? "已核验" : "未核验" }}
                  </dd>
                </div>
                <div>
                  <dt>审计链 / 证据哈希</dt>
                  <dd>
                    {{
                      data.latest_drill?.audit_chain_verified &&
                      data.latest_drill?.evidence_hash_verified
                        ? "已核验"
                        : "未核验"
                    }}
                  </dd>
                </div>
              </dl>
            </section>
            <section
              class="panel p64-assets"
              id="p64-assets"
              tabindex="-1"
              aria-labelledby="p64-assets-title"
            >
              <div class="panel-title">
                <h2 id="p64-assets-title">备份资产</h2>
                <span>按实际记录核对</span>
              </div>
              <div v-if="!data.targets.length" class="empty">没有可展示的备份资产。</div>
              <ResponsiveDataView
                v-else
                :rows="data.targets"
                :row-key="
                  (target) => `${target.asset_kind}-${target.region}-${target.storage_role}`
                "
                title="备份资产"
                :detail-title="(target) => assetText(target.asset_kind)"
                column-labels
              >
                <template #desktop>
                  <table>
                    <thead>
                      <tr>
                        <th>对象</th>
                        <th>角色</th>
                        <th>区域</th>
                        <th>数量</th>
                        <th>体积</th>
                        <th>完整性</th>
                        <th>技术信息</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="target in data.targets"
                        :key="`${target.asset_kind}-${target.region}-${target.storage_role}`"
                      >
                        <td>{{ assetText(target.asset_kind) }}</td>
                        <td>{{ roleText(target.storage_role) }}</td>
                        <td>{{ target.region }}</td>
                        <td>{{ target.bundle_count }}</td>
                        <td>{{ bytes(target.size_bytes) }}</td>
                        <td>{{ target.integrity_verified ? "已核验" : "未核验" }}</td>
                        <td>
                          <details>
                            <summary>技术详情</summary>
                            <dl>
                              <div>
                                <dt>对象代码</dt>
                                <dd>{{ target.asset_kind }}</dd>
                              </div>
                              <div>
                                <dt>存储角色代码</dt>
                                <dd>{{ target.storage_role }}</dd>
                              </div>
                            </dl>
                          </details>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </template>
                <template #summary="{ row }">
                  <span class="responsive-record-summary">
                    <strong
                      >{{ assetText(row.asset_kind) }} · {{ roleText(row.storage_role) }}</strong
                    >
                    <small
                      >{{ row.region }} · {{ row.bundle_count }} 份 ·
                      {{ bytes(row.size_bytes) }}</small
                    >
                  </span>
                </template>
                <template #detail="{ row }">
                  <dl>
                    <div>
                      <dt>备份角色</dt>
                      <dd>{{ roleText(row.storage_role) }}</dd>
                    </div>
                    <div>
                      <dt>区域</dt>
                      <dd>{{ row.region }}</dd>
                    </div>
                    <div>
                      <dt>文件数量</dt>
                      <dd>{{ row.bundle_count }} 份</dd>
                    </div>
                    <div>
                      <dt>总体积</dt>
                      <dd>{{ bytes(row.size_bytes) }}</dd>
                    </div>
                    <div>
                      <dt>加密</dt>
                      <dd>{{ row.encrypted ? "已加密" : "未核验" }}</dd>
                    </div>
                    <div>
                      <dt>完整性</dt>
                      <dd>{{ row.integrity_verified ? "已核验" : "未核验" }}</dd>
                    </div>
                  </dl>
                  <details>
                    <summary>技术详情</summary>
                    <dl>
                      <div>
                        <dt>对象代码</dt>
                        <dd>{{ row.asset_kind }}</dd>
                      </div>
                      <div>
                        <dt>存储角色代码</dt>
                        <dd>{{ row.storage_role }}</dd>
                      </div>
                    </dl>
                  </details>
                </template>
              </ResponsiveDataView>
            </section>
          </div>
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
            观测时间 {{ when(data.observed_at) }} · 恢复动作仅由宝塔受控任务执行
            <TechnicalDetails :request-id="requestId" summary="快照读取追踪" />
          </footer>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.backup-center {
  --ink: var(--so-text);
  --muted: var(--so-text-muted);
  --line: var(--so-border);
  --blue: var(--so-primary);
  --cyan: var(--so-primary);
  --green: var(--so-success);
  --amber: var(--so-warning);
  color: var(--ink);
  display: grid;
  gap: 18px;
}
.backup-hero {
  align-items: end;
  background:
    radial-gradient(
      circle at 78% 0,
      color-mix(in srgb, var(--so-info) 40%, transparent),
      transparent 42%
    ),
    linear-gradient(135deg, var(--so-bg-elevated), var(--so-bg-elevated));
  border: 1px solid var(--line);
  border-radius: 18px;
  display: flex;
  justify-content: space-between;
  min-height: 148px;
  padding: 28px;
}
.eyebrow {
  color: var(--cyan);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.18em;
  margin: 0 0 8px;
}
.backup-hero h2 {
  font-family: "Microsoft YaHei UI", sans-serif;
  font-size: 28px;
  margin: 0 0 8px;
}
.backup-hero span,
.state-card span {
  color: var(--muted);
}
button {
  background: var(--so-primary-strong);
  border: 1px solid var(--so-border-strong);
  border-radius: 9px;
  color: var(--so-on-primary);
  cursor: pointer;
  padding: 10px 16px;
}
button:disabled,
.backup-read-action[aria-disabled="true"] {
  cursor: wait;
  opacity: 0.7;
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
.state-card a {
  color: var(--so-primary);
  font-weight: 700;
  width: fit-content;
}
.truth-banner {
  align-items: center;
  background: var(--so-panel);
  border: 1px solid var(--line);
  border-left: 4px solid var(--amber);
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  padding: 17px 20px;
}
.truth-banner[data-kind="verified"] {
  border-left-color: var(--green);
}
.truth-banner small,
.policy-grid span,
.policy-grid small {
  color: var(--muted);
  display: block;
}
.truth-banner strong {
  display: block;
  font-size: 19px;
  margin-top: 4px;
}
.truth-banner p {
  color: var(--so-text);
  margin: 0;
  max-width: 610px;
}
.policy-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, 1fr);
}
.policy-grid article,
.panel,
.blockers,
.state-card {
  background: linear-gradient(160deg, var(--so-panel-soft), var(--so-panel-soft));
  border: 1px solid var(--line);
  border-radius: 13px;
}
.state-card h3,
.refresh-notice h3 {
  margin: 0;
  font-size: 18px;
}
.policy-grid article {
  padding: 17px;
}
.policy-grid strong {
  display: block;
  font-size: 23px;
  margin: 8px 0;
}
.backup-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: 1.55fr 1fr;
}
.panel {
  overflow: hidden;
  padding: 19px;
}
.panel-title {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.panel-title h3,
.blockers h3 {
  font-size: 15px;
  margin: 0 0 15px;
}
.panel-title span {
  color: var(--cyan);
  font-size: 13px;
}
table {
  border-collapse: collapse;
  width: 100%;
}
th,
td {
  border-bottom: 1px solid var(--so-border);
  padding: 12px 8px;
  text-align: left;
}
th {
  color: var(--muted);
  font-size: 13px;
  text-transform: uppercase;
}
td {
  font-size: 13px;
}
dl {
  display: grid;
  gap: 0;
  margin: 0;
}
dl div {
  border-bottom: 1px solid var(--so-border);
  padding: 11px 0;
}
dt {
  color: var(--muted);
  font-size: 13px;
}
dd {
  font-weight: 700;
  margin: 5px 0 0;
}
.drill-expiry small {
  color: var(--amber);
  display: block;
  font-weight: 700;
  margin-top: 5px;
}
.drill-expiry[data-expired="true"] small {
  color: var(--so-danger);
}
.blockers {
  padding: 19px;
}
.blockers article {
  align-items: start;
  border-top: 1px solid var(--so-border);
  display: grid;
  gap: 13px;
  grid-template-columns: minmax(180px, 0.5fr) 1fr;
  padding: 13px 0;
}
.blockers strong,
.blockers code {
  color: var(--amber);
}
.blockers p {
  color: var(--so-text);
  margin: 0;
}
.state-card {
  display: grid;
  gap: 7px;
  padding: 24px;
}
.empty,
footer {
  color: var(--muted);
  font-size: 13px;
  padding: 18px 0;
}
footer {
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
  .backup-hero,
  .truth-banner,
  .refresh-notice {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
  .policy-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .backup-grid {
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
  .backup-hero {
    padding: 21px;
  }
  .backup-hero h2 {
    font-size: 24px;
  }
}
</style>
<style src="../backup-recovery-center-c.css"></style>
