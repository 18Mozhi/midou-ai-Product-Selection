<script setup lang="ts">
import { computed } from "vue";
import { useAlibaba1688Acceptance } from "../composables/useAlibaba1688Acceptance";
import ProviderAcceptanceEvidence from "./ProviderAcceptanceEvidence.vue";
import ProviderAcceptanceExecution from "./ProviderAcceptanceExecution.vue";
import ProviderAcceptanceOperations from "./ProviderAcceptanceOperations.vue";

const props = defineProps<{ apiBaseUrl: string }>();
const page = useAlibaba1688Acceptance(props.apiBaseUrl);
const {
  state,
  data,
  message,
  readNotice,
  readNoticeTone,
  refreshing,
  lastUpdatedAt,
  readRequestId,
  readFailureRequestId,
  organizations,
  workspaces,
  selectedOrganizationId,
  selectedWorkspaceId,
  acceptanceQuery,
  scopeLoading,
  scopeMessage,
  scopeRequestId,
  scopeRetryable,
  reactivating,
  scheduling,
  runOutcome,
  canSchedule,
  load,
  selectOrganization,
  retryExecutionScopes,
  scheduleAcceptanceRun,
} = page;

const gateState = { passed: "已通过", blocked: "已阻断", pending: "待验收" } as const;
const overallState = {
  setup_required: "尚未满足启用条件",
  ready_for_enable: "门禁已通过，等待负责人启用",
  production_ready: "来源已启用",
} as const;
const runState: Record<string, string> = {
  scheduled: "等待执行",
  leased: "已领取",
  running: "执行中",
  succeeded: "运行成功",
  succeeded_empty: "运行成功但无结果",
  failed: "运行失败",
  blocked: "运行受阻",
  cancelled: "已取消",
  dead_letter: "进入死信",
};
const passedGateCount = computed(
  () => data.value?.gates.filter((gate) => gate.state === "passed").length ?? 0,
);
const title = computed(() => (data.value ? overallState[data.value.overall] : "1688 启用检查"));
const conclusion = computed(() => {
  if (data.value?.overall === "production_ready")
    return "来源已经启用，仍应持续关注登录有效期、验证码和解析合同漂移。";
  if (data.value?.overall === "ready_for_enable")
    return "三道验收门均已通过；仍需由来源负责人显式启用，系统不会自动放行。";
  return "登录、验证码和字段解析必须全部通过；任一待验收或阻断都会保持来源停用。";
});
const stateTitle = computed(
  () =>
    ({
      loading: "正在读取启用条件",
      error: "启用检查服务暂不可用",
      forbidden: "当前账号无权读取启用条件",
      expired: "登录已失效",
      ready: "",
    })[state.value],
);
const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value
    ? new Date(lastUpdatedAt.value).toLocaleTimeString("zh-CN", { hour12: false })
    : "尚未完成读取",
);
const credentialsLink = computed(() =>
  data.value
    ? `/platform-admin/credentials?provider_id=${data.value.provider_id}&mode=login`
    : "/platform-admin/credentials",
);
const sampleLink = computed(() =>
  data.value
    ? `/platform-admin/providers/sources?provider_id=${data.value.provider_id}`
    : "/platform-admin/providers/sources",
);
const currentRunState = computed(() => {
  const status = data.value?.latest_run?.status;
  return status ? (runState[status] ?? status) : "尚无运行";
});
</script>

