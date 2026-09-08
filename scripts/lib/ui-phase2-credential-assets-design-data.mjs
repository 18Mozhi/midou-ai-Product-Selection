import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Executes actual source in an inert bridge. No HTTP, encryption, files or extension access.
export async function buildCredentialDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const parse = (v) => ts.createSourceFile("source.ts", v, ts.ScriptTarget.Latest, true);
  const compile = (v) =>
    ts.transpileModule(v, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
  const fixture = parse(await read("tests/e2e/m03-02-credential-assets.spec.ts"));
  const declarations = fixture.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => [...s.declarationList.declarations]);
  const names = ["provider", "secondProvider", "asset", "profile"];
  const box = {};
  vm.runInNewContext(
    compile(
      names
        .map((name) => {
          const n = declarations.find((n) => n.name.getText(fixture) === name);
          assert.ok(n, name);
          return `const ${n.getText(fixture)};`;
        })
        .join("\n") + `\nglobalThis.result={${names}};`,
    ),
    box,
  );
  const original = plain(box.result);
  const text = await read("apps/web/src/components/CredentialAssetCenter.vue");
  const ast = parse(text.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const exported = [
    "state,assets,profiles,providers,requestId,message,editor,selected,revokeTarget,saving,refreshing,lastUpdatedAt,refreshNotice",
    "loginFileName,loginPayload,loginProvider,loginMode,assetForm,profileForm,browserAssets,loginProviders,compatibilityRows",
    "load,openAsset,openRotate,openProfile,openLogin,closeEditor,chooseLoginArchive,openLoginPage,acquireBrowserCookies",
    "saveAsset,saveProfile,saveLogin,revoke,kindText,statusText,providerName,assetName",
  ].join(",");
  const source = compile(
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast))
      .join("\n") + `\nglobalThis.result={${exported}};`,
  );
  const clock = "2026-09-09T04:00:00.000Z";
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() {
      return new Date(clock).getTime();
    }
  }
  class ApiClientError extends Error {
    constructor(status) {
      super(String(status));
      this.status = status;
      this.actionHint = `合成拒绝 ${status}`;
      this.requestId = `synthetic-${status}`;
    }
  }
  function mount(search = "") {
    const calls = [],
      timers = [],
      mounted = [],
      unmount = [],
      messages = [];
    const listeners = new Map();
    const win = {
      setTimeout: (fn, ms) => {
        timers.push({ fn, ms });
        return timers.length;
      },
      clearTimeout: () => {},
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name) => listeners.delete(name),
      postMessage: (msg) => messages.push(msg),
      open: (...args) => messages.push(args),
    };
    const b = {
      ref: (value) => ({ value }),
      reactive: (v) => v,
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      nextTick: (fn) => Promise.resolve().then(fn),
      onMounted: (fn) => mounted.push(fn),
      onBeforeUnmount: (fn) => unmount.push(fn),
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient:
        () =>
        (route, options = {}) =>
          new Promise((resolve, reject) => calls.push({ route, options, resolve, reject })),
      ApiClientError,
      AbortController,
      DOMException,
      URLSearchParams,
      Date: FixedDate,
      document: { activeElement: null },
      HTMLElement: class {},
      location: { search, origin: "https://inert.invalid" },
      crypto: { randomUUID: () => "inert-request" },
      window: win,
    };
    vm.runInNewContext(source, b);
    const c = b.result;
    c.assets.value = [plain(original.asset)];
    c.profiles.value = [plain(original.profile)];
    c.providers.value = [plain(original.provider), plain(original.secondProvider)];
    return { c, calls, timers, mounted, unmount, messages, listeners, win };
  }
  const resolve = (call, data) =>
    call.resolve({ data: plain(data), request_id: "synthetic-request" });
  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const checks = [];
  {
    const { c } = mount();
    assert.equal(c.browserAssets.value.length, 1);
    assert.equal(c.compatibilityRows.value[0].ready, false);
    c.profiles.value[0].status = "active";
    assert.equal(c.compatibilityRows.value[0].ready, true);
    c.assets.value[0].expires_at = clock;
    assert.equal(c.browserAssets.value.length, 1);
    assert.equal(c.compatibilityRows.value[0].ready, false);
    c.assets.value[0].status = "revoked";
    assert.equal(c.browserAssets.value.length, 0);
    assert.equal(c.compatibilityRows.value[0].status, "待配置登录资料");
    c.openProfile();
    assert.equal(c.profileForm.status, "disabled");
    assert.equal(c.profileForm.locale, "en-US");
    assert.equal(c.profileForm.timezone, "America/Los_Angeles");
    checks.push(
      "Actual compatibility at exact expiry, active/revoked candidates and disabled manual profile defaults; ready is metadata only",
    );
  }
  for (const preserve of [false, true])
    for (const status of [401, 403, 409, 503, "timeout"]) {
      const { c, calls, timers, unmount } = mount();
      if (preserve) {
        c.lastUpdatedAt.value = clock;
        c.state.value = "ready";
      }
      const before = plain([c.assets.value, c.profiles.value, c.providers.value]);
      const p = c.load();
      await c.load();
      assert.equal(calls.length, 3);
      assert.equal(timers[0].ms, 12000);
      resolve(calls[0], []);
      resolve(calls[1], []);
      if (status === "timeout") {
        timers[0].fn();
        assert.ok(calls[2].options.signal.aborted);
      }
      calls[2].reject(
        status === "timeout"
          ? new DOMException("aborted", "AbortError")
          : new ApiClientError(status),
      );
      await p;
      assert.deepEqual(plain([c.assets.value, c.profiles.value, c.providers.value]), before);
      assert.equal(
        c.state.value,
        preserve
          ? "ready"
          : status === 401
            ? "expired"
            : status === 403
              ? "forbidden"
              : status === 409
                ? "error"
                : "blocked",
      );
      if (preserve) assert.match(c.refreshNotice.value, /保留/);
      const again = c.load();
      unmount[0]();
      assert.ok(calls[3].options.signal.aborted);
      calls.slice(3).forEach((call) => call.reject(new DOMException("aborted", "AbortError")));
      await again;
    }
  checks.push(
    "Ten actual initial/preserved three-read failure paths; atomic snapshots, single flight, 12-second timer callback and unmount abort, not real elapsed timeout/KeepAlive",
  );
  // Synthetic marker exists in this function only, never returned, persisted or displayed.
  const marker = "in-memory-verification-material";
  for (const mode of ["asset", "rotate", "profile", "revoke"]) {
    const { c, calls } = mount();
    if (mode === "asset") {
      c.openAsset();
      c.assetForm.name = "合成资产";
      c.assetForm.value = marker;
    }
    if (mode === "rotate") {
      c.openRotate(original.asset);
      c.assetForm.value = marker;
    }
    if (mode === "profile") {
      c.openProfile();
      c.profileForm.code = "study_profile";
      c.profileForm.name = "合成档案";
    }
    if (mode === "revoke") c.revokeTarget.value = original.asset;
    const fn = mode === "profile" ? "saveProfile" : mode === "revoke" ? "revoke" : "saveAsset";
    const p = c[fn]();
    await c[fn]();
    assert.equal(calls.length, 1);
    const expected =
      mode === "asset"
        ? {
            provider_id: original.provider.id,
            name: "合成资产",
            kind: "api_key",
            secret_payload: { encoding: "utf8", value: marker },
            expires_at: null,
          }
        : mode === "rotate"
          ? {
              secret_payload: { encoding: "utf8", value: marker },
              expected_version: 2,
              expires_at: null,
            }
          : mode === "profile"
            ? {
                provider_id: original.provider.id,
                credential_asset_id: original.asset.id,
                code: "study_profile",
                name: "合成档案",
                browser_family: "chromium",
                locale: "en-US",
                timezone: "America/Los_Angeles",
                status: "disabled",
              }
            : { expected_version: 2, reason: "平台安全管理员确认撤销" };
    assert.deepEqual(plain(calls[0].options.body), expected);
    calls[0].reject(new ApiClientError(409));
    await p;
    assert.match(c.message.value, /409/);
    assert.equal(c.assetForm.value, "");
  }
  checks.push(
    "Actual create/rotate/manual-profile/revoke exact bodies and duplicate guards; errors retain editor and clear asset secret, no real writes",
  );
  for (const mode of ["cookie_file", "browser", "archive"]) {
    const { c, calls } = mount();
    c.openLogin();
    c.loginMode.value = mode;
    c.loginPayload.value = marker;
    const p = c.saveLogin();
    assert.deepEqual(plain(calls[0].options.body), {
      provider_id: original.provider.id,
      name: `${original.provider.name} ${mode === "archive" ? "浏览器" : "Cookie"}登录档案`,
      kind: mode === "archive" ? "browser_profile" : "cookie_bundle",
      secret_payload: { encoding: mode === "archive" ? "base64" : "utf8", value: marker },
      expires_at: null,
    });
    resolve(calls[0], original.asset);
    await flush();
    assert.deepEqual(plain(calls[1].options.body), {
      provider_id: original.provider.id,
      credential_asset_id: original.asset.id,
      code: `browser_source_login_${FixedDate.now().toString(36)}`,
      name: `${original.provider.name} 网页采集档案`,
      browser_family: "chromium",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      status: "active",
    });
    calls[1].reject(new ApiClientError(503));
    await p;
    assert.equal(c.loginPayload.value, "");
    assert.equal(c.editor.value, "login");
    assert.match(c.message.value, /关闭此窗口并刷新数据/);
    await c.saveLogin();
    assert.equal(calls.length, 2);
  }
  checks.push(
    "All three actual login modes: exact independent asset then active zh-CN/Asia-Shanghai profile bodies; partial success clears payload, stays open, no automatic refresh or second asset",
  );
  {
    const { c, calls } = mount();
    c.openLogin();
    c.loginPayload.value = marker;
    const p = c.saveLogin();
    calls[0].reject(new ApiClientError(503));
    await p;
    assert.equal(c.loginPayload.value, marker);
    c.closeEditor();
    assert.equal(c.loginPayload.value, "");
    c.openAsset();
    c.assetForm.value = marker;
    const save = c.saveAsset();
    c.closeEditor();
    c.openAsset();
    c.assetForm.value = "new-inert-material";
    calls[1].reject(new ApiClientError(409));
    await save;
    assert.equal(c.assetForm.value, "");
    checks.push(
      "Reproduced actual first login write failure retaining material and old failed write clearing a newly opened asset secret; no protection inferred",
    );
  }
  {
    const { c } = mount();
    c.openLogin();
    let finish;
    const file = {
      name: "synthetic.cookies",
      size: 12,
      text: () => new Promise((r) => (finish = r)),
    };
    const p = c.chooseLoginArchive({ target: { files: [file] } });
    c.closeEditor();
    finish(marker);
    await p;
    assert.equal(c.editor.value, null);
    assert.equal(c.loginPayload.value, marker);
    c.openLogin();
    c.loginPayload.value = marker;
    c.loginProvider.value = original.secondProvider;
    assert.equal(c.loginPayload.value, marker);
    checks.push(
      "Reproduced actual delayed in-memory file completion repopulating closed editor and source switch retaining old payload; no OS file read",
    );
  }
  for (const [mode, name, size, pass] of [
    ["cookie_file", "a.JSON", 2000000, true],
    ["cookie_file", "a.cookies", 2000001, false],
    ["cookie_file", "a.zip", 1, false],
    ["archive", "a.tar.gz", 6000001, false],
    ["archive", "a.gz", 1, false],
  ]) {
    const { c } = mount();
    c.openLogin();
    c.loginMode.value = mode;
    await c.chooseLoginArchive({ target: { files: [{ name, size, text: async () => marker }] } });
    assert.equal(Boolean(c.loginPayload.value), pass);
  }
  {
    const { c, timers, messages, listeners, win } = mount();
    c.openLogin();
    const p = c.acquireBrowserCookies();
    assert.equal(timers[0].ms, 15000);
    assert.deepEqual(plain(messages[0].payload), { target_url: original.provider.target_url });
    c.closeEditor();
    listeners.get("message")({
      source: win,
      data: {
        type: "SCOUTOPS_BROWSER_BRIDGE_RESULT",
        request_id: "inert-request",
        ok: true,
        data: { cookies: [] },
      },
    });
    await p;
    assert.equal(c.loginPayload.value, "[]");
    assert.equal(c.editor.value, null);
  }
  checks.push(
    "Actual file extension/byte boundaries and inert same-window helper reply: 15-second timer and delayed closed-editor repopulation; no extension called",
  );
  for (const search of [
    "?mode=login&provider_id=missing",
    `?mode=login&provider_id=${original.secondProvider.id}`,
  ]) {
    const { c, calls, mounted } = mount(search);
    const p = mounted[0]();
    resolve(calls[0], []);
    resolve(calls[1], []);
    resolve(calls[2], [original.provider, original.secondProvider]);
    await p;
    assert.equal(
      c.loginProvider.value.id,
      search.includes("missing") ? original.provider.id : original.secondProvider.id,
    );
  }
  checks.push(
    "Actual mounted exact source deep link and invalid-ID fallback to first authenticated provider; not router history lifecycle proof",
  );
  const assetTemplate = text.split("v-if=\"editor === 'asset' || editor === 'rotate'\"")[1];
  assert.ok(assetTemplate, "asset form marker");
  const [assetOnly, profileAndLogin] = assetTemplate.split("v-if=\"editor === 'profile'\"");
  const profileOnly = profileAndLogin.split("v-if=\"editor === 'login'\"")[0];
  assert.ok(assetOnly.includes('<p v-if="message" role="status">'));
  assert.ok(!profileOnly.includes('v-if="message"'));
  const service = await read("apps/api/src/credential-asset-service.ts");
  assert.match(service, /value\.expires_at \?\? record\.summary\.expires_at/);
  checks.push(
    "Source review: asset/rotate message exists; profile message absent. UTC rotation initial value/local save and service null fallback remain unresolved contracts, not fixed",
  );
  return {
    original,
    clock,
    checks,
    sourcePaths: [
      "apps/web/src/components/CredentialAssetCenter.vue",
      "apps/web/src/components/ConfirmDialog.vue",
      "apps/web/src/components/ResponsiveDataView.vue",
      "apps/web/src/components/TableViewControls.vue",
      "apps/web/src/ui/state-contract.ts",
      "apps/api/src/credential-asset-service.ts",
      "apps/api/src/credential-asset-routes.ts",
      "apps/api/src/mysql-credential-asset-repository.ts",
      "tests/e2e/m03-02-credential-assets.spec.ts",
    ],
  };
}
