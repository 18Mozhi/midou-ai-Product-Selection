import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import {
  securityDetailCss,
  securityDetailPlugin,
} from "../../scripts/lib/security-detail-preview.mjs";

test("P59 detail review adds CSS only; no shared drawer source transform", () => {
  const plugin = securityDetailPlugin();
  assert.equal(plugin.transform, undefined);
  const html = "<html><head></head><body>unchanged</body></html>";
  const result = plugin.transformIndexHtml(html);
  assert.match(result, /platform-security-detail-preview\.css/);
  assert.equal(result.replace(/<link[^>]+>/, ""), html);
  assert.throws(() => plugin.transformIndexHtml("<head></head></head>"));
});

test("P59 teleported detail CSS stays scoped and preserves visible keyboard/scroll affordances", async () => {
  const css = await readFile(securityDetailCss, "utf8");
  assert.match(
    css,
    /body\.shell-vue-c:has\(#app \.security-ops--review\) > \.responsive-data-view__overlay/,
  );
  assert.match(css, /:is\(button, summary\):focus-visible/);
  assert.match(css, /outline: 3px solid #2f6ee5/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(css, /display: list-item/);
  assert.doesNotMatch(css, /display:\s*none|outline:\s*(?:none|0)|pointer-events:\s*none/);
});

test("P59 detail runner rejects external/baseline capture and unsafe output paths", () => {
  for (const args of [
    ["--production"],
    ["--capture-review", "../replace"],
    ["--capture-lifecycle", "../replace"],
    ["--capture-removal", "../replace"],
    ["--lifecycle", "--capture-review", "r1"],
    ["--baseline", "--capture-review", "r1"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-security-detail-preview.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.ok(
      result.stderr.includes(
        "Use no arguments or one mode: --baseline, --lifecycle, --removal, --capture-review rN, --capture-lifecycle rN, --capture-removal rN",
      ),
    );
    assert.equal(result.stdout, "");
  }
});