<template>
  <section class="acceptance-1688" :data-state="state" :aria-busy="refreshing">
    <div class="acceptance-1688__layout">
      <aside class="acceptance-1688__rail" aria-label="1688 来源检查摘要">
        <div class="acceptance-1688__identity">
          <span class="acceptance-1688__mark" aria-hidden="true">1688</span>
          <div>
            <p>平台来源 · 启用检查</p>
            <h2>1688</h2>
          </div>
        </div>
        <div class="acceptance-1688__rail-state" :data-overall="data?.overall || 'loading'">
          <span>服务端结论</span
          ><strong>{{ data ? overallState[data.overall] : stateTitle }}</strong>
          <p>{{ data ? conclusion : "正在读取来源启用证据。" }}</p>
        </div>
        <dl class="acceptance-1688__rail-stats">
          <div>
            <dt>来源编号</dt>
            <dd>{{ data?.provider_id || "读取中" }}</dd>
          </div>
          <div>
            <dt>通过门禁</dt>
            <dd>{{ data ? `${passedGateCount} / 3` : "—" }}</dd>
          </div>
          <div>
            <dt>责任人</dt>
            <dd>{{ data?.owner_label || "—" }}</dd>
          </div>
        </dl>
        <nav v-if="data" aria-label="来源配置入口">
          <RouterLink :to="credentialsLink">登录档案 <span aria-hidden="true">↗</span></RouterLink
          ><RouterLink :to="sampleLink">固定样本 <span aria-hidden="true">↗</span></RouterLink>
        </nav>
        <details class="acceptance-1688__rail-context">
          <summary>检查口径</summary>
          <p>
            登录态、验证码与字段解析是三项独立启用门；搜索、详情、翻页覆盖单独记录，不替代门禁。
          </p>
          <p>页面不会显示 Cookie 或账号秘密。</p>
        </details>
      </aside>

      <main class="acceptance-1688__content">
        <header class="acceptance-1688__hero">
          <div>
            <p class="acceptance-1688__eyebrow">来源治理 / 1688</p>
            <h1>启用检查</h1>
            <p>逐项核对真实证据，再由来源负责人决定是否启用。</p>
          </div>
          <div class="acceptance-1688__refresh">
            <small>最近读取 {{ lastUpdatedLabel }}</small
            ><button type="button" :disabled="refreshing" @click="load()">
              {{ refreshing ? "刷新中…" : "刷新检查结果" }}
            </button>
          </div>
        </header>

        <p
          v-if="reactivating"
          class="acceptance-1688__notice acceptance-1688__lifecycle-notice"
          role="status"
          aria-live="polite"
        >
          页面已恢复，正在重新读取启用检查和执行范围。
        </p>

        <p
          v-if="readNotice"
          class="acceptance-1688__notice"
          :data-tone="readNoticeTone"
          role="status"
          aria-live="polite"
        >
          {{ readNotice }}
          <details v-if="readFailureRequestId">
            <summary>本次读取追踪</summary>
            <code>读取关联编号：{{ readFailureRequestId }}</code>
          </details>
        </p>

        <section v-if="state !== 'ready'" class="acceptance-1688__state" :data-kind="state">
          <span aria-hidden="true">{{ state === "loading" ? "···" : "!" }}</span>
          <div aria-live="polite">
            <p>启用检查</p>
            <h3>{{ stateTitle }}</h3>
            <p>{{ message || "正在核对登录、验证码和字段解析三项证据。" }}</p>
            <details v-if="readFailureRequestId">
              <summary>故障详情</summary>
              <code>关联编号：{{ readFailureRequestId }}</code>
            </details>
          </div>
          <RouterLink v-if="state === 'expired'" to="/login">重新登录</RouterLink
          ><RouterLink v-else-if="state === 'forbidden'" to="/platform-admin"
            >返回平台概览</RouterLink
          ><button
            v-else-if="state !== 'loading'"
            type="button"
            :disabled="refreshing"
            @click="load()"
          >
            重新读取
          </button>
        </section>

        <template v-else-if="data">
          <ProviderAcceptanceEvidence
            :data="data"
            :passed-gate-count="passedGateCount"
            :title="title"
            :conclusion="conclusion"
          />
          <ProviderAcceptanceExecution
            v-model:organization-id="selectedOrganizationId"
            v-model:workspace-id="selectedWorkspaceId"
            v-model:query="acceptanceQuery"
            :organizations="organizations"
            :workspaces="workspaces"
            :scope-loading="scopeLoading"
            :scope-message="scopeMessage"
            :scope-request-id="scopeRequestId"
            :scope-retryable="scopeRetryable"
            :scheduling="scheduling"
            :can-schedule="canSchedule"
            :run-outcome="runOutcome"
            @organization-change="selectOrganization"
            @submit="scheduleAcceptanceRun"
            @retry-scopes="retryExecutionScopes"
          />
          <ProviderAcceptanceOperations
            :data="data"
            :credentials-link="credentialsLink"
            :sample-link="sampleLink"
            :current-run-state="currentRunState"
            :read-request-id="readRequestId"
            :read-failure-request-id="readFailureRequestId"
            :run-outcome="runOutcome"
          />
        </template>
      </main>
    </div>
  </section>
