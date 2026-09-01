import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  UI_STATE_KINDS,
  DEFAULT_STATE_COPY,
  stateFromHttp,
  sanitizeCorrelationId,
  canConfirm,
} from "../../apps/web/src/ui/state-contract.ts";
const read = (path) => readFile(path, "utf8");
test("M02-04.A02/A04/A12 failure mapping is deterministic and exhaustive", () => {
  assert.deepEqual(UI_STATE_KINDS, [
    "loading",
    "empty",
    "error",
    "forbidden",
    "expired",
    "blocked",
    "recovery",
    "not_found",
  ]);
  assert.equal(stateFromHttp(401), "expired");
  assert.equal(stateFromHttp(403), "forbidden");
  assert.equal(stateFromHttp(404), "not_found");
  for (const status of [408, 425, 429, 502, 503, 504])
    assert.equal(stateFromHttp(status), "blocked");
  assert.equal(stateFromHttp(409), "error");
  for (const kind of UI_STATE_KINDS) {
    assert.ok(DEFAULT_STATE_COPY[kind].title);
    assert.ok(DEFAULT_STATE_COPY[kind].description);
    assert.ok(DEFAULT_STATE_COPY[kind].primary);
  }
});
test("M02-04.A08/A11/A12 destructive confirmation and correlation ids fail closed", () => {
  assert.equal(canConfirm({ destructive: true, acknowledged: false }), false);
  assert.equal(
    canConfirm({
      destructive: true,
      acknowledged: true,
      confirmationText: "确认撤销",
      typedText: "错误",
    }),
    false,
  );
  assert.equal(
    canConfirm({
      destructive: true,
      acknowledged: true,
      confirmationText: "确认撤销",
      typedText: "确认撤销",
    }),
    true,
  );
  assert.equal(sanitizeCorrelationId("request-01:trace_ok"), "request-01:trace_ok");
  assert.equal(sanitizeCorrelationId("secret value with spaces"), "");
  assert.equal(sanitizeCorrelationId("x".repeat(129)), "");
});
test("M02-04.A01/A03/A05/A06/A09/A10/A13/A14 component contract adds no backend or persistence surface", async () => {
  const [panel, dialog, showcase, notFound, app, openapi, env, architecture] = await Promise.all(
    [
      "apps/web/src/components/UiStatePanel.vue",
      "apps/web/src/components/ConfirmDialog.vue",
      "apps/web/src/components/UiStateShowcase.vue",
      "apps/web/src/components/NotFoundPage.vue",
      "apps/web/src/App.vue",
      "docs/openapi.yaml",
      "config/env.example",
      "docs/architecture/m02-04-common-ui-states.md",
    ].map(read),
  );
  assert.match(panel, /aria-live/);
  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /Escape/);
  assert.match(showcase, /不触发任何业务写入|不会请求后端/);
  assert.match(app, /isNotFoundRoute/);
  assert.match(app, /selectedView\.value === "ui-states"/);
  assert.match(app, /NotFoundPage v-else-if="isNotFoundRoute"/);
  assert.match(notFound, /candidate\.meta\.notFound === true/);
  assert.match(notFound, /这里不会把不存在的页面解释为无权限/);
  assert.doesNotMatch(notFound, /UiStateShowcase|ConfirmDialog|m02-04-request/);
  assert.match(showcase, /router\.push\(\{ query: \{ \.\.\.route\.query, state: kind \} \}\)/);
  assert.match(showcase, /展示页没有业务接口|展示页不会伪造申请成功/);
  assert.match(openapi, /ErrorEnvelope|components\/responses\/Error/);
  assert.doesNotMatch(env, /UI_STATE_|CONFIRM_DIALOG_/);
  assert.match(architecture, /不新增数据库迁移|无需数据库迁移/);
  const migrations = await readdir("database/migrations");
  assert.equal(migrations.filter((name) => name.includes("m02_04")).length, 0);
});
test("M02-04.A07/A15/A16/A17 visual recovery and delivery evidence exists", async () => {
  const [styles, e2e, runbook, feature, blueprint] = await Promise.all(
    [
      "apps/web/src/styles/onboarding-navigation.css",
      "tests/e2e/m02-04-ui-states.spec.ts",
      "docs/runbooks/m02-04-common-ui-states.md",
      "docs/feature-map.json",
      "new-product-enterprise-blueprint.md",
    ].map(read),
  );
  assert.match(styles, /\.ui-state-panel/);
  assert.match(styles, /\.confirm-dialog/);
  assert.match(styles, /max-height:\s*calc\(100dvh - 36px\)/);
  assert.match(styles, /@media\s*\(\s*max-width:\s*780px\s*\)/);
  assert.match(e2e, /keyboard\.press/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(runbook, /宝塔网站/);
  assert.match(feature, /commonUiStates/);
  assert.match(blueprint, /M02-04/);
});
