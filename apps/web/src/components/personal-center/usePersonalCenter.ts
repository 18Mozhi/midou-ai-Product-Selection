import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from "vue";
import { useRouter } from "vue-router";
import { ApiClientError, createApiClient, type ApiRequestOptions } from "../../api-client";
import type {
  ActionFeedback,
  NotificationPreferences,
  PersonalAssets,
  PersonalAuthorization,
  PersonalProfile,
  PersonalProfileDraft,
  PersonalSession,
  SectionResource,
} from "./types";

type SectionKey = "authorization" | "sessions" | "preferences" | "assets";
type SectionValueMap = {
  authorization: PersonalAuthorization;
  sessions: PersonalSession[];
  preferences: NotificationPreferences;
  assets: PersonalAssets;
};

class PersonalRequestTimeout extends Error {
  constructor(
    message: string,
    readonly requestId: string,
  ) {
    super(message);
  }
}

function newResource<T>(): SectionResource<T> {
  return {
    status: "loading",
    data: null,
    message: "",
    snapshotRequestId: "",
    snapshotTraceId: "",
    readFailureId: "",
    readFailureTraceId: "",
  };
}

function failureDetails(error: unknown) {
  if (error instanceof ApiClientError)
    return { message: error.actionHint, requestId: error.requestId, traceId: error.traceId };
  if (error instanceof PersonalRequestTimeout)
    return {
      message: error.message,
      requestId: error.requestId,
      traceId: error.requestId,
    };
  return {
    message: error instanceof Error ? error.message : "请求暂时失败，请稍后重试。",
    requestId: "",
    traceId: "",
  };
}

