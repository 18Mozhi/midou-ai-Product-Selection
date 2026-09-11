import assert from "node:assert/strict";
import { previewAlibaba1688AcceptanceRobustness } from "./ui-phase2-1688-acceptance-robustness-preview.mjs";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

const scopeFunctions = `async function readOwnedWorkspaces(
  current: number,
  controller: AbortController,
) {
  const organizationId = selectedOrganizationId.value;
  workspaces.value = [];
  selectedWorkspaceId.value = "";
  if (!organizationId) return;
  const response = await request<WorkspaceSummary[]>(\`/org/\${organizationId}/workspaces\`, {
    signal: controller.signal,
  });
  if (!ownsScopeRead(current, controller)) return;
  const active = response.data.filter((workspace) => workspace.status === "active");
  workspaces.value = active;
  const organization = organizations.value.find((item) => item.id === organizationId);
  selectedWorkspaceId.value =
    active.find((workspace) => workspace.id === organization?.default_workspace_id)?.id ??
    active[0]?.id ??
    "";
  if (!active.length) scopeMessage.value = "该组织没有可用于验收的活动工作区。";
}

async function loadWorkspaces() {
  if (!lifecycleActive.value) return;
  const current = ++scopeReadSequence;
  scopeController?.abort();
  const controller = new AbortController();
  scopeController = controller;
  scopeLoading.value = true;
  scopeMessage.value = "";
  try {
    await readOwnedWorkspaces(current, controller);
  } catch (error) {
    if (!ownsScopeRead(current, controller)) return;
    scopeMessage.value =
      error instanceof ApiClientError ? error.actionHint : "工作区读取失败，请稍后重试。";
  } finally {
    if (scopeReadSequence === current && scopeController === controller) {
      scopeController = null;
      scopeLoading.value = false;
    }
  }
}

async function loadExecutionScopes() {
  if (!lifecycleActive.value || scopeLoading.value) return;
  const current = ++scopeReadSequence;
  scopeController?.abort();
  const controller = new AbortController();
  scopeController = controller;
  scopeLoading.value = true;
  scopeMessage.value = "";
  try {
    const response = await request<OrganizationMembershipSummary[]>("/org/memberships", {
      signal: controller.signal,
    });
    if (!ownsScopeRead(current, controller)) return;
    organizations.value = response.data.filter(
      (organization) =>
        organization.status === "active" && organization.membership_status === "active",
    );
    selectedOrganizationId.value = organizations.value[0]?.id ?? "";
    if (!organizations.value.length) {
      scopeMessage.value = "当前账号没有可用于验收的活动组织。";
      return;
    }
    await readOwnedWorkspaces(current, controller);
  } catch (error) {
    if (!ownsScopeRead(current, controller)) return;
    scopeMessage.value =
      error instanceof ApiClientError ? error.actionHint : "组织范围读取失败，请稍后重试。";
  } finally {
    if (scopeReadSequence === current && scopeController === controller) {
      scopeController = null;
      scopeLoading.value = false;
    }
  }
}
`;

const loadFunction = `async function load() {
  if (!lifecycleActive.value || refreshing.value) return;
  const current = ++acceptanceReadSequence;
  const preserve = data.value !== null;
  if (!preserve) state.value = "loading";
  refreshing.value = true;
  message.value = "";
  notice.value = "";
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await request<Acceptance>("/platform/provider-sources/1688-acceptance", {
      signal: controller.signal,
    });
    if (!ownsAcceptanceRead(current, controller)) return;
    requestId.value = response.request_id;
    data.value = response.data;
    state.value = "ready";
    lastUpdatedAt.value = new Date().toISOString();
    if (preserve) {
      noticeTone.value = "success";
      notice.value = "启用条件已刷新，页面结论来自最新一次运行记录。";
    }
  } catch (error) {
    if (!ownsAcceptanceRead(current, controller)) return;
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
    } else {
      message.value = timedOut ? "读取超过 12 秒，请稍后重试。" : "网络连接异常，请稍后重试。";
    }
    if (preserve) {
      state.value = "ready";
      noticeTone.value = "danger";
      notice.value = timedOut
        ? "刷新超过 12 秒，已保留上一次成功读取的启用条件。"
        : \`\${message.value} 已保留上一次成功读取的启用条件。\`;
    } else if (error instanceof ApiClientError) {
      state.value =
        error.kind === "expired" ? "expired" : error.kind === "forbidden" ? "forbidden" : "error";
    } else state.value = "error";
  } finally {
    window.clearTimeout(timer);
    if (acceptanceReadSequence === current && activeController === controller) {
      activeController = null;
      refreshing.value = false;
      reactivating.value = false;
    }
  }
}
`;