</template>

<style scoped>
.acceptance-1688 {
  --acceptance-blue: #185adb;
  --acceptance-ink: #14243a;
  --acceptance-muted: #64748b;
  color: var(--acceptance-ink);
}
.acceptance-1688__layout {
  display: grid;
  grid-template-columns: minmax(230px, 270px) minmax(0, 1fr);
  align-items: start;
  gap: 18px;
}
.acceptance-1688__rail {
  position: sticky;
  top: 12px;
  display: grid;
  gap: 18px;
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(155deg, #123f9c, #185adb 60%, #2878ed);
  color: #fff;
  box-shadow: 0 12px 32px #173f8729;
}
.acceptance-1688__identity {
  display: flex;
  gap: 12px;
  align-items: center;
}
.acceptance-1688__identity p,
.acceptance-1688__identity h2,
.acceptance-1688__rail-state p,
.acceptance-1688__rail-stats dd,
.acceptance-1688__rail-context p {
  margin: 0;
}
.acceptance-1688__identity p,
.acceptance-1688__rail-state > span {
  color: #d9e7ff;
  font-size: 13px;
}
.acceptance-1688__mark {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border: 1px solid #ffffff55;
  border-radius: 13px;
  background: #ffffff16;
  font-size: 13px;
  font-weight: 800;
}
.acceptance-1688__identity h2 {
  margin-top: 2px;
  font-size: 23px;
}
.acceptance-1688__rail-state {
  display: grid;
  gap: 7px;
  padding: 14px;
  border: 1px solid #ffffff2e;
  border-radius: 12px;
  background: #ffffff12;
}
.acceptance-1688__rail-state strong {
  font-size: 17px;
  line-height: 1.35;
}
.acceptance-1688__rail-state p,
.acceptance-1688__rail-context p {
  color: #e2ecff;
  font-size: 13px;
  line-height: 1.55;
}
.acceptance-1688__rail-stats {
  display: grid;
  gap: 11px;
  margin: 0;
}
.acceptance-1688__rail-stats dt {
  color: #d9e7ff;
  font-size: 13px;
}
.acceptance-1688__rail-stats dd {
  margin-top: 3px;
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 650;
}
.acceptance-1688__rail nav {
  display: grid;
  gap: 7px;
}
.acceptance-1688__rail nav a {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  padding: 9px 11px;
  border: 1px solid #ffffff42;
  border-radius: 9px;
  color: #fff;
  text-decoration: none;
}
.acceptance-1688__rail-context {
  border-top: 1px solid #ffffff35;
  padding-top: 12px;
}
.acceptance-1688__rail-context summary {
  min-height: 38px;
  cursor: pointer;
  color: #fff;
}
.acceptance-1688__rail-context p + p {
  margin-top: 7px;
}
.acceptance-1688__content {
  display: grid;
  min-width: 0;
  gap: 14px;
}
.acceptance-1688__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 5px 3px 13px;
  border-bottom: 1px solid var(--so-border);
}
.acceptance-1688__hero h1 {
  margin: 2px 0 4px;
  font-size: clamp(23px, 2vw, 30px);
  letter-spacing: -0.025em;
}
.acceptance-1688__hero p {
  margin: 0;
  color: var(--acceptance-muted);
}
.acceptance-1688__hero .acceptance-1688__eyebrow {
  color: var(--acceptance-blue);
  font-size: 13px;
  font-weight: 700;
}
.acceptance-1688__refresh {
  display: grid;
  justify-items: end;
  gap: 7px;
  flex: 0 0 auto;
}
.acceptance-1688__refresh small {
  color: var(--acceptance-muted);
}
.acceptance-1688__content :deep(.acceptance-1688__verdict),
.acceptance-1688__content :deep(.acceptance-1688__section),
.acceptance-1688__content :deep(.acceptance-1688__start),
.acceptance-1688__content :deep(.acceptance-1688__actions),
.acceptance-1688__content :deep(.acceptance-1688__run),
.acceptance-1688__content :deep(.acceptance-1688__state) {
  border: 1px solid var(--so-border);
  border-radius: 13px;
  background: var(--so-bg-elevated);
  box-shadow: var(--so-shadow);
}
.acceptance-1688__content :deep(.acceptance-1688__verdict) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  padding: 17px;
  border-left: 4px solid var(--acceptance-blue);
}
.acceptance-1688__content :deep(.acceptance-1688__verdict-copy > span),
.acceptance-1688__content :deep(.acceptance-1688__section header p),
.acceptance-1688__content :deep(.acceptance-1688__start header p),
.acceptance-1688__content :deep(.acceptance-1688__actions > div p),
.acceptance-1688__content :deep(.acceptance-1688__run > div p) {
  color: var(--acceptance-blue);
  font-size: 13px;
}
.acceptance-1688__content :deep(.acceptance-1688__verdict h3),
.acceptance-1688__content :deep(.acceptance-1688__section h3),
.acceptance-1688__content :deep(.acceptance-1688__start h3),
.acceptance-1688__content :deep(.acceptance-1688__actions h3),
.acceptance-1688__content :deep(.acceptance-1688__run h3) {
  margin: 4px 0 0;
  font-size: 17px;
}
.acceptance-1688__content :deep(.acceptance-1688__verdict p),
.acceptance-1688__content :deep(.acceptance-1688__section p),
.acceptance-1688__content :deep(.acceptance-1688__start p),
.acceptance-1688__content :deep(.acceptance-1688__actions p),
.acceptance-1688__content :deep(.acceptance-1688__run p) {
  line-height: 1.55;
}
.acceptance-1688__content :deep(.acceptance-1688__verdict dl) {
  display: grid;
  grid-template-columns: repeat(3, minmax(90px, auto));
  gap: 13px;
  align-content: center;
  margin: 0;
}
.acceptance-1688__content :deep(dt),
.acceptance-1688__content :deep(.acceptance-1688__section header small),
.acceptance-1688__content :deep(.acceptance-1688__start header small),
.acceptance-1688__content :deep(.acceptance-1688__start label > span) {
  color: var(--acceptance-muted);
  font-size: 13px;
}
.acceptance-1688__content :deep(dd) {
  margin: 3px 0 0;
  font-weight: 700;
}
.acceptance-1688__content :deep(.acceptance-1688__section),
.acceptance-1688__content :deep(.acceptance-1688__start),
.acceptance-1688__content :deep(.acceptance-1688__actions),
.acceptance-1688__content :deep(.acceptance-1688__run) {
  padding: 16px;
}
.acceptance-1688__content :deep(.acceptance-1688__section > header),
.acceptance-1688__content :deep(.acceptance-1688__start > header) {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;
}
.acceptance-1688__content :deep(.acceptance-1688__section header p),
.acceptance-1688__content :deep(.acceptance-1688__start header p) {
  margin: 0;
}
.acceptance-1688__content :deep(.acceptance-1688__gates),
.acceptance-1688__content :deep(.acceptance-1688__matrix) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}
.acceptance-1688__content :deep(.acceptance-1688__gates article),
.acceptance-1688__content :deep(.acceptance-1688__matrix article) {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--so-border);
  border-top: 3px solid var(--so-warning);
  border-radius: 10px;
}
.acceptance-1688__content :deep(.acceptance-1688__gates article[data-gate-state="passed"]),
.acceptance-1688__content :deep(.acceptance-1688__matrix article[data-matrix-state="covered"]) {
  border-top-color: var(--so-success);
}
.acceptance-1688__content :deep(.acceptance-1688__gates article[data-gate-state="blocked"]),
.acceptance-1688__content :deep(.acceptance-1688__matrix article[data-matrix-state="invalid"]) {
  border-top-color: var(--so-danger);
}
.acceptance-1688__content :deep(.acceptance-1688__card-title) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.acceptance-1688__content :deep(.acceptance-1688__card-title strong) {
  font-size: 13px;
}
.acceptance-1688__content :deep(.acceptance-1688__gates small),
.acceptance-1688__content :deep(.acceptance-1688__matrix small) {
  color: var(--acceptance-muted);
  font-size: 13px;
  line-height: 1.45;
}
.acceptance-1688__content :deep(.acceptance-1688__gates time) {
  color: var(--acceptance-muted);
  font-size: 13px;
}
.acceptance-1688__content :deep(.acceptance-1688__execution-form) {
  display: grid;
  grid-template-columns: minmax(140px, 0.8fr) minmax(140px, 0.8fr) minmax(190px, 1.35fr) auto;
  align-items: end;
  gap: 9px;
}
.acceptance-1688__content :deep(.acceptance-1688__start label) {
  display: grid;
  min-width: 0;
  gap: 5px;
}
.acceptance-1688__content :deep(.acceptance-1688__start select),
.acceptance-1688__content :deep(.acceptance-1688__start input) {
  min-width: 0;
  min-height: 44px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  background: var(--so-bg);
  color: var(--so-text);
  padding: 9px 10px;
  font-size: 16px;
}
.acceptance-1688__content :deep(.acceptance-1688__query small) {
  color: var(--acceptance-muted);
  font-size: 13px;
}
.acceptance-1688__content :deep(button),
.acceptance-1688__content :deep(a:not(.acceptance-1688__rail a)) {
  min-height: 44px;
  border: 1px solid var(--so-primary-border);
  border-radius: 9px;
  background: var(--so-primary-soft);
  color: var(--so-text);
  padding: 9px 12px;
  text-decoration: none;
  cursor: pointer;
}
.acceptance-1688__content :deep(button:focus-visible),
.acceptance-1688__content :deep(a:focus-visible),
.acceptance-1688__content :deep(summary:focus-visible) {
  outline: 3px solid #8bb7ff;
  outline-offset: 2px;
}
.acceptance-1688__content :deep(button:disabled) {
  cursor: not-allowed;
  opacity: 0.55;
}
.acceptance-1688__content :deep(.acceptance-1688__start-button) {
  border-color: var(--acceptance-blue);
  background: var(--acceptance-blue);
  color: #fff;
  font-weight: 700;
}
.acceptance-1688__content :deep(.acceptance-1688__scope-feedback),
.acceptance-1688__content :deep(.acceptance-1688__run-feedback) {
  display: grid;
  gap: 7px;
  margin-top: 10px;
  padding: 11px 12px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  background: var(--so-bg);
}
.acceptance-1688__content :deep(.acceptance-1688__run-feedback[data-kind="unknown"]) {
  border-color: var(--so-warning);
  background: color-mix(in srgb, var(--so-warning) 10%, var(--so-bg-elevated));
}
.acceptance-1688__content :deep(.acceptance-1688__run-feedback[data-kind="failed"]) {
  border-color: var(--so-danger);
}
.acceptance-1688__content :deep(.acceptance-1688__run-feedback h4),
.acceptance-1688__content :deep(.acceptance-1688__run-feedback p) {
  margin: 2px 0;
}
.acceptance-1688__content :deep(.acceptance-1688__run-feedback > div > p:first-child) {
  color: var(--acceptance-blue);
  font-size: 13px;
}
.acceptance-1688__content :deep(.acceptance-1688__unknown-note) {
  font-size: 13px;
}
.acceptance-1688__content :deep(.acceptance-1688__scope-feedback details),
.acceptance-1688__content :deep(.acceptance-1688__run-feedback details) {
  font-size: 13px;
}
.acceptance-1688__content :deep(code) {
  display: block;
  margin-top: 5px;
  overflow-wrap: anywhere;
}
.acceptance-1688__content :deep(.acceptance-1688__operations) {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr);
  gap: 12px;
}
.acceptance-1688__content :deep(.acceptance-1688__actions > div p),
.acceptance-1688__content :deep(.acceptance-1688__run > div p) {
  margin: 0;
}
.acceptance-1688__content :deep(.acceptance-1688__actions ol) {
  margin: 10px 0;
  padding-left: 20px;
}
.acceptance-1688__content :deep(.acceptance-1688__actions li + li) {
  margin-top: 5px;
}
.acceptance-1688__content :deep(.acceptance-1688__actions nav) {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 11px;
}
.acceptance-1688__content :deep(.acceptance-1688__run dl) {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}
.acceptance-1688__content :deep(.acceptance-1688__run details) {
  margin-top: 11px;
}
.acceptance-1688__content :deep(summary) {
  min-height: 38px;
  padding: 8px 0;
  cursor: pointer;
}
.acceptance-1688__content :deep(.acceptance-1688__notice) {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--so-success);
  border-radius: 9px;
  background: color-mix(in srgb, var(--so-success) 9%, var(--so-bg-elevated));
}
.acceptance-1688__content :deep(.acceptance-1688__notice[data-tone="danger"]) {
  border-color: var(--so-warning);
  background: color-mix(in srgb, var(--so-warning) 10%, var(--so-bg-elevated));
}
.acceptance-1688__content :deep(.acceptance-1688__lifecycle-notice) {
  border-color: var(--so-info);
  background: color-mix(in srgb, var(--so-info) 9%, var(--so-bg-elevated));
}
.acceptance-1688__content :deep(.acceptance-1688__notice details) {
  margin-top: 5px;
}
.acceptance-1688__content :deep(.acceptance-1688__state) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 16px;
}
.acceptance-1688__content :deep(.acceptance-1688__state > span) {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 50%;
  background: var(--so-primary-soft);
  color: var(--acceptance-blue);
  font-weight: 800;
}
.acceptance-1688__content :deep(.acceptance-1688__state p),
.acceptance-1688__content :deep(.acceptance-1688__state h3) {
  margin: 3px 0;
}
@media (max-width: 1080px) {
  .acceptance-1688__layout {
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 12px;
  }
  .acceptance-1688__content :deep(.acceptance-1688__verdict) {
    grid-template-columns: 1fr;
  }
  .acceptance-1688__content :deep(.acceptance-1688__execution-form) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .acceptance-1688__content :deep(.acceptance-1688__query) {
    grid-column: 1 / -1;
  }
}
@media (max-width: 760px) {
  .acceptance-1688__layout {
    grid-template-columns: 1fr;
  }
  .acceptance-1688__rail {
    position: static;
    gap: 12px;
    padding: 14px;
  }
  .acceptance-1688__rail-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .acceptance-1688__rail nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .acceptance-1688__hero,
  .acceptance-1688__content :deep(.acceptance-1688__section > header),
  .acceptance-1688__content :deep(.acceptance-1688__start > header) {
    align-items: stretch;
    flex-direction: column;
  }
  .acceptance-1688__refresh {
    justify-items: stretch;
  }
  .acceptance-1688__content :deep(.acceptance-1688__verdict dl),
  .acceptance-1688__content :deep(.acceptance-1688__gates),
  .acceptance-1688__content :deep(.acceptance-1688__matrix),
  .acceptance-1688__content :deep(.acceptance-1688__operations),
  .acceptance-1688__content :deep(.acceptance-1688__execution-form) {
    grid-template-columns: 1fr;
  }
  .acceptance-1688__content :deep(.acceptance-1688__query) {
    grid-column: auto;
  }
  .acceptance-1688__content :deep(.acceptance-1688__actions nav) {
    display: grid;
  }
  .acceptance-1688__content :deep(.acceptance-1688__state) {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .acceptance-1688 *,
  .acceptance-1688 *::before,
  .acceptance-1688 *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
