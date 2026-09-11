import assert from "node:assert/strict";

const once = (source, anchor, replacement, label) => {
  assert.equal(source.split(anchor).length, 2, label);
  return source.replace(anchor, replacement);
};

export function previewCredentialLoginMaterial(source) {
  let review = once(
    source,
    '  loginMode = ref<"cookie_file" | "archive" | "browser">("cookie_file"),',
    '  loginMode = ref<"cookie_file" | "archive" | "browser">("cookie_file"),\n  loginMaterialBusy = ref(false),',
    "login mode state must be unique",
  );
  review = once(
    review,
    `async function acquireBrowserCookies() {
  const provider = loginProvider.value;`,
    `async function acquireBrowserCookies() {
  if (loginMaterialBusy.value) return;
  const provider = loginProvider.value;`,
    "browser material handler must be unique",
  );
  const handlerStart = `  saving.value = true;
  message.value = "正在请求浏览器助手读取当前来源域名的 Cookie…";`,
    handlerEnd = `  } finally {
    saving.value = false;
  }
}
async function write`;
  review = once(
    review,
    handlerStart,
    `  loginMaterialBusy.value = true;
  message.value = "正在从当前浏览器读取所选来源的登录材料…";`,
    "browser material busy start must be unique",
  );
  review = once(
    review,
    handlerEnd,
    `  } finally {
    loginMaterialBusy.value = false;
  }
}
async function write`,
    "browser material busy end must be unique",
  );
  review = once(
    review,
    `    message.value =
      error instanceof Error && error.message === "browser_cookie_empty"
        ? "当前浏览器没有这个来源可用的 Cookie。请先在刚打开的来源页面完成登录，再重新读取。"
        : "未检测到浏览器助手或未授予该网站权限。请先下载并加载浏览器助手，或改用 Cookie 文件上传。";`,
    `    message.value =
      error instanceof Error && error.message === "browser_cookie_empty"
        ? "当前浏览器没有这个来源可用的 Cookie。请先在刚打开的来源页面完成登录，再重新读取。"
        : error instanceof Error && error.message === "browser_helper_unavailable"
          ? "15 秒内没有收到浏览器助手响应。请确认助手已加载并授予当前来源权限，再重新读取；也可以改用 Cookie 文件上传。"
          : "浏览器助手没有返回可用材料。请检查当前来源权限后重新读取，或改用 Cookie 文件上传。";`,
    "browser material error copy must be unique",
  );
  review = once(
    review,
    `          class="credential-editor login-editor"
          role="dialog"`,
    `          class="credential-editor login-editor"
          role="dialog"
          :aria-busy="loginMaterialBusy"`,
    "login editor role must be unique",
  );
  review = once(
    review,
    `            <button type="button" aria-label="关闭" @click="closeEditor">×</button>
          </header>
          <aside class="login-guide">`,
    `            <button type="button" aria-label="关闭" @click="closeEditor">×</button>
          </header>
          <div class="p50-login-material-scroll">
          <aside class="login-guide">`,
    "login scroll start must be unique",
  );
  review = once(
    review,
    `              >需要登录的来源<select v-model="loginProvider" required>`,
    `              >需要登录的来源<select
                v-model="loginProvider"
                required
                :disabled="loginMaterialBusy"
              >`,
    "login provider select must be unique",
  );
  review = once(
    review,
    `                v-model="loginMode"
                @change="`,
    `                v-model="loginMode"
                :disabled="loginMaterialBusy"
                @change="`,
    "login mode select must be unique",
  );
  review = once(
    review,
    `              }}</small></label
            >
          </div>`,
    `              }}</small></label
            >
            <p
              v-if="loginMode !== 'browser' && loginFileName && loginPayload"
              class="p50-login-material-ready"
              role="status"
            >
              已读取导入材料：{{ loginFileName }}。内容不会在页面回显。
            </p>
          </div>`,
    "archive picker close must be unique",
  );
  review = once(
    review,
    `            <button type="button" @click="openLoginPage">`,
    `            <button type="button" :disabled="loginMaterialBusy" @click="openLoginPage">`,
    "external login button must be unique",
  );
  review = once(
    review,
    `              :disabled="saving"
              @click="acquireBrowserCookies"
            >
              从当前浏览器读取 Cookie`,
    `              :disabled="loginMaterialBusy"
              @click="acquireBrowserCookies"
            >
              {{ loginMaterialBusy ? "读取中…" : "从当前浏览器读取 Cookie" }}`,
    "browser read button must be unique",
  );
  review = once(
    review,
    `          <p v-if="message" role="status">{{ message }}</p>`,
    `          <p
            v-if="message"
            role="status"
            :data-tone="loginMaterialBusy ? 'pending' : loginPayload ? 'ready' : 'warning'"
          >
            {{ message }}
          </p>`,
    "login message must be unique",
  );
  review = once(
    review,
    `<button :disabled="saving || !loginProvider || !loginPayload">`,
    `<button :disabled="saving || loginMaterialBusy || !loginProvider || !loginPayload">`,
    "login save button must be unique",
  );
  review = once(
    review,
    `          <footer>
            <button type="button" @click="closeEditor">取消</button`,
    `          </div>
          <footer>
            <button type="button" @click="closeEditor">取消</button`,
    "login scroll end must be unique",
  );
  return review;
}
