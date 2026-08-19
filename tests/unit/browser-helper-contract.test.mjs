import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("browser helper is restricted to ai选品 origins and never returns ERP token", async () => {
  const manifest = JSON.parse(
      await readFile(
        "browser-helper/scoutops-browser-helper/manifest.json",
        "utf8",
      ),
    ),
    worker = await readFile(
      "browser-helper/scoutops-browser-helper/service-worker.js",
      "utf8",
    ),
    bridge = await readFile(
      "browser-helper/scoutops-browser-helper/content-bridge.js",
      "utf8",
    );
  assert.deepEqual(manifest.content_scripts[0].matches, [
    "https://midouai.mozhiz.cn/*",
    "http://127.0.0.1/*",
    "http://localhost/*",
  ]);
  assert.doesNotMatch(
    JSON.stringify(manifest.content_scripts[0].matches),
    /https:\/\/\*\/\*/,
  );
  assert.match(worker, /BRIDGE_ORIGINS[\s\S]*browser_bridge_origin_forbidden/);
  assert.match(worker, /Authorization: token/);
  assert.doesNotMatch(worker, /return\s+\{[^}]*token/s);
  assert.match(bridge, /scoutops-browser-bridge/);
});
