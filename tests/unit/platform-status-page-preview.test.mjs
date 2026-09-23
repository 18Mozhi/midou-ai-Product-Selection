import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import { previewStatusPage } from "../../scripts/lib/platform-status-page-preview.mjs";
import { statusReviewFixtures } from "../../scripts/lib/status-review-fixtures.mjs";

const pageFile = "apps/web/src/components/PlatformManagementCenter.vue",
  centerFile = "apps/web/src/components/PlatformStatusCenterView.vue",
  workspaceFile = "apps/web/src/components/PlatformStatusWorkspace.vue",
  pageSource = readFileSync(pageFile, "utf8").replaceAll("\r\n", "\n"),
  centerSource = readFileSync(centerFile, "utf8").replaceAll("\r\n", "\n"),
  workspaceSource = readFileSync(workspaceFile, "utf8").replaceAll("\r\n", "\n"),
  reviewSource = previewStatusPage(pageSource);

function compile(file, source) {
  const { descriptor, errors } = parse(source);
  assert.deepEqual(errors, [], `${file}: SFC parse`);
  const script = compileScript(descriptor, { id: "p61" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: file,
      id: "p61",
      compilerOptions: { bindingMetadata: script.bindings },
    }).errors,
    [],
    `${file}: template compile`,
  );
}

test("P61 review mounts production Vue without changing the page script", () => {
  assert.equal(
    parse(reviewSource).descriptor.scriptSetup.content,
    parse(pageSource).descriptor.scriptSetup.content,
  );
  assert.match(reviewSource, /'platform-management--status-review': domain === 'status'/);
  assert.match(reviewSource, /P61 \/ 运行观测/);
  assert.match(reviewSource, /<h1 v-if="domain === 'status'">系统状态<\/h1>/);
});

test("P61 production page composes the four factual work areas and preserves all destinations", () => {
  const topology = readFileSync("apps/web/src/components/platform-status-topology.ts", "utf8");
  for (const key of ["attention", "dependencies", "session", "activity"])
    assert.match(centerSource, new RegExp(`<template #${key}>`));
  for (const [source, href] of [
    [centerSource, "/platform-admin/topology"],
    [topology, "/platform-admin/mysql"],
    [topology, "/platform-admin/redis"],
    [topology, "/platform-admin/files"],
    [topology, "/platform-admin/crawler-scheduler"],
    [centerSource, "/platform-admin/collection/overview"],
    [centerSource, "/platform-admin/providers/sources"],
  ])
    assert.ok(source.includes(href), href);
  assert.match(pageSource, /domain !== 'api-coverage' && domain !== 'status'/);
  assert.match(centerSource, /关联关系不代表下游服务已发生故障/);
  assert.match(centerSource, /当前浏览器标签页会话/);
});

test("P61 production page, workspace and preview compile as Vue components", () => {
  compile(pageFile, pageSource);
  compile(centerFile, centerSource);
  compile(workspaceFile, workspaceSource);
  compile(pageFile, reviewSource);
});

test("P61 preview fails closed if its production route marker drifts", () => {
  assert.throws(() =>
    previewStatusPage(
      pageSource.replace(
        "'platform-management--status-c': domain === 'status',",
        "'changed': domain === 'status',",
      ),
    ),
  );
});

test("P61 workspace selection stays local and exposes accessible button and panel state", () => {
  assert.match(workspaceSource, /defineProps<\{ warningCount: number; observedAt: string \}>/);
  assert.match(workspaceSource, /defineSlots</);
  assert.match(workspaceSource, /const active = ref<ViewKey>\("attention"\)/);
  assert.match(workspaceSource, /:aria-pressed="active === view.key"/);
  assert.match(workspaceSource, /:aria-controls="`p61-panel-\$\{view.key\}`"/);
  assert.match(workspaceSource, /v-show="active === view.key"/);
  assert.doesNotMatch(
    workspaceSource,
    /fetch\(|localStorage|sessionStorage|setInterval|setTimeout/,
  );
});

test("P61 review fixture matches the original M06-02 status response and browser-only metrics", async () => {
  const { fixture, metrics, nav } = await statusReviewFixtures();
  assert.equal(fixture.domain, "status");
  assert.equal(fixture.services.length, 6);
  assert.equal(metrics.reconnect_count, 2);
  assert.equal(metrics.connection_open_count, 8);
  assert.deepEqual(nav.platform_capabilities, ["platform:operate"]);
});
