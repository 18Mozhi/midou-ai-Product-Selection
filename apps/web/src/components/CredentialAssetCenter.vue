<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ResponsiveDataView from "./ResponsiveDataView.vue";
import "../credential-assets.css";
import "../credential-login.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
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
  editor = ref<"asset" | "rotate" | "profile" | "login" | null>(null),
  selected = ref<Asset | null>(null),
  revokeTarget = ref<Asset | null>(null),
  saving = ref(false),
  refreshing = ref(false),
  lastUpdatedAt = ref<string | null>(null),
  refreshNotice = ref(""),
  refreshNoticeTone = ref<"success" | "danger">("success"),
  editorPanel = ref<HTMLElement | null>(null),
  loginFileName = ref(""),
  loginPayload = ref(""),
  loginProvider = ref<Provider | null>(null),
  loginMode = ref<"cookie_file" | "archive" | "browser">("cookie_file"),
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
  editorReturnFocus: HTMLElement | null = null;
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
  if (refreshing.value) return;
  const preserve = lastUpdatedAt.value !== null;
  if (!preserve) state.value = "loading";
  refreshing.value = true;
  message.value = "";
  refreshNotice.value = "";
  activeController = new AbortController();
  const timer = window.setTimeout(() => activeController?.abort(), 12_000);
  try {
    const [nextAssets, nextProfiles, nextProviders] = await Promise.all([
      request<Asset[]>("/platform/credential-assets", { signal: activeController.signal }),
      request<Profile[]>("/platform/crawler-profiles", { signal: activeController.signal }),
      request<Provider[]>("/platform/credential-provider-options", {
        signal: activeController.signal,
      }),
    ]);
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
  } catch (error) {
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
  } finally {
    window.clearTimeout(timer);
    activeController = null;
    refreshing.value = false;
  }
}
function focusEditor() {
  editorReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  void nextTick(() => {
    editorPanel.value
      ?.querySelector<HTMLElement>(
        ".credential-fields input, .credential-fields select, .credential-fields textarea",
      )
      ?.focus();
  });
}
function closeEditor() {
  editor.value = null;
  selected.value = null;
  assetForm.value = "";
  loginPayload.value = "";
  const returnTarget = editorReturnFocus;
  editorReturnFocus = null;
  void nextTick(() => returnTarget?.focus());
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
  loginProvider.value = provider ?? loginProviders.value[0] ?? null;
  loginFileName.value = "";
  loginPayload.value = "";
  loginMode.value = "cookie_file";
  message.value = "";
  editor.value = "login";
  focusEditor();
}
async function chooseLoginArchive(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  loginFileName.value = "";
  loginPayload.value = "";
  if (!file) return;
  if (loginMode.value === "archive") {
    if (!file.name.toLowerCase().endsWith(".tar.gz")) {
      message.value = "完整浏览器档案请选择 .tar.gz 文件。";
      return;
    }
    if (file.size > 6_000_000) {
      message.value = "浏览器档案压缩后不能超过 6 兆字节。";
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    loginPayload.value = dataUrl.slice(dataUrl.indexOf(",") + 1);
  } else {
    if (!/\.(json|txt|cookies)$/i.test(file.name)) {
      message.value = "Cookie 请上传 .json、.txt 或 .cookies 文件。";
      return;
    }
    if (file.size > 2_000_000) {
      message.value = "Cookie 文件不能超过 2 兆字节。";
      return;
    }
    loginPayload.value = await file.text();
  }
  loginFileName.value = file.name;
}
function openLoginPage() {
  const url = loginProvider.value?.target_url;
  if (!url?.startsWith("http")) {
    message.value = "该来源还没有可打开的登录页面。";
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
function browserBridge<T>(action: string, payload: Record<string, unknown>) {
  return new Promise<T>((resolve, reject) => {
    const request_id = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", receive);
      reject(new Error("browser_helper_unavailable"));
    }, 15000);
    function receive(event: MessageEvent) {
      if (
        event.source !== window ||
        event.data?.type !== "SCOUTOPS_BROWSER_BRIDGE_RESULT" ||
        event.data?.request_id !== request_id
      )
        return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
      if (!event.data.ok) reject(new Error(String(event.data.error || "browser_helper_failed")));
      else resolve(event.data.data as T);
    }
    window.addEventListener("message", receive);
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
  const provider = loginProvider.value;
  if (!provider?.target_url?.startsWith("http")) {
    message.value = "请先选择有真实网址的来源。";
    return;
  }
  saving.value = true;
  message.value = "正在请求浏览器助手读取当前来源域名的 Cookie…";
  try {
    const result = await browserBridge<{ cookies: unknown[] }>("cookies.read", {
      target_url: provider.target_url,
    });
    loginPayload.value = JSON.stringify(result.cookies);
    loginFileName.value = `浏览器读取 · ${result.cookies.length} 条 Cookie`;
    loginMode.value = "browser";
    message.value = "已读取 Cookie；确认来源后点击“加密保存并启用”。";
  } catch {
    message.value =
      "未检测到浏览器助手或未授予该网站权限。请先下载并加载浏览器助手，或改用 Cookie 文件上传。";
  } finally {
    saving.value = false;
  }
}
async function write(path: string, body: unknown) {
  saving.value = true;
  message.value = "";
  try {
    const response = await request<any>(path, { method: "POST", body });
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    const apiError = error instanceof ApiClientError ? error : null;
    requestId.value = apiError?.requestId ?? requestId.value;
    message.value = apiError?.actionHint ?? "依赖不可用，未写入";
    return null;
  } finally {
    saving.value = false;
    assetForm.value = "";
  }
}
async function saveAsset() {
  if (saving.value) return;
  const ok =
    editor.value === "rotate" && selected.value
      ? await write(`/platform/credential-assets/${selected.value.id}/rotate`, {
          secret_payload: {
            encoding: assetForm.encoding,
            value: assetForm.value,
          },
          expected_version: selected.value.version,
          expires_at: assetForm.expires_at ? new Date(assetForm.expires_at).toISOString() : null,
        })
      : await write("/platform/credential-assets", {
          provider_id: assetForm.provider_id,
          name: assetForm.name,
          kind: assetForm.kind,
          secret_payload: {
            encoding: assetForm.encoding,
            value: assetForm.value,
          },
          expires_at: assetForm.expires_at ? new Date(assetForm.expires_at).toISOString() : null,
        });
  if (ok) {
    editor.value = null;
    selected.value = null;
    await load();
  }
}
async function saveProfile() {
  if (saving.value) return;
  if (await write("/platform/crawler-profiles", profileForm)) {
    editor.value = null;
    await load();
  }
}
async function saveLogin() {
  if (saving.value) return;
  const provider = loginProvider.value;
  if (!provider || !loginPayload.value) return;
  const stamp = Date.now().toString(36),
    codeBase =
      provider.code
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 45) || "source";
  const asset = await write("/platform/credential-assets", {
    provider_id: provider.id,
    name: `${provider.name} ${loginMode.value === "archive" ? "浏览器" : "Cookie"}登录档案`,
    kind: loginMode.value === "archive" ? "browser_profile" : "cookie_bundle",
    secret_payload: {
      encoding: loginMode.value === "archive" ? "base64" : "utf8",
      value: loginPayload.value,
    },
    expires_at: null,
  });
  if (!asset) return;
  const profile = await write("/platform/crawler-profiles", {
    provider_id: provider.id,
    credential_asset_id: asset.id,
    code: `${codeBase}_login_${stamp}`.slice(0, 80),
    name: `${provider.name} 网页采集档案`,
    browser_family: "chromium",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    status: "active",
  });
  loginPayload.value = "";
  if (!profile) {
    message.value =
      "加密档案已保存，但运行档案未创建；请在下方“浏览器档案”中选择刚保存的档案继续。";
    return;
  }
  editor.value = null;
  await load();
  message.value = `${provider.name} 网页登录档案已加密保存；该来源完成解析验收后，采集任务才会使用此档案。`;
}
async function revoke() {
  if (saving.value) return;
  const target = revokeTarget.value;
  if (!target) return;
  if (
    await write(`/platform/credential-assets/${target.id}/revoke`, {
      expected_version: target.version,
      reason: "平台安全管理员确认撤销",
    })
  ) {
    revokeTarget.value = null;
    await load();
  }
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
onBeforeUnmount(() => activeController?.abort());
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
          <button type="button" :disabled="refreshing" @click="load">
            {{ refreshing ? "刷新中…" : "刷新数据" }}
          </button>
        </div>
        <div class="credential-primary-actions">
          <a
            class="helper-download"
            href="/browser-helper/scoutops-browser-helper.zip"
            download="scoutops-browser-helper.zip"
            >下载浏览器助手</a
          ><button type="button" @click="openLogin()">配置网页登录</button
          ><button type="button" @click="openProfile">关联运行档案</button
          ><button type="button" class="primary" @click="openAsset">新建凭证资产</button>
        </div>
      </div>
    </header>
    <p
      v-if="refreshNotice"
      class="credential-refresh-notice"
      :data-tone="refreshNoticeTone"
      role="status"
      aria-live="polite"
    >
      {{ refreshNotice }}
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
        <button type="button" @click="openAsset">创建第一个凭证</button>
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
            <button type="button" :disabled="asset.status === 'revoked'" @click="openRotate(asset)">
              更新资料</button
            ><button
              type="button"
              class="danger"
              :disabled="asset.status === 'revoked'"
              @click="revokeTarget = asset"
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
      <div
        v-if="editor"
        class="credential-editor-backdrop"
        @mousedown.self="closeEditor"
        @keydown.esc="closeEditor"
      >
        <form
          v-if="editor === 'asset' || editor === 'rotate'"
          ref="editorPanel"
          class="credential-editor"
          role="dialog"
          aria-modal="true"
          :aria-label="editor === 'rotate' ? `轮换 ${selected?.name}` : '创建凭证资产'"
          @keydown.tab="trapEditorFocus"
          @submit.prevent="saveAsset"
        >
          <header>
            <div>
              <p>
                {{ editor === "rotate" ? "更新加密资料" : "新建加密资料" }}
              </p>
              <h3>
                {{ editor === "rotate" ? `轮换 ${selected?.name}` : "创建凭证资产" }}
              </h3>
            </div>
            <button
              type="button"
              aria-label="关闭凭证编辑"
              title="关闭凭证编辑"
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
          role="dialog"
          aria-modal="true"
          aria-label="创建浏览器档案引用"
          @keydown.tab="trapEditorFocus"
          @submit.prevent="saveProfile"
        >
          <header>
            <div>
              <p>关联网页采集档案</p>
              <h3>创建浏览器档案引用</h3>
            </div>
            <button
              type="button"
              aria-label="关闭浏览器档案编辑"
              title="关闭浏览器档案编辑"
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
          role="dialog"
          aria-modal="true"
          aria-label="导入已经登录的浏览器档案"
          @keydown.tab="trapEditorFocus"
          @submit.prevent="saveLogin"
        >
          <header>
            <div>
              <p>配置网页登录</p>
              <h3>导入已经登录的浏览器档案</h3>
            </div>
            <button type="button" aria-label="关闭" @click="closeEditor">×</button>
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
              >需要登录的来源<select v-model="loginProvider" required>
                <option :value="null" disabled>请选择</option>
                <option v-for="item in loginProviders" :key="item.id" :value="item">
                  {{ item.name }}
                </option>
              </select></label
            ><label
              >导入方式<select
                v-model="loginMode"
                @change="
                  loginPayload = '';
                  loginFileName = '';
                "
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
            <button type="button" @click="openLoginPage">
              打开{{ loginNeedsAuthentication ? "登录" : "来源" }}页面 ↗
            </button>
            <button
              v-if="loginMode === 'browser'"
              type="button"
              :disabled="saving"
              @click="acquireBrowserCookies"
            >
              从当前浏览器读取 Cookie
            </button>
          </aside>
          <p v-if="message" role="status">{{ message }}</p>
          <footer>
            <button type="button" @click="closeEditor">取消</button
            ><button :disabled="saving || !loginProvider || !loginPayload">
              {{ saving ? "加密保存中…" : "加密保存并启用" }}
            </button>
          </footer>
        </form>
      </div>
    </Teleport>
    <ConfirmDialog
      :open="Boolean(revokeTarget)"
      title="确认撤销凭证资产？"
      :description="`${revokeTarget?.name ?? ''} 撤销后不能轮换或用于新档案。`"
      impact="只撤销当前平台资产；不会删除历史密文与审计。后续任务必须改用其他已授权凭证。"
      confirm-label="撤销资产"
      destructive
      confirmation-text="确认撤销"
      @cancel="revokeTarget = null"
      @confirm="revoke"
    />
  </section>
</template>