const lifecycleHooks = `onMounted(() => {
  void load();
  void loadExecutionScopes();
});
onActivated(() => {
  lifecycleActive.value = true;
  if (!resumeAfterDeactivation) return;
  resumeAfterDeactivation = false;
  reactivating.value = true;
  void load();
  void loadExecutionScopes();
});
onDeactivated(() => {
  lifecycleActive.value = false;
  resumeAfterDeactivation = true;
  reactivating.value = false;
  ++acceptanceReadSequence;
  activeController?.abort();
  activeController = null;
  refreshing.value = false;
  ++scopeReadSequence;
  scopeController?.abort();
  scopeController = null;
  scopeLoading.value = false;
});
onBeforeUnmount(() => {
  lifecycleActive.value = false;
  ++acceptanceReadSequence;
  activeController?.abort();
  ++scopeReadSequence;
  scopeController?.abort();
});`;

const lifecycleNotice = `    <section
      v-if="reactivating"
      class="p49-lifecycle__notice"
      role="status"
      aria-live="polite"
      aria-labelledby="p49-lifecycle-title"
    >
      <span>返回页面</span>
      <div>
        <strong id="p49-lifecycle-title">正在重新读取最新启用条件</strong>
        <p>读取完成前暂时保留上次成功事实；迟到的旧响应不会覆盖本次结果。</p>
      </div>
    </section>

`;

export const acceptanceLifecycleCopy = {
  title: "正在重新读取最新启用条件",
  boundary: "读取完成前暂时保留上次成功事实；迟到的旧响应不会覆盖本次结果。",
};

export function previewAlibaba1688AcceptanceLifecycle(source) {
  let review = previewAlibaba1688AcceptanceRobustness(source);
  review = once(
    review,
    'import { computed, onBeforeUnmount, onMounted, ref } from "vue";',
    'import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from "vue";',
    "P49 lifecycle imports",
  );
  review = once(
    review,
    'const scheduledTaskId = ref("");\nlet activeController: AbortController | null = null;',
    `const scheduledTaskId = ref("");
const reactivating = ref(false);
const lifecycleActive = ref(true);
let resumeAfterDeactivation = false;
let acceptanceReadSequence = 0;
let scopeReadSequence = 0;
let activeController: AbortController | null = null;
let scopeController: AbortController | null = null;
const ownsAcceptanceRead = (current: number, controller: AbortController) =>
  lifecycleActive.value &&
  current === acceptanceReadSequence &&
  activeController === controller &&
  !controller.signal.aborted;
const ownsScopeRead = (current: number, controller: AbortController) =>
  lifecycleActive.value &&
  current === scopeReadSequence &&
  scopeController === controller &&
  !controller.signal.aborted;`,
    "P49 lifecycle state",
  );
  const scopeStart = review.indexOf("async function loadWorkspaces()"),
    scopeEnd = review.indexOf("async function scheduleAcceptanceRun()", scopeStart);
  assert.ok(scopeStart >= 0 && scopeEnd > scopeStart, "P49 scope function boundaries");
  review = review.slice(0, scopeStart) + scopeFunctions + "\n" + review.slice(scopeEnd);
  const loadStart = review.indexOf("async function load()"),
    hooksStart = review.indexOf("onMounted(() =>", loadStart),
    templateStart = review.indexOf("</script>", hooksStart);
  assert.ok(loadStart >= 0 && hooksStart > loadStart && templateStart > hooksStart);
  review =
    review.slice(0, loadStart) +
    loadFunction +
    "\n" +
    lifecycleHooks +
    "\n" +
    review.slice(templateStart);
  review = once(
    review,
    `    <section
      v-if="state !== 'ready'"`,
    lifecycleNotice +
      `    <section
      v-if="state !== 'ready'"`,
    "P49 lifecycle notice",
  );
  return review;
}
