<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
} from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import { useModalDialog } from "../use-modal-dialog";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import "../credential-assets.css";
import "../credential-login.css";
import "../credential-assets-c.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
type EditorKind = "asset" | "rotate" | "profile" | "login";
type LoginSaveStage = "idle" | "asset" | "profile" | "partial" | "unknown";
type DetachedWriteOutcome = "success" | "unknown" | "failure" | "partial";
interface WriteResult<T> {
  data: T | null;
  error: ApiClientError | null;
  requestId: string;
}
interface DetachedWriteSettlement {
  label: string;
  outcome: DetachedWriteOutcome;
  actionHint: string;
  message: string;
  requestId: string;
}
interface Asset {
  id: string;
  provider_id: string;
  name: string;
  kind: string;
  status: "active" | "revoked";
  key_version: string;
  fingerprint: string;
  expires_at: string | null;
  rotated_at: string | null;
  version: number;
  updated_at: string;
}
interface Profile {
  id: string;
  provider_id: string;
  credential_asset_id: string;
  code: string;
  name: string;
  browser_family: "chromium";
  locale: string;
  timezone: string;
  status: string;
  version: number;
  updated_at: string;
}
interface Provider {
  id: string;
  code: string;
  name: string;
  target_url: string;
  access_mode: string;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  assets = ref<Asset[]>([]),
  profiles = ref<Profile[]>([]),
  providers = ref<Provider[]>([]),
  requestId = ref(""),
  message = ref(""),
  editor = ref<EditorKind | null>(null),
  selected = ref<Asset | null>(null),
  revokeTarget = ref<Asset | null>(null),
  saving = ref(false),
  refreshing = ref(false),
  lastUpdatedAt = ref<string | null>(null),
  refreshNotice = ref(""),
  refreshNoticeTone = ref<"info" | "success" | "danger">("success"),
  refreshNoticeRequestId = ref(""),
  pendingWriteLabel = ref(""),
  editorPanel = ref<HTMLElement | null>(null),
  loginFileName = ref(""),
  loginPayload = ref(""),
  loginProvider = ref<Provider | null>(null),
  loginMode = ref<"cookie_file" | "archive" | "browser">("cookie_file"),
  loginMaterialBusy = ref(false),
  loginSaveStage = ref<LoginSaveStage>("idle"),
  assetForm = reactive({
    provider_id: "",
    name: "",
    kind: "api_key",
    encoding: "utf8",
    value: "",
    expires_at: "",
  }),
  profileForm = reactive({
    provider_id: "",
    credential_asset_id: "",
    code: "",
    name: "",
    browser_family: "chromium",
    locale: "en-US",
    timezone: "America/Los_Angeles",
    status: "disabled",
  });
let activeController: AbortController | null = null,
  editorGeneration = 0,
  loginMaterialGeneration = 0,
  loginMaterialController: AbortController | null = null,
  readGeneration = 0,
  pageVisit = 0,
  revokeGeneration = 0,
  pageActive = true,
  resumeRead = false,
  detachedWriteSettlement: DetachedWriteSettlement | null = null;
const {
  dialogElement: editorDialog,
  handleCancel: handleEditorCancel,
  discardReturnFocus: discardEditorReturnFocus,
} = useModalDialog(
  () => Boolean(editor.value),
  () => closeEditor(),
);
const failure = (s: number): State =>
    s === 401
      ? "expired"
      : s === 403
        ? "forbidden"
        : [408, 425, 429, 502, 503, 504].includes(s)
          ? "blocked"
          : "error",
  browserAssets = computed(() =>
    assets.value.filter(
      (item) =>
        ["browser_profile", "cookie_bundle"].includes(item.kind) && item.status === "active",
    ),
  ),
  loginProviders = computed(() =>
    providers.value.filter((item) => item.access_mode === "authenticated_browser"),
  ),
  loginNeedsAuthentication = computed(
    () => loginProvider.value?.access_mode === "authenticated_browser",
  ),
  loginControlsLocked = computed(
    () =>
      saving.value ||
      loginMaterialBusy.value ||
      !["idle", "asset", "profile"].includes(loginSaveStage.value),
  ),
  pendingWriteNotice = computed(() =>
    pendingWriteLabel.value && !editor.value && !revokeTarget.value
      ? `${pendingWriteLabel.value}仍在等待服务器响应，暂时不能开始新的凭证修改。`
      : "",
  ),
  compatibilityRows = computed(() =>
    loginProviders.value.map((provider) => {
      const providerAssets = assets.value.filter(
          (asset) =>
            asset.provider_id === provider.id &&
            ["browser_profile", "cookie_bundle"].includes(asset.kind) &&
            asset.status === "active",
        ),
        validAssetIds = new Set(
          providerAssets
            .filter(
              (asset) => !asset.expires_at || new Date(asset.expires_at).getTime() > Date.now(),
            )
            .map((asset) => asset.id),
        ),
        providerProfiles = profiles.value.filter((profile) => profile.provider_id === provider.id),
        compatibleProfiles = providerProfiles.filter(
          (profile) =>
            profile.status === "active" && validAssetIds.has(profile.credential_asset_id),
        );
      return {
        provider,
        assets: providerAssets,
        profiles: providerProfiles,
        status: compatibleProfiles.length
          ? "可用于登录采集"
          : providerAssets.length
            ? "待关联有效运行档案"
            : "待配置登录资料",
        ready: compatibleProfiles.length > 0,
      };
    }),
  ),
  lastUpdatedLabel = computed(() =>
    lastUpdatedAt.value
      ? new Date(lastUpdatedAt.value).toLocaleTimeString("zh-CN", { hour12: false })
      : "尚未完成读取",
  );
const kindText = (value: string) =>
  (
    ({
      api_key: "接口密钥",
      account_secret: "账号密码",
      cookie_bundle: "登录状态",
      private_key: "私钥",
      browser_profile: "网页登录档案",
    }) as Record<string, string>
  )[value] ?? "其他凭证";
const statusText = (value: string) =>
  (({ active: "可用", revoked: "已撤销", disabled: "已停用" }) as Record<string, string>)[value] ??
  value;
const providerName = (providerId: string) =>
  providers.value.find((provider) => provider.id === providerId)?.name ?? "未知来源";
const assetName = (assetId: string) =>
  assets.value.find((asset) => asset.id === assetId)?.name ?? "凭证引用不可用";
async function load() {
  if (refreshing.value) return false;
  const generation = ++readGeneration,
    preserve = lastUpdatedAt.value !== null;
  if (!preserve) state.value = "loading";
  refreshing.value = true;
  message.value = "";
  refreshNotice.value = "";
  refreshNoticeRequestId.value = "";
  const controller = new AbortController();
  activeController = controller;
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const [nextAssets, nextProfiles, nextProviders] = await Promise.all([
      request<Asset[]>("/platform/credential-assets", { signal: controller.signal }),
      request<Profile[]>("/platform/crawler-profiles", { signal: controller.signal }),
      request<Provider[]>("/platform/credential-provider-options", {
        signal: controller.signal,
      }),
    ]);
    if (!pageActive || generation !== readGeneration || controller.signal.aborted) return false;
    assets.value = nextAssets.data;
    profiles.value = nextProfiles.data;
    providers.value = nextProviders.data;
    requestId.value = nextProviders.request_id;
    state.value = assets.value.length || profiles.value.length ? "ready" : "empty";
    lastUpdatedAt.value = new Date().toISOString();
    if (preserve) {
      refreshNoticeTone.value = "success";
      refreshNotice.value = "凭证元数据与运行档案已刷新。";
    }
    return true;
  } catch (error) {
    if (!pageActive || generation !== readGeneration) return false;
    const apiError = error instanceof ApiClientError ? error : null;
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    requestId.value = apiError?.requestId ?? requestId.value;
    message.value = timedOut
      ? "读取超过 12 秒，请稍后重试。"
      : (apiError?.actionHint ?? "网络连接异常，请稍后重试。");
    if (preserve) {
      refreshNoticeTone.value = "danger";
      refreshNotice.value = timedOut
        ? "刷新超过 12 秒，已保留上一次成功读取的数据。"
        : `${message.value} 已保留上一次成功读取的数据。`;
    } else state.value = failure(apiError?.status ?? (timedOut ? 504 : 503));
    return false;
  } finally {
    window.clearTimeout(timer);
    if (generation === readGeneration) {
      if (activeController === controller) activeController = null;
      refreshing.value = false;
    }
  }
}
function focusEditor() {
  void nextTick(() => {
    window.requestAnimationFrame(() => {
      editorPanel.value
        ?.querySelector<HTMLElement>(
          ".credential-fields input, .credential-fields select, .credential-fields textarea",
        )
        ?.focus();
    });
  });
}
function invalidateLoginMaterial() {
  loginMaterialGeneration += 1;
  loginMaterialController?.abort();
  loginMaterialController = null;
  loginMaterialBusy.value = false;
  loginFileName.value = "";
  loginPayload.value = "";
}
function finishCloseEditor() {
  editorGeneration += 1;
  invalidateLoginMaterial();
  editor.value = null;
  selected.value = null;
  assetForm.value = "";
  loginSaveStage.value = "idle";
}
function closeEditor() {
  if (saving.value) return;
  finishCloseEditor();
}
function resetLoginMaterialContext() {
  invalidateLoginMaterial();
  message.value = "来源或导入方式已变化，请重新准备登录材料。";
}
function trapEditorFocus(event: KeyboardEvent) {
  const focusable = Array.from(
    editorPanel.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  ).filter((element) => !element.hasAttribute("hidden"));
  if (!focusable.length) return;
  const first = focusable[0],
    last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
function openAsset() {
  if (saving.value) return;
  editorGeneration += 1;
  editor.value = "asset";
  selected.value = null;
  message.value = "";
  Object.assign(assetForm, {
    provider_id: providers.value[0]?.id ?? "",
    name: "",
    kind: "api_key",
    encoding: "utf8",
    value: "",
    expires_at: "",
  });
  focusEditor();
}
function openRotate(asset: Asset) {
  if (saving.value) return;
  editorGeneration += 1;
  editor.value = "rotate";
  selected.value = asset;
  message.value = "";
  assetForm.value = "";
  assetForm.encoding = "utf8";
  assetForm.expires_at = asset.expires_at
    ? new Date(asset.expires_at).toISOString().slice(0, 16)
    : "";
  focusEditor();
}
function openProfile() {
  if (saving.value) return;
  editorGeneration += 1;
  editor.value = "profile";
  selected.value = null;
  message.value = "";
  const candidate = browserAssets.value[0];
  Object.assign(profileForm, {
    provider_id: candidate?.provider_id ?? providers.value[0]?.id ?? "",
    credential_asset_id: candidate?.id ?? "",
    code: "",
    name: "",
    browser_family: "chromium",
    locale: "en-US",
    timezone: "America/Los_Angeles",
    status: "disabled",
  });
  focusEditor();
}
function openLogin(provider?: Provider) {
  if (saving.value) return;
  editorGeneration += 1;
  invalidateLoginMaterial();
  loginProvider.value = provider ?? loginProviders.value[0] ?? null;
  loginMode.value = "cookie_file";
  loginSaveStage.value = "idle";
  message.value = "";
  editor.value = "login";
  focusEditor();
}
async function chooseLoginArchive(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  invalidateLoginMaterial();
  const generation = loginMaterialGeneration,
    providerId = loginProvider.value?.id ?? null,
    mode = loginMode.value;
  if (!file) return;
  if (mode === "archive") {
    if (!file.name.toLowerCase().endsWith(".tar.gz")) {
      message.value = "完整浏览器档案请选择 .tar.gz 文件。";
      return;
    }
    if (file.size > 6_000_000) {
      message.value = "浏览器档案压缩后不能超过 6 兆字节。";
      return;
    }
  } else {
    if (!/\.(json|txt|cookies)$/i.test(file.name)) {
      message.value = "Cookie 请上传 .json、.txt 或 .cookies 文件。";
      return;
    }
    if (file.size > 2_000_000) {
      message.value = "Cookie 文件不能超过 2 兆字节。";
      return;
    }
  }
  loginMaterialBusy.value = true;
  message.value = "正在读取所选登录材料…";
  try {
    const payload =
      mode === "archive"
        ? await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }).then((dataUrl) => dataUrl.slice(dataUrl.indexOf(",") + 1))
        : await file.text();
    if (
      generation !== loginMaterialGeneration ||
      editor.value !== "login" ||
      loginProvider.value?.id !== providerId ||
      loginMode.value !== mode
    )
      return;
    loginPayload.value = payload;
    loginFileName.value = file.name;
    message.value = `已读取导入材料：${file.name}。内容不会在页面回显。`;
  } catch {
    if (generation === loginMaterialGeneration && editor.value === "login")
      message.value = "登录材料读取失败，请重新选择文件。";
  } finally {
    if (generation === loginMaterialGeneration) loginMaterialBusy.value = false;
  }
}
function openLoginPage() {
  const url = loginProvider.value?.target_url;
  if (!url?.startsWith("http")) {
    message.value = "该来源还没有可打开的登录页面。";
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
function browserBridge<T>(action: string, payload: Record<string, unknown>, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const request_id = crypto.randomUUID();
    let timeout = 0;
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
      signal?.removeEventListener("abort", abort);
    };
    function abort() {
      cleanup();
      reject(new DOMException("Browser helper request aborted", "AbortError"));
    }
    function receive(event: MessageEvent) {
      if (
        event.source !== window ||
        event.data?.type !== "SCOUTOPS_BROWSER_BRIDGE_RESULT" ||
        event.data?.request_id !== request_id
      )
        return;
      cleanup();
      if (!event.data.ok) reject(new Error(String(event.data.error || "browser_helper_failed")));
      else resolve(event.data.data as T);
    }
    if (signal?.aborted) {
      abort();
      return;
    }
    window.addEventListener("message", receive);
    signal?.addEventListener("abort", abort, { once: true });
    timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("browser_helper_unavailable"));
    }, 15000);
    window.postMessage(
      {
        type: "SCOUTOPS_BROWSER_BRIDGE_REQUEST",
        request_id,
        action,
        payload,
      },
      location.origin,
    );
  });
}
async function acquireBrowserCookies() {
  if (loginMaterialBusy.value || saving.value || loginSaveStage.value !== "idle") return;
  const provider = loginProvider.value;
  if (!provider?.target_url?.startsWith("http")) {
    message.value = "请先选择有真实网址的来源。";
    return;
  }
  invalidateLoginMaterial();
  const generation = loginMaterialGeneration,
    providerId = provider.id;
  loginMaterialController = new AbortController();
  loginMaterialBusy.value = true;
  message.value = "正在从当前浏览器读取所选来源的登录材料…";
  try {
    const result = await browserBridge<{ cookies: unknown[] }>(
      "cookies.read",
      { target_url: provider.target_url },
      loginMaterialController.signal,
    );
    if (
      generation !== loginMaterialGeneration ||
      editor.value !== "login" ||
      loginProvider.value?.id !== providerId ||
      loginMode.value !== "browser"
    )
      return;
    loginPayload.value = JSON.stringify(result.cookies);
    loginFileName.value = `浏览器读取 · ${result.cookies.length} 条 Cookie`;
    loginMode.value = "browser";
    message.value = `已读取 ${result.cookies.length} 条 Cookie；确认来源后点击“加密保存并启用”。`;
  } catch (error) {
    if (
      generation !== loginMaterialGeneration ||
      editor.value !== "login" ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      return;
    message.value =
      error instanceof Error && error.message === "browser_cookie_empty"
        ? "当前浏览器没有这个来源可用的 Cookie。请先在刚打开的来源页面完成登录，再重新读取。"
        : error instanceof Error && error.message === "browser_helper_unavailable"
          ? "15 秒内没有收到浏览器助手响应。请确认助手已加载并授予当前来源权限，再重新读取；也可以改用 Cookie 文件上传。"
          : "浏览器助手没有返回可用材料。请检查当前来源权限后重新读取，或改用 Cookie 文件上传。";
  } finally {
    if (generation === loginMaterialGeneration) {
      loginMaterialBusy.value = false;
      loginMaterialController = null;
    }
  }
}
async function writeOutcome<T = any>(
  path: string,
  body: unknown,
  isCurrent: () => boolean = () => true,
): Promise<WriteResult<T>> {
  saving.value = true;
  if (isCurrent()) message.value = "";
  try {
    const response = await request<T>(path, { method: "POST", body });
    if (isCurrent()) requestId.value = response.request_id;
    return { data: response.data, error: null, requestId: response.request_id };
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    if (isCurrent()) {
      requestId.value = apiError?.requestId ?? requestId.value;
      message.value = apiError?.actionHint ?? "依赖不可用，未写入";
    }
    return { data: null, error: apiError, requestId: apiError?.requestId ?? "" };
  } finally {
    saving.value = false;
    if (isCurrent()) assetForm.value = "";
  }
}
function beginOwnedWrite(label: string) {
  pendingWriteLabel.value = label;
  refreshNotice.value = "";
  refreshNoticeRequestId.value = "";
}
function detachedSettlement<T>(
  label: string,
  result: WriteResult<T>,
  override: Partial<Pick<DetachedWriteSettlement, "outcome" | "message">> = {},
): DetachedWriteSettlement {
  return {
    label,
    outcome:
      override.outcome ?? (result.data ? "success" : result.error?.status ? "failure" : "unknown"),
    actionHint: result.error?.actionHint ?? "",
    message: override.message ?? "",
    requestId: result.requestId,
  };
}
async function applyDetachedWriteSettlement(settlement: DetachedWriteSettlement) {
  if (!pageActive) {
    detachedWriteSettlement = settlement;
    return;
  }
  if (settlement.outcome === "failure") {
    refreshNoticeTone.value = "danger";
    refreshNotice.value = settlement.actionHint || `${settlement.label}未完成，请重新打开后重试。`;
    refreshNoticeRequestId.value = settlement.requestId;
    return;
  }
  const refreshed = await load();
  if (!pageActive) {
    detachedWriteSettlement = settlement;
    return;
  }
  refreshNoticeTone.value = settlement.outcome === "success" && refreshed ? "success" : "danger";
  refreshNotice.value = settlement.message
    ? refreshed
      ? `${settlement.message} 当前资料已重新读取。`
      : `${settlement.message} 当前资料未能刷新，请稍后点击“刷新数据”核对。`
    : settlement.outcome === "success"
      ? refreshed
        ? `${settlement.label}已完成，当前凭证资料已重新读取。`
        : `${settlement.label}已完成，但当前资料未能刷新，请点击“刷新数据”重试。`
      : refreshed
        ? `${settlement.label}结果暂时无法确认，已重新读取当前资料；请核对后再操作。`
        : `${settlement.label}结果暂时无法确认，当前资料也未能刷新；请稍后点击“刷新数据”核对，避免重复提交。`;
  refreshNoticeRequestId.value = settlement.requestId;
}
async function settleDetachedWrite<T>(
  label: string,
  result: WriteResult<T>,
  override?: Partial<Pick<DetachedWriteSettlement, "outcome" | "message">>,
) {
  pendingWriteLabel.value = "";
  await applyDetachedWriteSettlement(detachedSettlement(label, result, override));
}
async function saveAsset() {
  if (saving.value) return;
  const submittedEditor = editor.value;
  if (submittedEditor !== "asset" && submittedEditor !== "rotate") return;
  const selectedId = selected.value?.id ?? "",
    generation = editorGeneration,
    visit = pageVisit,
    label = submittedEditor === "rotate" ? "凭证资料轮换" : "凭证资产保存",
    isCurrent = () =>
      pageActive &&
      pageVisit === visit &&
      editorGeneration === generation &&
      editor.value === submittedEditor &&
      (submittedEditor !== "rotate" || selected.value?.id === selectedId);
  beginOwnedWrite(label);
  const result =
    submittedEditor === "rotate" && selected.value
      ? await writeOutcome(
          `/platform/credential-assets/${selected.value.id}/rotate`,
          {
            secret_payload: {
              encoding: assetForm.encoding,
              value: assetForm.value,
            },
            expected_version: selected.value.version,
            expires_at: assetForm.expires_at ? new Date(assetForm.expires_at).toISOString() : null,
          },
          isCurrent,
        )
      : await writeOutcome(
          "/platform/credential-assets",
          {
            provider_id: assetForm.provider_id,
            name: assetForm.name,
            kind: assetForm.kind,
            secret_payload: {
              encoding: assetForm.encoding,
              value: assetForm.value,
            },
            expires_at: assetForm.expires_at ? new Date(assetForm.expires_at).toISOString() : null,
          },
          isCurrent,
        );
  if (!isCurrent()) {
    await settleDetachedWrite(label, result);
    return;
  }
  pendingWriteLabel.value = "";
  if (result.data) {
    finishCloseEditor();
    await load();
  }
}
async function saveProfile() {
  if (saving.value) return;
  const generation = editorGeneration,
    visit = pageVisit,
    label = "运行档案关联",
    isCurrent = () =>
      pageActive &&
      pageVisit === visit &&
      editorGeneration === generation &&
      editor.value === "profile";
  beginOwnedWrite(label);
  const result = await writeOutcome<Profile>("/platform/crawler-profiles", profileForm, isCurrent);
  if (!isCurrent()) {
    await settleDetachedWrite(label, result);
    return;
  }
  pendingWriteLabel.value = "";
  if (result.data) {
    finishCloseEditor();
    await load();
  }
}
async function saveLogin() {
  if (saving.value) return;
  const provider = loginProvider.value;
  if (!provider || !loginPayload.value) return;
  const generation = editorGeneration,
    visit = pageVisit,
    isCurrent = () =>
      pageActive &&
      pageVisit === visit &&
      editor.value === "login" &&
      editorGeneration === generation,
    mode = loginMode.value,
    payload = loginPayload.value,
    stamp = Date.now().toString(36),
    codeBase =
      provider.code
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 45) || "source";
  beginOwnedWrite("网页登录档案保存");
  loginSaveStage.value = "asset";
  const assetResult = await writeOutcome<Asset>(
    "/platform/credential-assets",
    {
      provider_id: provider.id,
      name: `${provider.name} ${mode === "archive" ? "浏览器" : "Cookie"}登录档案`,
      kind: mode === "archive" ? "browser_profile" : "cookie_bundle",
      secret_payload: {
        encoding: mode === "archive" ? "base64" : "utf8",
        value: payload,
      },
      expires_at: null,
    },
    isCurrent,
  );
  if (!assetResult.data) {
    if (!isCurrent()) {
      await settleDetachedWrite(
        "凭证资产写入",
        assetResult,
        assetResult.error?.status === 0
          ? {
              outcome: "unknown",
              message:
                "凭证资产写入结果暂时无法确认。请核对当前资料后再操作，避免重新导入或重复提交。",
            }
          : undefined,
      );
      return;
    }
    pendingWriteLabel.value = "";
    if (assetResult.error?.status === 0) {
      invalidateLoginMaterial();
      loginSaveStage.value = "unknown";
      message.value =
        "凭证资产写入结果暂时无法确认，可能已经保存。请关闭此窗口并刷新数据后核对；不要重新导入或重复提交。";
    } else loginSaveStage.value = "idle";
    return;
  }
  if (isCurrent()) {
    invalidateLoginMaterial();
    loginSaveStage.value = "profile";
  }
  const profileResult = await writeOutcome<Profile>(
    "/platform/crawler-profiles",
    {
      provider_id: provider.id,
      credential_asset_id: assetResult.data.id,
      code: `${codeBase}_login_${stamp}`.slice(0, 80),
      name: `${provider.name} 网页采集档案`,
      browser_family: "chromium",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      status: "active",
    },
    isCurrent,
  );
  if (!isCurrent()) {
    if (profileResult.data) await settleDetachedWrite("网页登录档案保存", profileResult);
    else if (profileResult.error?.status === 0)
      await settleDetachedWrite("运行档案写入", profileResult, {
        outcome: "unknown",
        message:
          "加密档案已保存，但运行档案写入结果暂时无法确认。请核对当前资料后再操作，避免重新导入或重复关联。",
      });
    else
      await settleDetachedWrite("运行档案创建", profileResult, {
        outcome: "partial",
        message:
          "加密档案已保存，但运行档案未创建。请点击“关联运行档案”，选择刚保存的档案继续；无需重新导入。",
      });
    return;
  }
  pendingWriteLabel.value = "";
  if (!profileResult.data) {
    loginSaveStage.value = profileResult.error?.status === 0 ? "unknown" : "partial";
    message.value =
      profileResult.error?.status === 0
        ? "加密档案已保存，但运行档案的写入结果暂时无法确认。请关闭此窗口并刷新数据后核对；不要重新导入或直接重复关联。"
        : "加密档案已保存，但运行档案未创建。请关闭此窗口并刷新数据，再点击“关联运行档案”，选择刚保存的档案继续；无需重新导入。";
    return;
  }
  loginSaveStage.value = "idle";
  finishCloseEditor();
  await load();
  message.value = `${provider.name} 网页登录档案已加密保存；该来源完成解析验收后，采集任务才会使用此档案。`;
}
async function revoke() {
  if (saving.value) return;
  const target = revokeTarget.value;
  if (!target) return;
  const generation = revokeGeneration,
    visit = pageVisit,
    label = "凭证资产撤销",
    isCurrent = () =>
      pageActive &&
      pageVisit === visit &&
      revokeGeneration === generation &&
      revokeTarget.value?.id === target.id;
  beginOwnedWrite(label);
  const result = await writeOutcome<Asset>(
    `/platform/credential-assets/${target.id}/revoke`,
    {
      expected_version: target.version,
      reason: "平台安全管理员确认撤销",
    },
    isCurrent,
  );
  if (!isCurrent()) {
    await settleDetachedWrite(label, result);
    return;
  }
  pendingWriteLabel.value = "";
  if (result.data) {
    revokeGeneration += 1;
    revokeTarget.value = null;
    await load();
  }
}
function openRevoke(asset: Asset) {
  if (saving.value) return;
  revokeGeneration += 1;
  revokeTarget.value = asset;
  message.value = "";
}
function closeRevoke() {
  if (saving.value) return;
  revokeGeneration += 1;
  revokeTarget.value = null;
  message.value = "";
}
onMounted(async () => {
  await load();
  const params = new URLSearchParams(location.search);
  if (params.get("mode") === "login") {
    const providerId = params.get("provider_id"),
      providerCode = params.get("provider_code");
    openLogin(
      providers.value.find(
        (item) => item.id === providerId || (providerCode !== null && item.code === providerCode),
      ),
    );
  }
});
function suspendPage() {
  if (!pageActive) return;
  pageActive = false;
  pageVisit += 1;
  resumeRead = resumeRead || refreshing.value;
  readGeneration += 1;
  activeController?.abort();
  activeController = null;
  refreshing.value = false;
  editorGeneration += 1;
  revokeGeneration += 1;
  discardEditorReturnFocus();
  invalidateLoginMaterial();
  editor.value = null;
  selected.value = null;
  revokeTarget.value = null;
  assetForm.value = "";
  loginSaveStage.value = "idle";
  message.value = "";
}
onDeactivated(suspendPage);
onBeforeUnmount(suspendPage);
onActivated(() => {
  pageActive = true;
  if (detachedWriteSettlement) {
    const settlement = detachedWriteSettlement;
    detachedWriteSettlement = null;
    resumeRead = false;
    void applyDetachedWriteSettlement(settlement);
    return;
  }
  if (!resumeRead) return;
  resumeRead = false;
  void load();
});
</script>
<template>
  <section class="credential-center" :aria-busy="refreshing">
    <header>
      <div>
        <p>平台安全资料库</p>
        <h2>凭证与浏览器档案</h2>
        <span
          >这里保存需要登录的网站资料。密码和登录状态加密后不会在页面回显，采集任务只能临时使用。</span
        >
      </div>
      <div class="credential-header-actions">
        <div class="credential-refresh-meta">
          <small>最近读取 {{ lastUpdatedLabel }}</small>
          <button type="button" :disabled="refreshing || saving" @click="load">
            {{ refreshing ? "刷新中…" : "刷新数据" }}
          </button>
        </div>
        <div class="credential-primary-actions">
          <a
            class="helper-download"
            href="/browser-helper/scoutops-browser-helper.zip"
            download="scoutops-browser-helper.zip"
            >下载浏览器助手</a
          ><button type="button" :disabled="saving" @click="openLogin()">配置网页登录</button
          ><button type="button" :disabled="saving" @click="openProfile">关联运行档案</button
          ><button type="button" class="primary" :disabled="saving" @click="openAsset">
            新建凭证资产
          </button>
        </div>
      </div>
    </header>
    <p
      v-if="pendingWriteNotice"
      class="credential-refresh-notice"
      data-tone="info"
      role="status"
      aria-live="polite"
    >
      {{ pendingWriteNotice }}
    </p>
    <p
      v-if="refreshNotice"
      class="credential-refresh-notice"
      :data-tone="refreshNoticeTone"
      role="status"
      aria-live="polite"
    >
      {{ refreshNotice }} <code v-if="refreshNoticeRequestId">{{ refreshNoticeRequestId }}</code>
    </p>
    <UiStatePanel
      v-if="state !== 'ready' && state !== 'empty'"
      :kind="state"
      :request-id="requestId"
      @primary="load"
    />
    <section v-else>
      <div class="credential-metrics">
        <article>
          <small>可用加密资料</small
          ><strong>{{ assets.filter((x) => x.status === "active").length }}</strong
          ><span>高强度加密保存</span>
        </article>
        <article>
          <small>网页采集档案</small><strong>{{ profiles.length }}</strong
          ><span>授权任务才可临时解密</span>
        </article>
        <article>
          <small>明文回显</small><strong>0</strong><span>页面无法读取原始密码或登录状态</span>
        </article>
      </div>
      <section v-if="!assets.length" class="credential-empty">
        <h3>还没有平台凭证资产</h3>
        <p>
          如果来源需要网页登录，点击“配置网页登录”并导入已登录的浏览器档案；普通接口密钥或账号资料也可以单独加密保存。
        </p>
        <button type="button" :disabled="saving" @click="openAsset">创建第一个凭证</button>
      </section>
      <div v-else class="credential-grid">
        <article v-for="asset in assets" :key="asset.id" :data-status="asset.status">
          <header>
            <span aria-hidden="true">{{ asset.kind === "browser_profile" ? "▣" : "⌘" }}</span>
            <div>
              <small>{{ kindText(asset.kind) }} · {{ providerName(asset.provider_id) }}</small>
              <h3>{{ asset.name }}</h3>
            </div>
            <b>{{ statusText(asset.status) }}</b>
          </header>
          <dl>
            <div>
              <dt>指纹</dt>
              <dd>
                <code>{{ asset.fingerprint }}</code>
              </dd>
            </div>
            <div>
              <dt>密钥版本</dt>
              <dd>{{ asset.key_version }}</dd>
            </div>
            <div>
              <dt>资产版本</dt>
              <dd>v{{ asset.version }}</dd>
            </div>
            <div>
              <dt>最近轮换</dt>
              <dd>
                {{ asset.rotated_at ? asset.rotated_at.slice(0, 10) : "尚未轮换" }}
              </dd>
            </div>
            <div>
              <dt>登录有效期</dt>
              <dd>
                {{
                  asset.expires_at
                    ? new Date(asset.expires_at) <= new Date()
                      ? "已失效"
                      : new Date(asset.expires_at).toLocaleString("zh-CN", {
                          hour12: false,
                        })
                    : "未设置检测期限"
                }}
              </dd>
            </div>
          </dl>
          <footer>
            <button
              type="button"
              :disabled="saving || asset.status === 'revoked'"
              @click="openRotate(asset)"
            >
              更新资料</button
            ><button
              type="button"
              class="danger"
              :disabled="saving || asset.status === 'revoked'"
              @click="openRevoke(asset)"
            >
              撤销
            </button>
          </footer>
        </article>
      </div>
      <section class="profile-list">
        <header>
          <div>
            <p>网页采集运行设置</p>
            <h3>已关联的浏览器档案</h3>
          </div>
          <span>仅保存元数据和受控凭证引用</span>
        </header>
        <article v-for="profile in profiles" :key="profile.id">
          <strong>{{ profile.name }}</strong>
          <span
            >{{ providerName(profile.provider_id) }} ·
            {{ assetName(profile.credential_asset_id) }}</span
          >
          <span>语言：{{ profile.locale }} · 时区：{{ profile.timezone }}</span>
          <b>{{ statusText(profile.status) }} · v{{ profile.version }}</b>
        </article>
        <p v-if="!profiles.length">暂无浏览器档案；不会创建模拟档案。</p>
      </section>
      <section class="credential-compatibility">
        <header>
          <div>
            <p>登录采集准入</p>
            <h3>账号与来源兼容矩阵</h3>
          </div>
          <span>仅按真实来源绑定、凭证有效期和运行档案状态判定</span>
        </header>
        <ResponsiveDataView
          v-if="compatibilityRows.length"
          :rows="compatibilityRows"
          :row-key="(row) => row.provider.id"
          title="账号与来源兼容矩阵"
          :detail-title="(row) => row.provider.name"
        >
          <template #desktop>
            <table>
              <thead>
                <tr>
                  <th>来源</th>
                  <th>已绑定登录资料</th>
                  <th>运行档案</th>
                  <th>兼容状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in compatibilityRows" :key="row.provider.id">
                  <td>
                    <strong>{{ row.provider.name }}</strong
                    ><small>{{ row.provider.code }}</small>
                  </td>
                  <td>
                    {{
                      row.assets.length
                        ? row.assets.map((asset) => asset.name).join("、")
                        : "未配置"
                    }}
                  </td>
                  <td>
                    {{
                      row.profiles.length
                        ? row.profiles.map((profile) => profile.name).join("、")
                        : "未关联"
                    }}
                  </td>
                  <td>
                    <b :data-ready="row.ready">{{ row.status }}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
          <template #summary="{ row }">
            <strong>{{ row.provider.name }}</strong>
            <small>{{ row.status }}</small>
          </template>
          <template #detail="{ row }">
            <dl>
              <div>
                <dt>兼容状态</dt>
                <dd>
                  <b :data-ready="row.ready">{{ row.status }}</b>
                </dd>
              </div>
              <div>
                <dt>已绑定登录资料</dt>
                <dd>
                  {{
                    row.assets.length ? row.assets.map((asset) => asset.name).join("、") : "未配置"
                  }}
                </dd>
              </div>
              <div>
                <dt>运行档案</dt>
                <dd>
                  {{
                    row.profiles.length
                      ? row.profiles.map((profile) => profile.name).join("、")
                      : "未关联"
                  }}
                </dd>
              </div>
            </dl>
            <details>
              <summary>技术详情</summary>
              <code>{{ row.provider.code }}</code>
            </details>
          </template>
        </ResponsiveDataView>
        <p v-else>当前没有需要网页登录的来源，不创建虚构兼容关系。</p>
      </section>
    </section>
    <Teleport to="body">
      <dialog
        v-if="editor"
        ref="editorDialog"
        class="credential-editor-backdrop"
        :aria-labelledby="
          editor === 'login'
            ? 'credential-login-editor-title'
            : editor === 'profile'
              ? 'credential-profile-editor-title'
              : 'credential-asset-editor-title'
        "
        @cancel="handleEditorCancel"
        @mousedown.self.prevent="closeEditor"
      >
        <form
          v-if="editor === 'asset' || editor === 'rotate'"
          ref="editorPanel"
          class="credential-editor"
          @keydown.tab="trapEditorFocus"
          @submit.prevent="saveAsset"
        >
          <header>
            <div>
              <p>
                {{ editor === "rotate" ? "更新加密资料" : "新建加密资料" }}
              </p>
              <h3 id="credential-asset-editor-title">
                {{ editor === "rotate" ? `轮换 ${selected?.name}` : "创建凭证资产" }}
              </h3>
            </div>
            <button
              type="button"
              aria-label="关闭凭证编辑"
              title="关闭凭证编辑"
              :disabled="saving"
              @click="closeEditor"
            >
              ×
            </button>
          </header>
          <div class="credential-fields">
            <label v-if="editor === 'asset'"
              >所属来源<select v-model="assetForm.provider_id" required>
                <option value="" disabled>选择来源</option>
                <option v-for="p in providers" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select></label
            ><label v-if="editor === 'asset'">名称<input v-model="assetForm.name" required /></label
            ><label v-if="editor === 'asset'"
              >类型<select v-model="assetForm.kind">
                <option
                  v-for="v in [
                    'api_key',
                    'account_secret',
                    'cookie_bundle',
                    'private_key',
                    'browser_profile',
                  ]"
                  :key="v"
                >
                  {{ kindText(v) }}
                </option>
              </select></label
            ><label
              >内容格式<select v-model="assetForm.encoding">
                <option value="utf8">文字</option>
                <option value="base64">文件编码</option>
              </select></label
            ><label class="secret"
              >需要加密保存的内容<input
                v-model="assetForm.value"
                type="password"
                required
                autocomplete="new-password"
              /><small>仅本次写入；保存后立即从页面状态清除。</small></label
            ><label
              >到期时间（可选）<input v-model="assetForm.expires_at" type="datetime-local"
            /></label>
          </div>
          <p v-if="message" role="status">
            {{ message }} <code v-if="requestId">{{ requestId }}</code>
          </p>
          <footer>
            <button type="button" class="secondary" :disabled="saving" @click="closeEditor">
              取消
            </button>
            <button type="submit" :disabled="saving || !assetForm.value">
              {{ saving ? "加密写入中…" : editor === "rotate" ? "确认轮换" : "加密保存" }}
            </button>
          </footer>
        </form>
        <form
          v-if="editor === 'profile'"
          ref="editorPanel"
          class="credential-editor"
          @keydown.tab="trapEditorFocus"
          @submit.prevent="saveProfile"
        >
          <header>
            <div>
              <p>关联网页采集档案</p>
              <h3 id="credential-profile-editor-title">创建浏览器档案引用</h3>
            </div>
            <button
              type="button"
              aria-label="关闭浏览器档案编辑"
              title="关闭浏览器档案编辑"
              :disabled="saving"
              @click="closeEditor"
            >
              ×
            </button>
          </header>
          <div class="credential-fields">
            <label
              >网页登录档案<select
                v-model="profileForm.credential_asset_id"
                required
                @change="
                  profileForm.provider_id =
                    browserAssets.find((x) => x.id === profileForm.credential_asset_id)
                      ?.provider_id ?? ''
                "
              >
                <option value="" disabled>选择加密档案</option>
                <option v-for="a in browserAssets" :key="a.id" :value="a.id">
                  {{ a.name }}
                </option>
              </select></label
            ><label
              >内部标识<input
                v-model="profileForm.code"
                required
                pattern="[a-z0-9_]{2,80}" /></label
            ><label>名称<input v-model="profileForm.name" required /></label
            ><label>页面语言<input v-model="profileForm.locale" required /></label
            ><label>所在时区<input v-model="profileForm.timezone" required /></label
            ><label
              >状态<select v-model="profileForm.status">
                <option value="disabled">先停用</option>
                <option value="active">立即启用</option>
              </select></label
            >
          </div>
          <p v-if="!browserAssets.length">需要先导入一个可用的网页登录档案。</p>
          <p v-if="message" role="status">
            {{ message }} <code v-if="requestId">{{ requestId }}</code>
          </p>
          <footer>
            <button type="button" class="secondary" :disabled="saving" @click="closeEditor">
              取消
            </button>
            <button type="submit" :disabled="saving || !browserAssets.length">保存档案引用</button>
          </footer>
        </form>
        <form
          v-if="editor === 'login'"
          ref="editorPanel"
          class="credential-editor login-editor"
          :aria-busy="saving || loginMaterialBusy"
          @keydown.tab="trapEditorFocus"
          @submit.prevent="saveLogin"
        >
          <header>
            <div>
              <p>配置网页登录</p>
              <h3 id="credential-login-editor-title">导入已经登录的浏览器档案</h3>
            </div>
            <button
              type="button"
              aria-label="关闭网页登录档案导入"
              :disabled="saving"
              @click="closeEditor()"
            >
              ×
            </button>
          </header>
          <aside class="login-guide">
            <strong>支持哪些格式？</strong>
            <p>
              首选 Cookie JSON、Playwright storageState JSON 或 Netscape cookies.txt；也可上传专用
              Chromium 的 .tar.gz 档案。公开页面不要求登录，可直接匿名测试。
            </p>
            <ol>
              <li>“从当前浏览器读取”只读取当前所选来源域名。</li>
              <li>Cookie 不在页面回显，保存后立即从页面内存清除。</li>
              <li>完整浏览器档案仅用于确实依赖浏览器状态的网站。</li>
            </ol>
          </aside>
          <div class="credential-fields">
            <label
              >需要登录的来源<select
                v-model="loginProvider"
                required
                :disabled="loginControlsLocked"
                @change="resetLoginMaterialContext"
              >
                <option :value="null" disabled>请选择</option>
                <option v-for="item in loginProviders" :key="item.id" :value="item">
                  {{ item.name }}
                </option>
              </select></label
            ><label
              >导入方式<select
                v-model="loginMode"
                :disabled="loginControlsLocked"
                @change="resetLoginMaterialContext"
              >
                <option value="cookie_file">上传 Cookie 文件</option>
                <option value="browser">从当前浏览器读取</option>
                <option value="archive">完整浏览器档案</option>
              </select></label
            ><label v-if="loginMode !== 'browser'" class="archive-picker"
              >{{ loginMode === "archive" ? "浏览器登录档案" : "Cookie 文件"
              }}<input
                type="file"
                :accept="
                  loginMode === 'archive'
                    ? '.gz,application/gzip'
                    : '.json,.txt,.cookies,application/json,text/plain'
                "
                required
                :disabled="loginControlsLocked"
                @change="chooseLoginArchive"
              /><small>{{
                loginFileName ||
                (loginMode === "archive"
                  ? "请选择 .tar.gz 文件"
                  : "请选择 Cookie JSON 或 cookies.txt")
              }}</small></label
            >
          </div>
          <aside v-if="loginProvider" class="login-provider-status">
            <div>
              <strong>{{ loginProvider.name }}</strong>
              <span v-if="loginNeedsAuthentication">该来源需要登录状态</span>
              <span v-else>该来源是公开页面，可不登录直接测试</span>
            </div>
            <button type="button" :disabled="loginControlsLocked" @click="openLoginPage">
              打开{{ loginNeedsAuthentication ? "登录" : "来源" }}页面 ↗
            </button>
            <button
              v-if="loginMode === 'browser'"
              type="button"
              :disabled="loginControlsLocked"
              @click="acquireBrowserCookies"
            >
              {{ loginMaterialBusy ? "读取中…" : "从当前浏览器读取 Cookie" }}
            </button>
          </aside>
          <p v-if="message" role="status">{{ message }}</p>
          <footer>
            <button type="button" :disabled="saving" @click="closeEditor()">取消</button
            ><button
              :disabled="
                saving ||
                loginMaterialBusy ||
                loginSaveStage === 'partial' ||
                loginSaveStage === 'unknown' ||
                !loginProvider ||
                !loginPayload
              "
            >
              {{
                saving && loginSaveStage === "asset"
                  ? "正在保存凭证资产…"
                  : saving && loginSaveStage === "profile"
                    ? "正在创建运行档案…"
                    : "加密保存并启用"
              }}
            </button>
          </footer>
        </form>
      </dialog>
    </Teleport>
    <ConfirmDialog
      :open="Boolean(revokeTarget)"
      title="确认撤销凭证资产？"
      :description="`${revokeTarget?.name ?? ''} 撤销后不能轮换或用于新档案。`"
      impact="只撤销当前平台资产；不会删除历史密文与审计。后续任务必须改用其他已授权凭证。"
      confirm-label="撤销资产"
      busy-label="正在撤销…"
      :busy="saving"
      :status-message="message"
      :status-request-id="requestId"
      destructive
      confirmation-text="确认撤销"
      @cancel="closeRevoke"
      @confirm="revoke"
    />
  </section>
</template>
