import { onBeforeUnmount, onDeactivated, watch, type Ref } from "vue";

type ReasonAction = (reason: string) => Promise<void>;
export function usePlatformOrganizationActions(options: {
  selected: Ref<any>;
  form: { name: string; timezone: string; data_retention_days: number };
  data: Ref<{ organizations: any[] } | null>;
  detailOpen: Ref<boolean>;
  missing: Ref<boolean>;
  error: Ref<string>;
  success: Ref<string>;
  refreshWarning: Ref<string>;
  message: Ref<string>;
  pendingReasonAction: Ref<ReasonAction | null>;
  routePath: () => string;
  organizationId: () => string;
  clearFeedback: () => void;
  showOrganization: (item: any) => void;
  askReason: (title: string, action: ReasonAction) => void;
  cancelReason: () => void;
  write: (
    path: string,
    body: unknown,
    method: string,
    onError: (value: string) => void,
    ownsResult: () => boolean,
    onReload: (loaded: boolean) => void,
  ) => Promise<unknown>;
}) {
  let sequence = 0;
  let ownReason: ReasonAction | null = null;
  function invalidateOrganizationAction() {
    sequence += 1;
    if (ownReason && options.pendingReasonAction.value === ownReason) options.cancelReason();
    ownReason = null;
    options.clearFeedback();
  }
  function captureAction() {
    const actionSequence = ++sequence;
    const organizationId = options.selected.value?.id;
    const actionRoute = options.routePath();
    return () =>
      actionSequence === sequence &&
      options.detailOpen.value &&
      !options.missing.value &&
      options.selected.value?.id === organizationId &&
      options.routePath() === actionRoute;
  }
  function ask(title: string, action: ReasonAction) {
    options.clearFeedback();
    options.askReason(title, action);
    ownReason = options.pendingReasonAction.value;
  }
  function updatedOrganization(previous: any, receipt: unknown) {
    const listed = options.message.value
      ? undefined
      : options.data.value?.organizations.find((item) => item.id === previous.id);
    if (listed) return listed;
    return {
      ...previous,
      ...(receipt && typeof receipt === "object" ? receipt : {}),
      member_count: undefined,
      workspace_count: undefined,
    };
  }
  async function updateOrganization() {
    if (!options.selected.value) return;
    const isCurrent = captureAction();
    const organizationId = options.selected.value.id;
    ask("保存组织资料", async (why) => {
      if (!isCurrent()) return;
      const receipt = await options.write(
        `/platform/accounts/organizations/${organizationId}`,
        { ...options.form, reason: why },
        "PATCH",
        (value) => isCurrent() && (options.error.value = value),
        isCurrent,
        (loaded) => {
          if (isCurrent())
            options.refreshWarning.value = loaded
              ? ""
              : "组织资料已保存，但最新组织资料暂未读取。请重新加载核对。";
        },
      );
      if (receipt === null || !isCurrent()) return;
      options.showOrganization(updatedOrganization(options.selected.value, receipt));
      options.success.value = options.message.value ? "组织资料已保存。" : "组织资料已更新。";
    });
  }
  async function toggleOrganization(item: any) {
    const isCurrent = captureAction();
    ask(item.status === "active" ? "停用组织" : "恢复组织", async (why) => {
      if (!isCurrent()) return;
      const receipt = await options.write(
        `/platform/accounts/organizations/${item.id}/status`,
        { status: item.status === "active" ? "archived" : "active", reason: why },
        "POST",
        (value) => isCurrent() && (options.error.value = value),
        isCurrent,
        (loaded) => {
          if (isCurrent())
            options.refreshWarning.value = loaded
              ? ""
              : "组织状态已保存，但最新组织资料暂未读取。请重新加载核对。";
        },
      );
      if (receipt === null || !isCurrent()) return;
      options.showOrganization(updatedOrganization(item, receipt));
      options.success.value = item.status === "active" ? "组织已停用。" : "组织已恢复。";
    });
  }
  watch(() => [options.routePath(), options.organizationId()], invalidateOrganizationAction, {
    flush: "sync",
  });
  onDeactivated(invalidateOrganizationAction);
  onBeforeUnmount(invalidateOrganizationAction);
  return { updateOrganization, toggleOrganization, invalidateOrganizationAction };
}
