import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { ref, computed } from "vue";

export async function verifyAppearanceSource() {
  const checks = [];
  class ApiClientError extends Error {
    constructor(kind, code) {
      super("synthetic failure");
      Object.assign(this, { kind, code, requestId: "synthetic-request" });
    }
  }
  const source = await readFile("apps/web/src/components/ThemeStudio.vue", "utf8");
  const themeSource = await readFile("apps/web/src/design/theme.ts", "utf8");
  async function setup() {
    const cache = new Map(),
      document = { documentElement: { dataset: {}, style: {} } },
      calls = [],
      replies = [];
    const window = {
      localStorage: { setItem: (k, v) => cache.set(k, v), getItem: (k) => cache.get(k) },
    };
    const theme = {};
    new Function(
      "exports",
      "document",
      "window",
      ts.transpileModule(themeSource, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText,
    )(theme, document, window);
    let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
    const ast = ts.createSourceFile("setup.ts", script, ts.ScriptTarget.Latest, true);
    for (const node of [...ast.statements].reverse())
      if (ts.isImportDeclaration(node)) script = script.slice(0, node.pos) + script.slice(node.end);
    const env = {
      ...theme,
      ref,
      computed,
      document,
      ApiClientError,
      defineProps: () => ({ apiBaseUrl: "inert" }),
      onMounted: () => {},
      crypto: { randomUUID: () => "synthetic-request-uuid" },
      createApiClient: () => async (url, options) => {
        calls.push({ url, options });
        assert.ok(replies.length, "unexpected request");
        const response = await replies.shift();
        if (response instanceof Error) throw response;
        return response;
      },
    };
    const expose =
      "state,selected,selectedDensity,saved,dirty,choose,chooseDensity,restore,load,save,mapError,requestId";
    const js = ts.transpileModule(script + `\nreturn {${expose}};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    return {
      ...new Function(...Object.keys(env), js)(...Object.values(env)),
      calls,
      replies,
      theme,
      cache,
      document,
    };
  }
  const preference = (theme = "deep-ocean", version = 1) => ({
    data: {
      theme,
      version,
      source: "saved",
      organization_id: "synthetic-org",
      workspace_id: "synthetic-workspace",
      updated_at: "2026-09-09T00:00:00Z",
    },
    request_id: "synthetic-response",
  });
  const initialized = async () => {
    const s = await setup();
    s.replies.push(preference());
    await s.load();
    return s;
  };
  let s = await initialized();
  assert.equal(s.calls[0].url, "/me/ui-preferences");
  assert.equal(s.dirty.value, false);
  s.chooseDensity("compact");
  await s.save();
  assert.equal(s.calls.length, 1);
  assert.equal(s.document.documentElement.dataset.density, "compact");
  checks.push("GET preference; density-only changes DOM, is not dirty and causes zero PUT");
  s.choose("aurora-purple");
  assert.equal(s.cache.get("scoutops:ui-theme"), "aurora-purple");
  assert.equal(s.calls.length, 1);
  s.restore();
  assert.equal(s.selected.value, "deep-ocean");
  assert.equal(s.selectedDensity.value, "compact");
  checks.push("preview writes actual cache adapter; restore theme leaves density untouched");
  s.choose("cloud-white");
  s.replies.push(preference("cloud-white", 2));
  await s.save();
  assert.deepEqual(s.calls.at(-1).options, {
    method: "PUT",
    requestId: "synthetic-request-uuid",
    body: { theme: "cloud-white", expected_version: 1 },
  });
  assert.equal(s.saved.value.version, 2);
  assert.equal(s.state.value, "saved");
  assert.equal(s.dirty.value, false);
  checks.push("exact theme/version PUT excludes density and consumes response version");
  s = await setup();
  s.choose("aurora-purple");
  s.replies.push(preference("aurora-purple", 1));
  await s.save();
  assert.equal(s.calls[0].options.body.expected_version, 0);
  checks.push(
    "current source can save without snapshot using expected_version 0; draft does not invent a snapshot",
  );
  for (const [kind, code, expected] of [
    ["expired", "session_expired", "expired"],
    ["forbidden", "permission_denied", "forbidden"],
    ["conflict", "preference_version_conflict", "conflict"],
    ["conflict", "other_conflict", "blocked"],
    ["blocked", "backend_unavailable", "blocked"],
    ["rate_limited", "rate_limited", "blocked"],
    ["error", "unknown", "error"],
  ]) {
    s = await initialized();
    s.choose("aurora-purple");
    s.replies.push(new ApiClientError(kind, code));
    await s.save();
    assert.equal(s.state.value, expected);
    assert.equal(s.selected.value, "aurora-purple");
    assert.equal(s.saved.value.theme, "deep-ocean");
    assert.equal(s.dirty.value, true);
  }
  checks.push(
    "seven error mappings; standalone save retains preview, unlike shell rollback; blocked conflates rate limit/network/scope",
  );
  s = await initialized();
  s.replies.push(preference("not-a-theme"));
  await s.load();
  assert.equal(s.state.value, "error");
  assert.equal(s.saved.value.theme, "deep-ocean");
  checks.push("invalid GET theme rejected while earlier snapshot remains in memory");
  s = await initialized();
  s.choose("aurora-purple");
  s.replies.push(preference("cloud-white", 2));
  await s.save();
  assert.equal(s.selected.value, "aurora-purple");
  assert.equal(s.saved.value.theme, "cloud-white");
  assert.equal(s.dirty.value, true);
  assert.equal(s.state.value, "saved");
  checks.push("save response differing from selection yields saved+dirty; do not show all synced");
  s = await initialized();
  s.choose("aurora-purple");
  let resolve;
  s.replies.push(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const pending = s.save();
  s.choose("cloud-white");
  s.chooseDensity("compact");
  assert.equal(s.selected.value, "aurora-purple");
  assert.equal(s.selectedDensity.value, "standard");
  const count = s.calls.length;
  await s.save();
  assert.equal(s.calls.length, count);
  s.restore();
  assert.equal(s.state.value, "ready");
  resolve(preference("aurora-purple", 2));
  await pending;
  assert.equal(s.selected.value, "deep-ocean");
  assert.equal(s.saved.value.theme, "aurora-purple");
  assert.equal(s.state.value, "saved");
  assert.equal(s.dirty.value, true);
  const knownGap = {
    status: "unfixed",
    selected: s.selected.value,
    saved: s.saved.value.theme,
    state: s.state.value,
    dirty: s.dirty.value,
  };
  checks.push(
    "saving guards choose/density/save but not restore; source restore/save race reproduced, not fixed",
  );
  s = await initialized();
  s.theme.applyDensity("standard");
  s.theme.applyShellDensity(true);
  assert.equal(s.document.documentElement.dataset.density, "compact");
  s.theme.applyShellDensity(false);
  assert.equal(s.document.documentElement.dataset.density, "standard");
  const fresh = await setup();
  fresh.theme.applyShellDensity(false);
  assert.equal(fresh.document.documentElement.dataset.density, "standard");
  checks.push(
    "administrative compact override preserves preferred density; fresh module defaults standard",
  );
  return {
    checks,
    count: checks.length,
    knownGap,
    scope:
      "actual ThemeStudio setup and theme.ts with inert transport/DOM/cache; not Vue mount, real storage, backend, concurrency control or production",
  };
}
if (process.argv[1]?.endsWith("verify-ui-phase2-appearance-source.mjs"))
  console.log(JSON.stringify(await verifyAppearanceSource(), null, 2));
