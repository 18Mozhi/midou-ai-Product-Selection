import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createMemoryHistory, createRouter } from "vue-router";

const source = readFileSync(new URL("../../apps/web/src/account-route-guard.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { createSessionRouteGuard, isLegacyScopeRoute } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
const manifest = JSON.parse(readFileSync(new URL("../../apps/web/src/route-catalog.generated.json", import.meta.url), "utf8"));

function fixture(readSession) {
  const component = {};
  const records = manifest.routes.map((r) => ({
    name: r.name, path: r.path,
    ...(r.redirect ? { redirect: r.redirect } : { component }),
    meta: { sessionRequired: r.sessionRequired === true, notFound: r.notFound },
  }));
  records.push({ name: "legacy-alias-test", path: "/retired-alias-test", redirect: "/opportunities" });
  const retired = new Set(manifest.routes.filter(isLegacyScopeRoute).map((r) => r.name));
  retired.add("legacy-alias-test");
  const router = createRouter({ history: createMemoryHistory(), routes: records });
  router.beforeEach(createSessionRouteGuard(router, retired, readSession));
  return { router, retired };
}

for (const path of ["/select-context", "/org-admin/members", "/platform-admin/organizations/example", "/retired-alias-test"]) {
  test(`first account-mode visit cannot resolve legacy route ${path}`, async () => {
    let reads = 0;
    const { router, retired } = fixture(async () => {
      assert.equal(++reads, 1, "retired route redirects once");
      return { authenticated: false, account_rehearsal: true };
    });
    await router.push(path + "?bookmark=1#saved");
    assert.equal(router.currentRoute.value.name, "not-found");
    assert.equal(router.currentRoute.value.fullPath, path + "?bookmark=1#saved");
    for (const name of retired) assert.equal(router.hasRoute(name), false, name);
    assert.equal(router.resolve("/opportunities").meta.notFound, false);
    assert.equal(router.resolve("/platform-admin/accounts").meta.notFound, false);
  });
}

test("legacy entries fail closed when mode is unknown, but are untouched on a valid legacy deployment", async () => {
  for (const read of [async () => { throw Error("offline"); }, async () => ({}), async () => ({authenticated:true,account_rehearsal:1})]) {
    const { router } = fixture(read);
    await router.push("/select-context");
    assert.equal(router.currentRoute.value.path, "/login");
    assert.equal(router.currentRoute.value.query.redirect, "/select-context");
    assert.equal(router.hasRoute("select-context"), true, "unknown mode is not a retirement receipt");
  }
  const { router } = fixture(async () => ({ authenticated: true }));
  await router.push("/select-context");
  assert.equal(router.currentRoute.value.name, "select-context");
});
