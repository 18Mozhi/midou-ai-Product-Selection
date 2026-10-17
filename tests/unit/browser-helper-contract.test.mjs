import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  assertBrowserHelperArchive,
  browserHelperDirectory,
  buildBrowserHelperArchive,
} from "../../scripts/browser-helper-archive.mjs";

test("browser helper packaging is identical across LF and CRLF and still rejects changed source", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-helper-eol-"));
  t.diagnostic(`temporary_root=${root}`);
  try {
    const fixtures = {
      "content-bridge.js": "// bridge fixture\nglobalThis.bridge = true;\n",
      "manifest.json": '{\n  "manifest_version": 3,\n  "name": "line-ending fixture"\n}\n',
      "service-worker.js": "// worker fixture\nglobalThis.worker = true;\n",
    };
    const archives = [];
    for (const variant of ["lf", "crlf"]) {
      const source = join(root, variant, "browser-helper", browserHelperDirectory);
      await mkdir(source, { recursive: true });
      for (const [name, text] of Object.entries(fixtures))
        await writeFile(
          join(source, name),
          variant === "lf" ? text : text.replaceAll("\n", "\r\n"),
        );
      archives.push(await buildBrowserHelperArchive(join(root, variant)));
    }
    assert.deepEqual(await readFile(archives[0]), await readFile(archives[1]));
    await assertBrowserHelperArchive(archives[0], join(root, "crlf"));
    await assertBrowserHelperArchive(archives[1], join(root, "lf"));
    await writeFile(
      join(root, "crlf", "browser-helper", browserHelperDirectory, "service-worker.js"),
      "globalThis.worker = false;\r\n",
    );
    await assert.rejects(
      () => assertBrowserHelperArchive(archives[0], join(root, "crlf")),
      /browser_helper_zip_source_mismatch/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    t.diagnostic(`temporary_root_deleted=${root}`);
  }
});

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
