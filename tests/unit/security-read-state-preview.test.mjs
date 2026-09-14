import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "@vue/compiler-sfc";
import { compile } from "@vue/compiler-dom";
import * as Vue from "vue";
import { renderToString } from "@vue/server-renderer";
import { securityReadStates } from "../../scripts/lib/security-read-state-preview.mjs";

const source = readFileSync("apps/web/src/components/SecurityOperationsCenter.vue", "utf8");
const block = parse(source).descriptor.template.content.match(
  /<section\s+v-if="state !== 'ready'"[\s\S]*?<\/section>/,
)[0];
const render = new Function(
  "Vue",
  compile(block, { mode: "function", prefixIdentifiers: true }).code,
)(Vue);

for (const state of [
  "loading",
  "expired",
  "forbidden",
  "rate_limited",
  "blocked",
  "error",
  "ready",
]) {
  test(`actual P59 state markup preserves message and action semantics: ${state}`, async () => {
    const html = await renderToString(
      Vue.createSSRApp({
        data: () => ({
          state,
          stateTitle: "本地状态标题",
          notice: state === "loading" ? "" : "本地接口提示",
          requestId: state === "loading" ? "" : "local-read-id",
          refresh() {},
        }),
        render,
      }),
    );
    if (state === "ready") return assert.equal(html.includes("platform-dashboard-state"), false);
    assert.ok(html.includes(`aria-busy="${state === "loading"}"`));
    assert.ok(html.includes('aria-labelledby="security-read-state-title"'));
    assert.ok(html.includes('<h3 id="security-read-state-title">本地状态标题</h3>'));
    assert.ok(html.includes('<p role="status">'));
    assert.equal(html.includes("正在读取安全运营数据，请稍候。"), state === "loading");
    assert.equal(html.includes("检查 API 与 MySQL"), false);
    assert.equal(html.includes("本地接口提示"), state !== "loading");
    assert.equal(html.includes("重新读取"), !["loading", "expired", "forbidden"].includes(state));
    assert.equal(html.includes("local-read-id"), state !== "loading");
    assert.equal(html.includes("已保留上次成功数据"), false);
  });
}

test("read preview covers eight distinct states without changing the actual retry contract", () => {
  assert.deepEqual(
    securityReadStates.map((scene) => scene.key),
    [
      "loading",
      "expired",
      "forbidden",
      "rate_limited",
      "blocked",
      "error",
      "refreshing",
      "retained-error",
    ],
  );
  assert.deepEqual(
    securityReadStates.filter((scene) => scene.retained).map((scene) => scene.key),
    ["refreshing", "retained-error"],
  );
  const client = readFileSync("apps/web/src/api-client.ts", "utf8");
  assert.match(client, /SAFE_RETRY_DELAYS_MS = \[0, 150, 400\]/);
  assert.match(client, /SAFE_RETRY_STATUSES = new Set\(\[408, 425, 429, 502, 503, 504\]\)/);
});

test("read preview rejects mixed modes and unsafe capture revisions before starting a server", () => {
  for (const args of [
    ["--capture-read-states", "../overwrite"],
    ["--read-states", "--capture-review", "r1"],
    ["--capture-read-states", "r0"],
    ["--read-states", "--read-states"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-security-page-preview.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.ok(
      result.stderr.includes(
        "Use no arguments or --capture-review rN, --read-states, --capture-read-states rN",
      ),
    );
  }
});
