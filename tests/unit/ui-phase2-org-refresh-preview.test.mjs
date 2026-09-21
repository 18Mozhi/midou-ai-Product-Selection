import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewOrgSummary } from "../../scripts/lib/ui-phase2-shell-org-fixture.mjs";
import {
  previewOrgRefresh,
  orgRefreshReplacements,
  refreshFocusScript,
  orgRefreshCss,
} from "../../scripts/lib/ui-phase2-org-refresh-preview.mjs";

test("refresh preview reverses exactly to organization r2 without changing load or submit", async () => {
  const source = (
    await readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8")
  ).replaceAll("\r\n", "\n");
  const proposed = previewOrgRefresh(source);
  let reversed = proposed;
  for (const [before, after] of [...orgRefreshReplacements].reverse()) {
    assert.equal(reversed.split(after).length, 2);
    reversed = reversed.replace(after, before);
  }
  assert.equal(reversed, previewOrgSummary(source));
  const original = parse(source).descriptor,
    next = parse(proposed).descriptor;
  assert.equal(
    next.scriptSetup.content.replace(refreshFocusScript, ""),
    original.scriptSetup.content,
  );
  const compiled = compileScript(next, { id: "org-refresh" });
  assert.deepEqual(
    compileTemplate({
      source: next.template.content,
      filename: "OrganizationAdminCenter.vue",
      id: "org-refresh",
      compilerOptions: { bindingMetadata: compiled.bindings },
    }).errors,
    [],
  );
  for (const [before] of orgRefreshReplacements.filter(([before]) => source.includes(before)))
    assert.throws(() => previewOrgRefresh(source.replace(before, "changed-anchor")));
});

test("refresh focus follows only its own active button and calls original load once", () => {
  for (const active of [true, false])
    for (const connected of [true, false])
      for (const inert of [true, false]) {
        let focused = 0;
        const loads = [];
        const heading = {
          isConnected: connected,
          closest: () => (inert ? {} : null),
          focus: (options) => {
            assert.deepEqual(JSON.parse(JSON.stringify(options)), { preventScroll: true });
            focused++;
          },
        };
        class Button {
          closest() {
            return { querySelector: () => heading };
          }
        }
        const trigger = new Button();
        const box = {
          HTMLButtonElement: Button,
          document: { activeElement: active ? trigger : {} },
          load: (options) => {
            loads.push(options);
            return "original-load";
          },
        };
        vm.runInNewContext(
          ts.transpileModule(refreshFocusScript + "globalThis.run=refreshFromControl;", {
            compilerOptions: { target: ts.ScriptTarget.ES2022 },
          }).outputText,
          box,
        );
        assert.equal(box.run({ currentTarget: trigger }), "original-load");
        assert.equal(focused, active && connected && !inert ? 1 : 0);
        assert.deepEqual(JSON.parse(JSON.stringify(loads)), [{ background: true }]);
      }
});

test("refresh CSS and disclosure remain in review host and use original notice", async () => {
  const css = (await readFile(orgRefreshCss, "utf8")).replace(/\s+/g, " ");
  assert.ok(css.includes("body.org-refresh-c:has(#app) #app .role-shell.role-shell--review"));
  assert.ok(css.includes(":has(> .org-admin-metrics)"));
  assert.ok(css.includes("min-height: 44px"));
  assert.ok(!css.includes("!important"));
  assert.ok(orgRefreshReplacements.some(([, after]) => after.includes("<p>{{ notice }}</p>")));
});

test("refresh current captures bind sources, images, read lifecycle and no writes", async () => {
  const root = "output/playwright/org-refresh-vue-c-r1";
  const evidence = JSON.parse(await readFile(`${root}/evidence.json`, "utf8"));
  const hash = (data) => createHash("sha256").update(data).digest("hex");
  assert.equal(evidence.kind, "ORG-REFRESH-VUE-C-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.userReview, "pending");
  assert.equal(evidence.processesClosed, true);
  assert.deepEqual(
    evidence.runs.map((r) => `${r.mode}/${r.width}`),
    ["baseline/390", "baseline/1440", "review/390", "review/1440"],
  );
  assert.equal(evidence.screenshots.length, 14);
  assert.equal(Object.keys(evidence.sourceHashes).length, 176);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
  for (const shot of evidence.screenshots) {
    const bytes = await readFile(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of evidence.runs) {
    assert.ok(run.requests.every((r) => r.key.startsWith("GET ") && r.body === null));
    const actual = (name) => run.checks.find((c) => c.name === name)?.actual;
    assert.equal(actual("failure keeps unsaved draft"), "未保存的本地审核草稿");
    assert.equal(actual("retry removes old notice using original load"), 0);
    assert.equal(actual("unfocused trigger does not steal focus"), true);
    assert.equal(actual("zero writes or request bodies"), true);
    assert.equal(actual("only four summary reads"), 4);
    assert.equal(actual("failure keeps ready content"), "ready");
    assert.equal(actual("success uses current original form reset policy"), "Global Goods Co.");
    assert.deepEqual(actual("no unexpected network"), []);
    assert.deepEqual(actual("no runtime errors"), []);
    if (run.mode === "review") assert.equal(actual("pending focus observation").heading, true);
    else
      assert.deepEqual(actual("pending focus observation"), {
        tag: "BODY",
        body: true,
        heading: false,
      });
  }
});
