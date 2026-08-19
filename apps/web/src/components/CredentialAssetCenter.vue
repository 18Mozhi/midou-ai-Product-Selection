<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import "../credential-assets.css";
import "../credential-login.css";
type State =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
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
}
const props = defineProps<{ apiBaseUrl: string }>(),
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
  loginFileName = ref(""),
  loginPayload = ref(""),
  loginProvider = ref<Provider | null>(null),
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
      (item) => item.kind === "browser_profile" && item.status === "active",
    ),
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
  (
    ({ active: "可用", revoked: "已撤销", disabled: "已停用" }) as Record<
      string,
      string
    >
  )[value] ?? value;
async function get(path: string) {
  const r = await fetch(`${props.apiBaseUrl}${path}`, {
      credentials: "include",
      headers: { accept: "application/json" },
    }),
    b = await r.json().catch(() => null);
  requestId.value = b?.request_id ?? requestId.value;
  if (!r.ok) throw { status: r.status };
  return b.data;
}
async function load() {
  state.value = "loading";
  message.value = "";
  try {
    [assets.value, profiles.value, providers.value] = await Promise.all([
      get("/platform/credential-assets"),
      get("/platform/crawler-profiles"),
      get("/platform/credential-provider-options"),
    ]);
    state.value =
      assets.value.length || profiles.value.length ? "ready" : "empty";
  } catch (error: any) {
    state.value = failure(error?.status ?? 503);
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
}
function openRotate(asset: Asset) {
  editor.value = "rotate";
  selected.value = asset;
  message.value = "";
  assetForm.value = "";
  assetForm.encoding = "utf8";
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
}
function openLogin(provider?: Provider) {
  loginProvider.value = provider ?? providers.value[0] ?? null;
  loginFileName.value = "";
  loginPayload.value = "";
  message.value = "";
  editor.value = "login";
}
async function chooseLoginArchive(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  loginFileName.value = "";
  loginPayload.value = "";
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".tar.gz")) {
    message.value = "请选择 .tar.gz 格式的浏览器登录档案。";
    return;
  }
  if (file.size > 6_000_000) {
    message.value =
      "登录档案压缩后不能超过 6 兆字节；只保留登录所需的浏览器资料后重试。";
    return;
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  loginFileName.value = file.name;
  loginPayload.value = dataUrl.slice(dataUrl.indexOf(",") + 1);
}
async function write(path: string, body: unknown) {
  saving.value = true;
  message.value = "";
  try {
    const r = await fetch(`${props.apiBaseUrl}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      }),
      b = await r.json().catch(() => null);
    requestId.value = b?.request_id ?? "";
    if (!r.ok) {
      message.value = b?.error?.action_hint ?? "操作未完成";
      return null;
    }
    return b.data;
  } catch {
    message.value = "依赖不可用，未写入";
    return null;
  } finally {
    saving.value = false;
    assetForm.value = "";
  }
}
async function saveAsset() {
  const ok =
    editor.value === "rotate" && selected.value
      ? await write(`/platform/credential-assets/${selected.value.id}/rotate`, {
          secret_payload: {
            encoding: assetForm.encoding,
            value: assetForm.value,
          },
          expected_version: selected.value.version,
        })
      : await write("/platform/credential-assets", {
          provider_id: assetForm.provider_id,
          name: assetForm.name,
          kind: assetForm.kind,
          secret_payload: {
            encoding: assetForm.encoding,
            value: assetForm.value,
          },
          expires_at: assetForm.expires_at
            ? new Date(assetForm.expires_at).toISOString()
            : null,
        });
  if (ok) {
    editor.value = null;
    selected.value = null;
    await load();
  }
}
async function saveProfile() {
  if (await write("/platform/crawler-profiles", profileForm)) {
    editor.value = null;
    await load();
  }
}
async function saveLogin() {
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
    name: `${provider.name} 网页登录档案`,
    kind: "browser_profile",
    secret_payload: { encoding: "base64", value: loginPayload.value },
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
  message.value = `${provider.name} 网页登录已配置，后续采集会使用加密档案。`;
}
async function revoke() {
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
    openLogin(
      providers.value.find((item) => item.code === params.get("provider_code")),
    );
  }
});
</script>
<template>
  <section class="credential-center">
    <header>
      <div>
        <p>平台安全资料库</p>
        <h2>凭证与浏览器档案</h2>
        <span
          >这里保存需要登录的网站资料。密码和登录状态加密后不会在页面回显，采集任务只能临时使用。</span
        >
      </div>
      <div>
        <button type="button" @click="openLogin()">＋ 配置网页登录</button
        ><button type="button" @click="openProfile">＋ 关联运行档案</button
        ><button type="button" class="primary" @click="openAsset">
          ＋ 凭证资产
        </button>
      </div>
    </header>
    <UiStatePanel
      v-if="!['ready', 'empty'].includes(state)"
      :kind="state"
      :request-id="requestId"
      @primary="load"
    />
    <section v-else>
      <div class="credential-metrics">
        <article>
          <small>可用加密资料</small
          ><strong>{{
            assets.filter((x) => x.status === "active").length
          }}</strong
          ><span>高强度加密保存</span>
        </article>
        <article>
          <small>网页采集档案</small><strong>{{ profiles.length }}</strong
          ><span>授权任务才可临时解密</span>
        </article>
        <article>
          <small>明文回显</small><strong>0</strong
          ><span>页面无法读取原始密码或登录状态</span>
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
        <article
          v-for="asset in assets"
          :key="asset.id"
          :data-status="asset.status"
        >
          <header>
            <span aria-hidden="true">{{
              asset.kind === "browser_profile" ? "▣" : "⌘"
            }}</span>
            <div>
              <small>{{ kindText(asset.kind) }}</small>
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
                {{
                  asset.rotated_at ? asset.rotated_at.slice(0, 10) : "尚未轮换"
                }}
              </dd>
            </div>
          </dl>
          <footer>
            <button
              type="button"
              :disabled="asset.status === 'revoked'"
              @click="openRotate(asset)"
            >
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
          <strong>{{ profile.name }}</strong
          ><span>语言：{{ profile.locale }} · 时区：{{ profile.timezone }}</span
          ><b>{{ statusText(profile.status) }}</b>
        </article>
        <p v-if="!profiles.length">暂无浏览器档案；不会创建模拟档案。</p>
      </section>
    </section>
    <form
      v-if="editor === 'asset' || editor === 'rotate'"
      class="credential-editor"
      @submit.prevent="saveAsset"
    >
      <header>
        <div>
          <p>
            {{ editor === "rotate" ? "更新加密资料" : "新建加密资料" }}
          </p>
          <h3>
            {{
              editor === "rotate" ? `轮换 ${selected?.name}` : "创建凭证资产"
            }}
          </h3>
        </div>
        <button
          type="button"
          aria-label="关闭凭证编辑"
          title="关闭凭证编辑"
          @click="
            editor = null;
            assetForm.value = '';
          "
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
        ><label v-if="editor === 'asset'"
          >名称<input v-model="assetForm.name" required /></label
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
        ><label v-if="editor === 'asset'"
          >到期时间（可选）<input
            v-model="assetForm.expires_at"
            type="datetime-local"
        /></label>
      </div>
      <p v-if="message" role="status">
        {{ message }} <code v-if="requestId">{{ requestId }}</code>
      </p>
      <footer>
        <button type="submit" :disabled="saving || !assetForm.value">
          {{
            saving
              ? "加密写入中…"
              : editor === "rotate"
                ? "确认轮换"
                : "加密保存"
          }}
        </button>
      </footer>
    </form>
    <form
      v-if="editor === 'profile'"
      class="credential-editor"
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
          @click="editor = null"
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
                browserAssets.find(
                  (x) => x.id === profileForm.credential_asset_id,
                )?.provider_id ?? ''
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
        <button type="submit" :disabled="saving || !browserAssets.length">
          保存档案引用
        </button>
      </footer>
    </form>
    <form
      v-if="editor === 'login'"
      class="credential-editor login-editor"
      @submit.prevent="saveLogin"
    >
      <header>
        <div>
          <p>配置网页登录</p>
          <h3>导入已经登录的浏览器档案</h3>
        </div>
        <button
          type="button"
          aria-label="关闭"
          @click="
            editor = null;
            loginPayload = '';
          "
        >
          ×
        </button>
      </header>
      <aside class="login-guide">
        <strong>为什么需要这一步？</strong>
        <p>
          亚马逊、亿贝等来源会要求网页登录。系统不会要求你填写官方接口，也不会在网页里记录平台密码；它只接收已登录浏览器的压缩档案并加密保存。
        </p>
        <ol>
          <li>在专用浏览器中登录目标网站并确认能正常打开页面。</li>
          <li>
            将该专用浏览器的用户资料目录压缩为
            <code>.tar.gz</code> 格式，压缩后不超过 6 兆字节。
          </li>
          <li>选择来源并上传，系统会同时创建加密资料和可运行档案。</li>
        </ol>
      </aside>
      <div class="credential-fields">
        <label
          >需要登录的来源<select v-model="loginProvider" required>
            <option :value="null" disabled>请选择</option>
            <option v-for="item in providers" :key="item.id" :value="item">
              {{ item.name }}
            </option>
          </select></label
        ><label class="archive-picker"
          >浏览器登录档案<input
            type="file"
            accept=".gz,application/gzip"
            required
            @change="chooseLoginArchive"
          /><small>{{ loginFileName || "请选择 .tar.gz 文件" }}</small></label
        >
      </div>
      <p v-if="message" role="status">{{ message }}</p>
      <footer>
        <button
          type="button"
          @click="
            editor = null;
            loginPayload = '';
          "
        >
          取消</button
        ><button :disabled="saving || !loginProvider || !loginPayload">
          {{ saving ? "加密保存中…" : "保存并启用" }}
        </button>
      </footer>
    </form>
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
