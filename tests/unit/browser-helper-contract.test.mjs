import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertBrowserHelperArchive } from "../../scripts/browser-helper-archive.mjs";

test("browser helper is restricted to ai选品 origins and never returns ERP token", async () => {
  const manifest = JSON.parse(
      await readFile("browser-helper/scoutops-browser-helper/manifest.json", "utf8"),
    ),
    worker = await readFile("browser-helper/scoutops-browser-helper/service-worker.js", "utf8"),
    bridge = await readFile("browser-helper/scoutops-browser-helper/content-bridge.js", "utf8"),
    credentialCenter = await readFile("apps/web/src/components/CredentialAssetCenter.vue", "utf8");
  assert.deepEqual(manifest.content_scripts[0].matches, [
    "https://midouai.medouai.com/*",
    "http://127.0.0.1/*",
    "http://localhost/*",
  ]);
  assert.doesNotMatch(JSON.stringify(manifest.content_scripts[0].matches), /https:\/\/\*\/\*/);
  assert.match(worker, /BRIDGE_ORIGINS[\s\S]*browser_bridge_origin_forbidden/);
  assert.match(worker, /\["s\.1688\.com", "https:\/\/\*\.1688\.com\/\*"\]/);
  assert.doesNotMatch(worker, /COOKIE_PARENT_DOMAIN_PERMISSIONS[\s\S]*https:\/\/\*\/\*/);
  assert.match(worker, /if \(!cookies\.length\) throw new Error\("browser_cookie_empty"\)/);
  assert.match(worker, /Authorization: token/);
  assert.doesNotMatch(worker, /return\s+\{[^}]*token/s);
  assert.match(bridge, /scoutops-browser-bridge/);
  assert.match(credentialCenter, /error\.message === "browser_cookie_empty"/);
  assert.match(credentialCenter, /当前浏览器没有这个来源可用的 Cookie/);
});

test("published browser helper archive exactly matches the reviewed extension source", async () => {
  const archive = await assertBrowserHelperArchive(
    resolve("apps/web/public/browser-helper/scoutops-browser-helper.zip"),
  );
  const manifest = JSON.parse(
    archive.get("scoutops-browser-helper/manifest.json").toString("utf8"),
  );
  const worker = archive.get("scoutops-browser-helper/service-worker.js").toString("utf8");
  assert.deepEqual(manifest.content_scripts[0].matches, [
    "https://midouai.medouai.com/*",
    "http://127.0.0.1/*",
    "http://localhost/*",
  ]);
  assert.match(worker, /https:\/\/midouai\.medouai\.com/);
  assert.match(worker, /https:\/\/\*\.1688\.com\/\*/);
  assert.doesNotMatch(worker, /https:\/\/midouai\.mozhiz\.cn/);
});
