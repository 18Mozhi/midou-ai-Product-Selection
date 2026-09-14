import { computed, shallowRef, type Ref } from "vue";
import type {
  PlatformNotificationMessage,
  PlatformNotificationRequest,
} from "./platform-notification-types";

type MessageAction = "publish" | "cancel";
interface ActionTarget {
  id: string;
  title: string;
  version: number;
  kind: "notification" | "email";
}

export function usePlatformNotificationAction(options: {
  request: PlatformNotificationRequest;
  reload: () => Promise<boolean>;
  message: Ref<string>;
}) {
  let lifecycle = 0;
  const target = shallowRef<ActionTarget | null>(null),
    action = shallowRef<MessageAction>("publish"),
    reason = shallowRef(""),
    error = shallowRef(""),
    generation = shallowRef(0),
    pendingGeneration = shallowRef<number | null>(null),
    busyId = shallowRef("");
  const open = computed(() => target.value !== null),
    submitting = computed(() => pendingGeneration.value === generation.value),
    actionLabel = computed(() => (action.value === "publish" ? "发布" : "取消草稿"));

  function begin(item: PlatformNotificationMessage, nextAction: MessageAction) {
    generation.value += 1;
    target.value = {
      id: item.id,
      title: item.title,
      version: item.version,
      kind: item.kind,
    };
    action.value = nextAction;
    reason.value = nextAction === "publish" ? "发布平台消息" : "取消平台消息草稿";
    error.value = "";
  }

  function close() {
    generation.value += 1;
    target.value = null;
    error.value = "";
  }

  function stop() {
    lifecycle += 1;
    close();
    pendingGeneration.value = null;
    busyId.value = "";
  }

  async function submit() {
    if (!target.value || submitting.value) return;
    const trimmedReason = reason.value.trim();
    if (trimmedReason.length < 2 || trimmedReason.length > 300) return;
    const owner = lifecycle,
      instance = generation.value,
      snapshot = { ...target.value },
      submittedAction = action.value;
    pendingGeneration.value = instance;
    busyId.value = snapshot.id;
    error.value = "";
    options.message.value = "";
    try {
      const result = await options.request<any>(
        `/platform/management/messages/${snapshot.id}/actions`,
        {
          method: "POST",
          body: JSON.stringify({
            action: submittedAction,
            expected_version: snapshot.version,
            reason: trimmedReason,
          }),
        },
      );
      if (owner !== lifecycle) return;
      if (instance === generation.value) close();
      const refreshed = await options.reload();
      if (owner !== lifecycle) return;
      if (submittedAction === "publish") {
        const success = `发布完成：覆盖 ${result.recipient_count} 人，站内 ${result.in_app_count} 条，邮件队列 ${result.email_count} 条。`;
        options.message.value = refreshed
          ? success
          : `${success} 列表未能刷新，请重新加载后核对最新状态。`;
      } else {
        options.message.value = refreshed
          ? "草稿已取消；这不是撤回已发布消息。"
          : "草稿已取消，但列表未能刷新。请重新加载后核对最新状态。";
      }
    } catch (failure) {
      if (owner !== lifecycle) return;
      const submittedLabel = submittedAction === "publish" ? "发布" : "取消草稿";
      const failureMessage = failure instanceof Error ? failure.message : `${submittedLabel}未完成`;
      if (instance === generation.value && target.value?.id === snapshot.id) {
        error.value = `${failureMessage} 未确认写入结果，请核对消息版本后再决定是否重试。`;
      } else {
        options.message.value = `先前的${submittedLabel}操作未完成：${failureMessage}`;
      }
    } finally {
      if (owner === lifecycle && pendingGeneration.value === instance) {
        pendingGeneration.value = null;
        busyId.value = "";
      }
    }
  }

  return {
    target,
    action,
    reason,
    error,
    open,
    submitting,
    busyId,
    actionLabel,
    begin,
    close,
    stop,
    submit,
  };
}
