import { computed, ref, shallowRef, type Ref } from "vue";
import type {
  PlatformNotificationForm,
  PlatformNotificationMessage,
  PlatformNotificationRequest,
} from "./platform-notification-types";

const createForm = (item?: PlatformNotificationMessage): PlatformNotificationForm =>
  item
    ? {
        kind: item.kind,
        title: item.title,
        body: item.body,
        category: item.category,
        severity: item.severity,
        audience_type: item.audience_type,
        organization_id: item.organization_id ?? "",
        user_id: item.user_id ?? "",
        in_app_enabled: Boolean(item.in_app_enabled),
        email_enabled: false,
        reason: "编辑平台消息",
        expected_version: item.version,
      }
    : {
        kind: "notification",
        title: "",
        body: "",
        category: "system",
        severity: "info",
        audience_type: "all_users",
        organization_id: "",
        user_id: "",
        in_app_enabled: true,
        email_enabled: false,
        reason: "创建平台消息草稿",
        expected_version: 1,
      };

export function usePlatformMessageEditor(options: {
  request: PlatformNotificationRequest;
  reload: () => Promise<boolean>;
  showNewestMessages: () => void;
  message: Ref<string>;
}) {
  let lifecycle = 0;
  const editor = shallowRef<PlatformNotificationMessage | { id: "" } | null>(null),
    form = ref<PlatformNotificationForm>(createForm()),
    error = shallowRef(""),
    activeInstance = shallowRef(0),
    savingInstance = shallowRef<number | null>(null);
  const saving = computed(() => savingInstance.value === activeInstance.value);

  function begin(item?: PlatformNotificationMessage) {
    activeInstance.value += 1;
    editor.value = item ? { ...item } : { id: "" };
    form.value = createForm(item);
    error.value = "";
  }

  function close() {
    activeInstance.value += 1;
    editor.value = null;
    error.value = "";
  }

  function stop() {
    lifecycle += 1;
    close();
    savingInstance.value = null;
  }

  async function save() {
    if (!editor.value || saving.value) return;
    const owner = lifecycle,
      instance = activeInstance.value,
      target = { ...editor.value },
      payload = { ...form.value },
      editing = Boolean(target.id);
    savingInstance.value = instance;
    error.value = "";
    options.message.value = "";
    try {
      await options.request(`/platform/management/messages${editing ? `/${target.id}` : ""}`, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      if (owner !== lifecycle) return;
      if (!editing) options.showNewestMessages();
      if (instance === activeInstance.value) close();
      const refreshed = await options.reload();
      if (owner !== lifecycle) return;
      options.message.value = refreshed
        ? editing
          ? "草稿已更新。"
          : "草稿已创建，可继续编辑或发布。"
        : editing
          ? "草稿已更新，但列表未能刷新。请重新加载后核对最新版本。"
          : "草稿已创建，但列表未能刷新。请重新加载后核对新草稿。";
    } catch (failure) {
      if (owner !== lifecycle) return;
      const failureMessage = failure instanceof Error ? failure.message : "草稿未保存";
      if (instance === activeInstance.value && editor.value) {
        error.value = `${failureMessage} 未确认写入结果，请先核对列表再决定是否重试。`;
      } else {
        options.message.value = `先前的草稿保存未完成：${failureMessage}`;
      }
    } finally {
      if (owner === lifecycle && savingInstance.value === instance) savingInstance.value = null;
    }
  }

  return { editor, form, error, saving, begin, close, stop, save };
}