export function usePersonalCenter(apiBaseUrl: string, initialSection: () => string) {
  const request = createApiClient(apiBaseUrl);
  const router = useRouter();
  const state = ref<"loading" | "ready" | "error">("loading");
  const profile = ref<PersonalProfile | null>(null);
  const profileMessage = ref("");
  const profileReadFailureId = ref("");
  const profileReadFailureTraceId = ref("");
  const profileSnapshotRequestId = ref("");
  const profileSnapshotTraceId = ref("");
  const authorization = ref(newResource<PersonalAuthorization>());
  const sessions = ref(newResource<PersonalSession[]>());
  const preferences = ref(newResource<NotificationPreferences>());
  const assets = ref(newResource<PersonalAssets>());
  const profileFeedback = ref<ActionFeedback | null>(null);
  const preferenceFeedback = ref<ActionFeedback | null>(null);
  const passwordFeedback = ref<ActionFeedback | null>(null);
  const sessionFeedback = ref<ActionFeedback | null>(null);
  const profileSaving = ref(false);
  const preferencesSaving = ref(false);
  const passwordSaving = ref(false);
  const sessionRevocations = shallowRef(new Set<string>());
  const profileDraft = reactive<PersonalProfileDraft>({
    username: "",
    display_name: "",
    avatar_url: "",
    phone: "",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    reason: "更新个人资料",
  });
  const passwordDraft = reactive({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const preferenceDraft = ref<NotificationPreferences | null>(null);
  let profileSequence = 0;
  let profileRequestInFlight = false;
  const sectionSequences: Record<SectionKey, number> = {
    authorization: 0,
    sessions: 0,
    preferences: 0,
    assets: 0,
  };
  const controllers = new Set<AbortController>();

  const writesBusy = computed(
    () =>
      profileSaving.value ||
      preferencesSaving.value ||
      passwordSaving.value ||
      sessionRevocations.value.size > 0,
  );
  const sectionsLoading = computed(() =>
    [authorization.value, sessions.value, preferences.value, assets.value].some(
      (item) => item.status === "loading",
    ),
  );
  const canManageOrganizationToken = computed(
    () =>
      authorization.value.status === "ready" &&
      authorization.value.data?.capabilities.includes("organization_token:manage") === true,
  );

  async function call<T>(path: string, options: ApiRequestOptions = {}) {
    const requestId = options.requestId ?? crypto.randomUUID();
    const controller = new AbortController();
    controllers.add(controller);
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12000);
    try {
      return await request<T>(path, {
        ...options,
        requestId,
        traceId: options.traceId ?? requestId,
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) throw new PersonalRequestTimeout("请求超时，请检查网络后重试。", requestId);
      throw error;
    } finally {
      window.clearTimeout(timeout);
      controllers.delete(controller);
    }
  }

  function updateResource<K extends SectionKey>(
    key: K,
    updater: (value: SectionResource<SectionValueMap[K]>) => SectionResource<SectionValueMap[K]>,
  ) {
    const target = {
      authorization,
      sessions,
      preferences,
      assets,
    }[key] as typeof authorization;
    target.value = updater(target.value as SectionResource<SectionValueMap[K]>) as never;
  }

  async function loadSection<K extends SectionKey>(key: K, ownerSequence = profileSequence) {
    const sequence = ++sectionSequences[key];
    const previousPreferenceData = key === "preferences" ? preferences.value.data : null;
    const previousPreferenceDraft = key === "preferences" ? preferenceDraft.value : null;
    updateResource(key, (current) => ({
      ...current,
      status: "loading",
      message: "",
      readFailureId: "",
      readFailureTraceId: "",
    }));
    const paths: Record<SectionKey, string> = {
      authorization: "/me/authorization",
      sessions: "/me/sessions",
      preferences: "/me/notification-preferences",
      assets: "/me/assets",
    };
    try {
      const response = await call<SectionValueMap[K]>(paths[key]);
      if (ownerSequence !== profileSequence || sequence !== sectionSequences[key]) return;
      updateResource(key, (current) => ({
        status: "ready",
        data: response.data,
        message: "",
        snapshotRequestId: response.request_id,
        snapshotTraceId: response.trace_id,
        readFailureId: "",
        readFailureTraceId: "",
      }));
      if (key === "preferences") {
        const loaded = response.data as NotificationPreferences;
        const dirty = Boolean(
          previousPreferenceDraft &&
          previousPreferenceData &&
          (Object.keys(loaded) as (keyof NotificationPreferences)[]).some(
            (field) => previousPreferenceDraft[field] !== previousPreferenceData[field],
          ),
        );
        if (!previousPreferenceDraft || !dirty) preferenceDraft.value = { ...loaded };
        else if (loaded.version !== previousPreferenceData?.version) {
          preferenceFeedback.value = {
            status: "error",
            message: "已读取更新的服务器版本；尚未保存的选择已保留，请核对后再保存。",
            requestId: response.request_id,
            traceId: response.trace_id,
          };
        }
      }
    } catch (error) {
      if (ownerSequence !== profileSequence || sequence !== sectionSequences[key]) return;
      const failure = failureDetails(error);
      updateResource(key, (current) => ({
        ...current,
        status: "error",
        message: failure.message,
        readFailureId: failure.requestId,
        readFailureTraceId: failure.traceId,
      }));
    }
  }

  function hydrateProfile(value: PersonalProfile) {
    profile.value = value;
    Object.assign(profileDraft, {
      username: value.username ?? "",
      display_name: value.display_name,
      avatar_url: value.avatar_url ?? "",
      phone: value.phone ?? "",
      locale: value.locale,
      timezone: value.timezone,
      reason: "更新个人资料",
    });
  }

  async function load() {
    if (writesBusy.value || profileRequestInFlight) return;
    profileRequestInFlight = true;
    const sequence = ++profileSequence;
    state.value = "loading";
    profileMessage.value = "";
    profileReadFailureId.value = "";
    profileReadFailureTraceId.value = "";
    try {
      const response = await call<PersonalProfile>("/me/profile");
      if (sequence !== profileSequence) return;
      if (!response.data) throw new Error("个人资料读取未返回内容，请稍后重试。");
      hydrateProfile(response.data);
      profileSnapshotRequestId.value = response.request_id;
      profileSnapshotTraceId.value = response.trace_id;
      state.value = "ready";
      void Promise.all([
        loadSection("authorization", sequence),
        loadSection("sessions", sequence),
        loadSection("preferences", sequence),
        loadSection("assets", sequence),
      ]);
    } catch (error) {
      if (sequence !== profileSequence) return;
      const failure = failureDetails(error);
      profileMessage.value = failure.message;
      profileReadFailureId.value = failure.requestId;
      profileReadFailureTraceId.value = failure.traceId;
      state.value = "error";
    } finally {
      profileRequestInFlight = false;
    }
  }

  async function saveProfile() {
    if (!profile.value || profileSaving.value || writesBusy.value) return;
    profileSaving.value = true;
    profileFeedback.value = null;
    const expectedVersion = profile.value.version;
    try {
      const response = await call<PersonalProfile>("/me/profile", {
        method: "PATCH",
        body: { ...profileDraft, expected_version: expectedVersion },
      });
      if (response.data && profile.value?.version === expectedVersion) {
        hydrateProfile({ ...profile.value, ...response.data });
        profile.value = { ...profile.value, ...response.data };
      }
      profileFeedback.value = {
        status: "success",
        message: "个人资料已保存；手机号变化后仍保持未验证状态。",
        requestId: response.request_id,
        traceId: response.trace_id,
      };
    } catch (error) {
      const failure = failureDetails(error);
      profileFeedback.value = { status: "error", ...failure };
    } finally {
      profileSaving.value = false;
    }
  }

  async function savePreferences() {
    if (
      !preferenceDraft.value ||
      preferences.value.status !== "ready" ||
      !preferences.value.data ||
      preferencesSaving.value ||
      writesBusy.value
    )
      return;
    preferencesSaving.value = true;
    preferenceFeedback.value = null;
    try {
      const body = {
        expected_version: preferences.value.data.version,
        in_app_enabled: preferenceDraft.value.in_app_enabled,
        email_enabled: preferenceDraft.value.email_enabled,
        task_enabled: preferenceDraft.value.task_enabled,
        approval_enabled: preferenceDraft.value.approval_enabled,
        competitor_enabled: preferenceDraft.value.competitor_enabled,
      };
      const response = await call<NotificationPreferences>("/me/notification-preferences", {
        method: "PUT",
        body,
      });
      updateResource("preferences", () => ({
        status: "ready",
        data: response.data,
        message: "",
        snapshotRequestId: response.request_id,
        snapshotTraceId: response.trace_id,
        readFailureId: "",
        readFailureTraceId: "",
      }));
      preferenceDraft.value = { ...response.data };
      preferenceFeedback.value = {
        status: "success",
        message: "通知偏好已保存。保存偏好不代表邮件已送达。",
        requestId: response.request_id,
        traceId: response.trace_id,
      };
    } catch (error) {
      const failure = failureDetails(error);
      preferenceFeedback.value = { status: "error", ...failure };
    } finally {
      preferencesSaving.value = false;
    }
  }

  async function revokeSession(id: string) {
    if (sessionRevocations.value.has(id) || writesBusy.value) return;
    sessionRevocations.value = new Set([...sessionRevocations.value, id]);
    sessionFeedback.value = null;
    try {
      const response = await call<null>(`/me/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const current = sessions.value.data;
      if (current) {
        updateResource("sessions", (resource) => ({
          ...resource,
          data: resource.data?.filter((item) => item.id !== id) ?? null,
          snapshotRequestId: response.request_id,
          snapshotTraceId: response.trace_id,
        }));
      }
      sessionFeedback.value = {
        status: "success",
        message: "设备会话已撤销。",
        requestId: response.request_id,
        traceId: response.trace_id,
      };
    } catch (error) {
      const failure = failureDetails(error);
      sessionFeedback.value = { status: "error", ...failure };
    } finally {
      const next = new Set(sessionRevocations.value);
      next.delete(id);
      sessionRevocations.value = next;
    }
  }

  async function changePassword() {
    if (passwordSaving.value || writesBusy.value) return;
    passwordFeedback.value = null;
    if (passwordDraft.new_password !== passwordDraft.confirm_password) {
      passwordFeedback.value = {
        status: "error",
        message: "两次输入的新密码不一致。",
        requestId: "",
        traceId: "",
      };
      return;
    }
    passwordSaving.value = true;
    try {
      const response = await call<null>("/me/password", {
        method: "POST",
        body: {
          current_password: passwordDraft.current_password,
          new_password: passwordDraft.new_password,
        },
      });
      passwordDraft.current_password = "";
      passwordDraft.new_password = "";
      passwordDraft.confirm_password = "";
      passwordFeedback.value = {
        status: "success",
        message: "密码已更新，正在返回登录页以重新建立会话。",
        requestId: response.request_id,
        traceId: response.trace_id,
      };
      await router.replace("/login");
    } catch (error) {
      const failure = failureDetails(error);
      passwordFeedback.value = { status: "error", ...failure };
    } finally {
      passwordSaving.value = false;
    }
  }

  function updateProfileField(field: keyof PersonalProfileDraft, value: string) {
    profileDraft[field] = value;
  }

  function updatePasswordField(
    field: "current_password" | "new_password" | "confirm_password",
    value: string,
  ) {
    passwordDraft[field] = value;
  }

  function updatePreference(field: keyof NotificationPreferences, value: boolean) {
    if (!preferenceDraft.value || field === "version") return;
    preferenceDraft.value = { ...preferenceDraft.value, [field]: value };
  }

  function retrySection(key: SectionKey) {
    if (state.value !== "ready") return;
    void loadSection(key);
  }

  function retryProfile() {
    if (state.value !== "loading") void load();
  }

  watch(
    () => initialSection(),
    (section) => {
      if (section !== "security") {
        passwordFeedback.value = null;
        passwordDraft.current_password = "";
        passwordDraft.new_password = "";
        passwordDraft.confirm_password = "";
      }
    },
  );

  onMounted(() => void load());
  onUnmounted(() => {
    profileSequence += 1;
    for (const key of Object.keys(sectionSequences) as SectionKey[]) sectionSequences[key] += 1;
    for (const controller of controllers) controller.abort();
    controllers.clear();
    passwordDraft.current_password = "";
    passwordDraft.new_password = "";
    passwordDraft.confirm_password = "";
  });

  return {
    state,
    profile,
    profileDraft,
    profileMessage,
    profileReadFailureId,
    profileReadFailureTraceId,
    profileSnapshotRequestId,
    profileSnapshotTraceId,
    authorization,
    sessions,
    preferences,
    assets,
    preferenceDraft,
    passwordDraft,
    profileFeedback,
    preferenceFeedback,
    passwordFeedback,
    sessionFeedback,
    profileSaving,
    preferencesSaving,
    passwordSaving,
    sessionRevocations,
    sectionsLoading,
    canManageOrganizationToken,
    writesBusy,
    load,
    retryProfile,
    retrySection,
    saveProfile,
    savePreferences,
    changePassword,
    revokeSession,
    updateProfileField,
    updatePasswordField,
    updatePreference,
  };
}
