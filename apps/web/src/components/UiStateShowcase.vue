<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { getLastValidRoute } from "../navigation-memory";
import { UI_STATE_KINDS, type UiStateKind } from "../ui/state-contract";
const props = defineProps<{ initialState?: UiStateKind }>();
const route = useRoute();
const router = useRouter();
const stateFromQuery = (value: unknown): UiStateKind | null =>
  typeof value === "string" && UI_STATE_KINDS.includes(value as UiStateKind)
    ? (value as UiStateKind)
    : null;
const current = ref<UiStateKind>(
    props.initialState ?? stateFromQuery(route.query.state) ?? "empty",
  ),
  dialogOpen = ref(false),
  confirmed = ref(false),
  actionResult = ref("");
const recentRoute = computed(() => getLastValidRoute());
const labels: Record<UiStateKind, string> = {
  loading: "加载",
  empty: "空结果",
  error: "错误",
  forbidden: "无权限",
  expired: "已过期",
  blocked: "受阻",
  recovery: "已恢复",
  not_found: "404",
};
watch(
  () => route.query.state,
  (value) => {
    if (props.initialState) return;
    current.value = stateFromQuery(value) ?? "empty";
    actionResult.value = "";
  },
);
async function selectState(kind: UiStateKind) {
  actionResult.value = "";
  current.value = kind;
  if (props.initialState || route.query.state === kind) return;
  await router.push({ query: { ...route.query, state: kind } });
}
async function primary() {
  if (current.value === "not_found") {
    if (route.path === router.resolve(recentRoute.value).path) {
      await selectState("empty");
      actionResult.value = "最近有效页面就是当前展示页，已返回空结果示例。";
    } else {
      await router.push(recentRoute.value);
    }
    return;
  }
  if (current.value === "blocked" || current.value === "error") {
    await selectState("recovery");
    actionResult.value = "已触发重试示例并进入恢复状态；没有调用业务接口。";
    return;
  }
  if (current.value === "forbidden") {
    await router.push("/home");
    return;
  }
  if (current.value === "expired") {
    await router.push("/login");
    return;
  }
  if (current.value === "recovery") {
    await selectState("empty");
    actionResult.value = "已从恢复状态继续到空结果示例。";
    return;
  }
  actionResult.value = "已触发首次操作示例；展示页没有业务接口，因此未执行写入。";
}
async function secondary() {
  if (current.value === "not_found") {
    await router.push("/home");
    return;
  }
  if (current.value === "blocked") {
    actionResult.value = "影响范围：当前请求因限流、超时或依赖不可用而停止，没有写入成功。";
    return;
  }
  if (current.value === "forbidden") {
    actionResult.value = "权限申请必须由所属业务页发起；展示页不会伪造申请成功。";
    return;
  }
  const previous = current.value;
  await selectState("empty");
  actionResult.value =
    previous === "empty" ? "已触发调整筛选示例；展示页没有真实筛选条件。" : "已返回空结果示例。";
}
</script>
<template>
  <main class="state-showcase state-showcase--review" :data-kind="current">
    <header class="p72-top">
      <RouterLink to="/home"><b>选</b><strong>ScoutOps</strong></RouterLink>
      <span>内部开发演示 · 不进入生产构建</span>
    </header>
    <section class="p72-hero" aria-labelledby="p72-title">
      <p>状态组件 / 审核工作区</p>
      <h1 id="p72-title">通用状态与确认交互</h1>
      <span
        >用同一套文字语义、影响范围与下一步，审阅八类非业务状态；不把演示结果当成真实服务结论。</span
      >
    </section>
    <aside class="p72-boundary" aria-label="演示范围">
      <b>开发专用 · 无 API / 无写入</b>
      <span>状态由 query.state 选择；关联编号和链路编号仅为安全格式演示。</span>
    </aside>
    <nav class="p72-state-picker" aria-label="状态示例">
      <button
        v-for="kind in UI_STATE_KINDS"
        :key="kind"
        type="button"
        :aria-pressed="current === kind"
        aria-controls="ui-state-preview"
        @click="selectState(kind)"
      >
        <i aria-hidden="true"></i>{{ labels[kind] }}
      </button>
    </nav>
    <section class="p72-workspace" aria-labelledby="p72-current-state">
      <header>
        <div>
          <small>当前预览</small>
          <h2 id="p72-current-state">{{ labels[current] }}状态</h2>
        </div>
        <p>动作仅复现组件合同，不调用业务服务。</p>
      </header>
      <div class="p72-preview">
        <UiStatePanel
          id="ui-state-preview"
          :kind="current"
          :description="
            current === 'not_found'
              ? `地址可能已变更。可返回最近有效页面 ${recentRoute}，或回到今日行动。`
              : undefined
          "
          :primary-label="current === 'not_found' ? '返回最近页面' : undefined"
          :secondary-label="current === 'not_found' ? '返回今日行动' : undefined"
          request-id="m02-04-request"
          trace-id="m02-04-trace"
          @primary="primary"
          @secondary="secondary"
        />
        <p v-if="actionResult" class="state-action-result" role="status">{{ actionResult }}</p>
        <code v-if="current === 'not_found'" class="state-recent-route"
          >最近有效页面：{{ recentRoute }}</code
        >
      </div>
    </section>
    <section class="p72-confirmation" aria-labelledby="p72-confirmation-title">
      <div>
        <small>高影响确认演示</small>
        <h2 id="p72-confirmation-title">先明确影响，再允许确认</h2>
        <p>确认仅更新当前组件的本地提示；不会撤销授权、写入审计或调用后端。</p>
      </div>
      <div class="p72-confirmation-action">
        <button class="open-confirm" type="button" @click="dialogOpen = true">
          查看高影响确认弹窗
        </button>
        <p v-if="confirmed" class="confirm-result" role="status">
          示例确认已完成；未触发任何业务写入。
        </p>
      </div>
    </section>
    <footer class="p72-footer">
      <span>桌面 / 390px / 键盘</span>
      <span>内部状态组件，不代表生产运行状态</span>
    </footer>
    <ConfirmDialog
      :open="dialogOpen"
      title="确认撤销示例授权？"
      description="这是通用确认组件的交互演示，不会请求后端。"
      impact="仅演示当前弹窗；不修改角色、权限、数据或审计。"
      confirm-label="确认演示"
      destructive
      confirmation-text="确认撤销"
      @cancel="dialogOpen = false"
      @confirm="
        dialogOpen = false;
        confirmed = true;
      "
    />
  </main>
