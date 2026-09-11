import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { providerPagePreview } from "../../scripts/lib/ui-phase2-provider-page-preview.mjs";
import { historicalProviderFocusSource } from "../../scripts/lib/ui-phase2-provider-focus-baseline.mjs";

const read = (f) => historicalProviderFocusSource(f, readFileSync(f, "utf8"));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const folder = "output/playwright/p46-provider-detail-vue-preview";
const source = "apps/web/src/components/ProviderRegistry.vue";
const evidence = () => JSON.parse(read(folder + "/evidence.json"));
const variants = [
  "normal",
  "blocked",
  "compliant",
  "login",
  "import",
  "manual",
  "expired",
  "rejected",
  "draft",
  "long",
];

test("P46 historical detail slot and script keep their original Vue association", () => {
  const original = read(source),
    transformed = providerPagePreview(original);
  const slot = (s) => s.match(/<template #detail="[^"]*">[\s\S]*?<\/template>/g);
  assert.equal(slot(original)?.length, 1);
  assert.deepEqual(slot(transformed), slot(original));
  assert.equal(
    parse(original).descriptor.scriptSetup.content,
    parse(transformed).descriptor.scriptSetup.content,
  );
  assert.ok(evidence().sourceHashes["apps/web/src/components/ResponsiveDataView.vue"]);
});

test("P46 detail historical source and exact68 image inventory are pinned", () => {
  const e = evidence();
  assert.equal(e.kind, "P46-PROVIDER-DETAIL-VUE-PREVIEW-r1");
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 232);
  assert.equal(e.screenshots.length, 68);
  assert.equal(Object.keys(e.sourceHashes).length, 40);
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
  assert.deepEqual(e.transformedHashes, { [source]: hash(providerPagePreview(read(source))) });
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(folder + "/" + s.file);
    assert.equal(hash(bytes), s.sha256, s.file);
    assert.deepEqual(s.imageDimensions, {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    });
    assert.equal(s.imageDimensions.width, s.width);
    assert.equal(s.imageDimensions.height, s.state.startsWith("short-screen") ? 568 : 900);
  }
});

test("P46 detail10 supplied variants preserve9+5 facts and limited focus checks with no writes", () => {
  const e = evidence(),
    requests = e.observations.filter((o) => o.requests);
  assert.deepEqual(
    requests.map((o) => o.width),
    [390, 760],
  );
  for (const o of requests) {
    const value = (name) => {
      const c = e.checks.find((c) => c.width === o.width && c.name === name);
      assert.ok(c, name);
      return c.actual;
    };
    assert.deepEqual(o.errors, []);
    assert.deepEqual(o.unexpected, []);
    assert.equal(o.requests.length, 10);
    assert.ok(
      o.requests.every((r) => r.method === "GET" && r.path === "/api/v1/platform/providers"),
    );
    const states = e.screenshots.filter((s) => s.width === o.width).map((s) => s.state);
    assert.equal(states.length, o.width === 390 ? 35 : 33);
    assert.equal(new Set(states).size, states.length);
    for (const variant of variants) {
      for (const state of ["default", "facts-bottom", "technical"])
        assert.ok(states.includes(variant + "-" + state));
      assert.deepEqual(
        value(variant + ":nine exact facts").map(([label]) => label),
        [
          "接入方式",
          "市场 / 语言",
          "调度",
          "超时 / 重试",
          "当前状态",
          "执行门禁",
          "条款复核",
          "条款版本",
          "条款到期",
        ],
      );
      assert.deepEqual(
        value(variant + ":five exact technical facts").map(([label]) => label),
        ["来源 ID", "来源代码", "目标地址", "接入模式代码", "解析器 / 定义版本"],
      );
      assert.equal(value(variant + ":background inert"), true);
      assert.equal(value(variant + ":initial close focus"), true);
      assert.equal(value(variant + ":Escape returns record focus"), true);
      assert.equal(value(variant + ":inert released"), false);
    }
    assert.match(value("compliant:nine exact facts")[5][1], /不代表采集任务已成功/);
    assert.equal(value("blocked:nine exact facts")[7][1], "未登记");
    assert.equal(value("blocked:nine exact facts")[8][1], "未登记");
    assert.equal(value("normal:nine exact facts")[8][1], "2027/8/8 01:00:00");
    for (const name of [
      "Shift Tab wraps to technical summary",
      "Tab wraps to close",
      "editor owns focus after handoff",
    ])
      assert.equal(value(name), true);
    assert.equal(value("one editor replaces detail"), 1);
    assert.equal(value("detail gone on editor handoff"), 0);
    assert.equal(value("background released for editor"), false);
    assert.equal(value("editor initial code matches selected"), "public_signal_rss");
    assert.equal(value("URL unchanged"), "?keep=p46");
  }
});

test("P46 historical detail CSS is isolated and BODY focus evidence is not rewritten", () => {
  assert.doesNotMatch(read("apps/web/src/main.ts"), /provider-detail-preview/);
  assert.match(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-detail-preview.css"),
    /body\.p46-detail-review/,
  );
  const e = evidence();
  assert.deepEqual(
    e.observations.filter((o) => o.editorCloseFocus),
    [390, 760].map((width) => ({
      width,
      editorCloseFocus: { tag: "BODY", connected: true, insideRecord: false },
    })),
  );
  assert.match(e.scope, /GET directory only, no writes/);
  assert.match(e.scope, /editor close focus separately observed, not claimed fixed/);
  assert.match(e.scope, /Not full App\/KeepAlive\/assistive technology or full-page acceptance/);
});