</template>

<style scoped>
.state-showcase--review {
  --p72-blue: #1748a0;
  --p72-ink: #182d4a;
  --p72-muted: #52647b;
  --p72-line: #dce4ee;
  box-sizing: border-box;
  display: grid;
  align-content: start;
  gap: 16px;
  width: 100%;
  min-height: 100dvh;
  margin: 0 auto;
  padding: 28px max(24px, calc((100vw - 1180px) / 2)) 44px;
  color: var(--p72-ink);
  background: #f3f6fb;
  font:
    16px/1.65 "Microsoft YaHei",
    sans-serif;
}
.state-showcase--review *,
.state-showcase--review *::before,
.state-showcase--review *::after {
  box-sizing: border-box;
}
.state-showcase--review :is(h1, h2, p) {
  margin: 0;
}
.state-showcase--review :is(button, input) {
  min-height: 44px;
  font: inherit;
}
.state-showcase--review :is(button, input):focus-visible {
  outline: 3px solid #2465d7;
  outline-offset: 3px;
}
.p72-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--p72-muted);
  font-size: 13px;
}
.p72-top a {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--p72-ink);
  text-decoration: none;
}
.p72-top b {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  color: #fff;
  background: var(--p72-blue);
}
.p72-top strong {
  font-size: 16px;
}
.p72-hero {
  padding: 28px 32px;
  color: #fff;
  background: var(--p72-blue);
}
.p72-hero p {
  color: #d9e6ff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.p72-hero h1 {
  margin: 5px 0;
  color: #fff;
  font-size: 32px;
  line-height: 1.35;
}
.p72-hero > span {
  display: block;
  max-width: 760px;
  color: #e2ebff;
}
.p72-boundary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 12px 16px;
  border-left: 3px solid var(--p72-blue);
  background: #edf4ff;
}
.p72-boundary span {
  color: var(--p72-muted);
}
.p72-state-picker {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 1px;
  border: 1px solid var(--p72-line);
  background: var(--p72-line);
}
.p72-state-picker button {
  min-width: 0;
  padding: 9px 8px;
  border: 0;
  border-radius: 0;
  color: var(--p72-ink);
  background: #fff;
  box-shadow: none;
  cursor: pointer;
}
.p72-state-picker button[aria-pressed="true"] {
  color: #fff;
  background: var(--p72-blue);
}
.p72-state-picker i {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 7px;
  border-radius: 50%;
  background: currentColor;
}
.p72-workspace {
  border: 1px solid var(--p72-line);
  background: #fff;
}
.p72-workspace > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--p72-line);
}
.p72-workspace small,
.p72-confirmation small {
  color: var(--p72-muted);
  font-size: 13px;
}
.p72-workspace h2,
.p72-confirmation h2 {
  margin-top: 3px;
  font-size: 22px;
}
.p72-workspace > header p {
  max-width: 360px;
  color: var(--p72-muted);
  font-size: 14px;
  text-align: right;
}
.p72-preview {
  padding: 24px;
  background: #f9fbfe;
}
.p72-preview :deep(.ui-state-panel) {
  max-width: 720px;
  margin: 0 auto;
  padding: 28px;
  border: 1px solid var(--p72-line);
  border-left: 4px solid var(--p72-blue);
  border-radius: 0;
  background: #fff;
  box-shadow: none;
}
.p72-preview :deep(.ui-state-panel .ui-state-symbol) {
  border-radius: 0;
  color: var(--p72-blue);
  background: #edf4ff;
}
.p72-preview :deep(.ui-state-panel > p) {
  color: var(--p72-muted);
  font-size: 13px;
}
.p72-preview :deep(.ui-state-panel h2) {
  color: var(--p72-ink);
  font-size: 25px;
}
.p72-preview :deep(.ui-state-panel > div) {
  color: var(--p72-muted);
}
.p72-preview :deep(.ui-state-panel dl) {
  border-color: var(--p72-line);
  background: #f6f9ff;
}
.p72-preview :deep(.ui-state-panel footer) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.p72-preview :deep(.ui-state-panel footer button),
.open-confirm {
  border: 1px solid var(--p72-blue);
  border-radius: 0;
  color: var(--p72-blue);
  background: #fff;
  box-shadow: none;
  cursor: pointer;
}
.p72-preview :deep(.ui-state-panel footer .primary),
.open-confirm {
  color: #fff;
  background: var(--p72-blue);
}
.state-action-result,
.state-recent-route {
  display: block;
  max-width: 720px;
  margin: 14px auto 0;
  padding: 12px 14px;
  overflow-wrap: anywhere;
  color: var(--p72-muted);
  background: #edf4ff;
}
.p72-confirmation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
  border: 1px solid var(--p72-line);
  background: #fff;
}
.p72-confirmation > div:first-child {
  max-width: 720px;
}
.p72-confirmation p {
  margin-top: 5px;
  color: var(--p72-muted);
}
.p72-confirmation-action {
  min-width: 260px;
}
.p72-confirmation-action .open-confirm {
  min-width: 220px;
}
.confirm-result {
  font-size: 13px;
}
.p72-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--p72-muted);
  font-size: 13px;
}
:global(body:has(.state-showcase--review) .confirm-backdrop) {
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgb(24 45 74 / 58%);
}
:global(body:has(.state-showcase--review) .confirm-dialog) {
  width: min(560px, 100%);
  max-height: calc(100dvh - 36px);
  overflow-y: auto;
  padding: 28px;
  border: 1px solid #dce4ee;
  border-radius: 0;
  color: #182d4a;
  background: #fff;
  box-shadow: none;
}
:global(body:has(.state-showcase--review) .confirm-dialog :is(button, input):focus-visible) {
  outline: 3px solid #2465d7;
  outline-offset: 3px;
}
:global(body:has(.state-showcase--review) .confirm-dialog > span) {
  border-radius: 0;
  color: #b42318;
  background: #fff1f0;
}
:global(body:has(.state-showcase--review) .confirm-dialog > p) {
  color: #b42318;
  letter-spacing: 0.04em;
}
:global(body:has(.state-showcase--review) .confirm-dialog aside) {
  border-left-color: #b42318 !important;
  border-radius: 0;
  background: #fff7f6;
}
:global(body:has(.state-showcase--review) .confirm-check) {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: start;
  color: #52647b;
}
:global(body:has(.state-showcase--review) .confirm-check input) {
  width: 20px;
  height: 20px;
  margin: 0;
  accent-color: #1748a0;
}
:global(body:has(.state-showcase--review) .confirm-phrase input) {
  width: 100%;
  border: 1px solid #dce4ee;
  border-radius: 0;
}
:global(body:has(.state-showcase--review) .confirm-dialog footer button) {
  min-width: 108px;
  border-radius: 0;
}
:global(body:has(.state-showcase--review) .confirm-dialog .confirm-submit.is-danger) {
  border-color: #b42318;
  background: #b42318;
}
@media (max-width: 760px) {
  .state-showcase--review {
    width: 100%;
    padding: 18px 16px 36px;
    gap: 14px;
  }
  .p72-top > span {
    max-width: 180px;
    text-align: right;
  }
  .p72-hero {
    padding: 22px 18px;
  }
  .p72-hero h1 {
    font-size: 27px;
  }
  .p72-boundary,
  .p72-workspace > header,
  .p72-confirmation {
    align-items: stretch;
    flex-direction: column;
  }
  .p72-workspace > header,
  .p72-preview,
  .p72-confirmation {
    padding: 18px;
  }
  .p72-workspace > header p {
    text-align: left;
  }
  .p72-state-picker {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .p72-confirmation-action {
    min-width: 0;
  }
  .p72-confirmation-action .open-confirm {
    width: 100%;
  }
  .p72-preview :deep(.ui-state-panel) {
    padding: 20px 18px;
  }
  .p72-preview :deep(.ui-state-panel footer),
  :global(body:has(.state-showcase--review) .confirm-dialog footer) {
    display: grid;
    grid-template-columns: 1fr;
  }
  .p72-preview :deep(.ui-state-panel footer button),
  :global(body:has(.state-showcase--review) .confirm-dialog footer button) {
    width: 100%;
  }
  .p72-footer {
    align-items: flex-start;
    flex-direction: column;
  }
  :global(body:has(.state-showcase--review) .confirm-dialog) {
    padding: 22px 18px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .state-showcase--review *,
  .state-showcase--review *::before,
  .state-showcase--review *::after,
  :global(body:has(.state-showcase--review) .confirm-dialog) {
    animation: none !important;
    transition: none !important;
  }
}
</style>
