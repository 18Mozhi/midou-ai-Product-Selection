import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewOrgRefresh } from "../../scripts/lib/ui-phase2-org-refresh-preview.mjs";
import {
  previewOrgReadState,
  orgReadStateReplacements,
  reloadFocusScript,
  orgReadStateCss,
} from "../../scripts/lib/ui-phase2-org-read-state-preview.mjs";

test("organization read-state transform reverses to prior review without changing read contracts", async () => {
  const source = (
    await readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8")
  ).replaceAll("\r\n", "\n");
  const previous = previewOrgRefresh(source),
    proposed = previewOrgReadState(source);
  let reversed = proposed;
  for (const [before, after] of [...orgReadStateReplacements].reverse()) {
    assert.equal(reversed.split(after).length, 2);
    reversed = reversed.replace(after, before);
  }
  assert.equal(reversed, previous);
  const before = parse(previous).descriptor,
    after = parse(proposed).descriptor;
  assert.equal(
    after.scriptSetup.content.replace(reloadFocusScript, ""),
    before.scriptSetup.content,
  );
  const compiled = compileScript(after, { id: "org-read-state" });
  assert.deepEqual(
    compileTemplate({
      source: after.template.content,
      filename: "OrganizationAdminCenter.vue",
      id: "org-read-state",
      compilerOptions: { bindingMetadata: compiled.bindings },
    }).errors,
    [],
  );
  for (const [anchor] of orgReadStateReplacements.filter(([anchor]) => source.includes(anchor)))
    assert.throws(() => previewOrgReadState(source.replace(anchor, "changed-anchor")));
});
test("organization reload focus owns its trigger and always invokes original load with no options", () => {
  for (const active of [true, false])
    for (const connected of [true, false])
      for (const inert of [true, false]) {
        let focused = 0;
        const calls = [];
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
        const trigger = new Button(),
          box = {
            HTMLButtonElement: Button,
            document: { activeElement: active ? trigger : {} },
            load: (...args) => {
              calls.push(args);
              return "original-read";
            },
          };
        vm.runInNewContext(
          ts.transpileModule(reloadFocusScript + "globalThis.run=reloadFromControl;", {
            compilerOptions: { target: ts.ScriptTarget.ES2022 },
          }).outputText,
          box,
        );
        assert.equal(box.run({ currentTarget: trigger }), "original-read");
        assert.equal(focused, active && connected && !inert ? 1 : 0);
        assert.deepEqual(calls, [[]]);
      }
});
test("organization unavailable CSS is review scoped and header facts require ready state", async () => {
  const css = (await readFile(orgReadStateCss, "utf8")).replace(/\s+/g, " ");
  assert.ok(css.includes("body.org-read-state-c:has(#app) #app .role-shell.role-shell--review"));
  assert.ok(css.includes(":not(:has(> .org-admin-metrics))"));
  assert.ok(!css.includes("!important"));
  assert.ok(css.includes("min-height: 44px"));
  assert.ok(orgReadStateReplacements[0][1].includes('state === "ready"'));
  assert.ok(orgReadStateReplacements[1][1].includes("state === 'ready'"));
  assert.ok(orgReadStateReplacements[6][1].includes("{{ requestId }}"));
});
test("organization read-state packet proves current images, redaction and original retry counts", async () => {
  const root = "output/playwright/org-read-state-vue-c-r1";
  const evidence = JSON.parse(await readFile(`${root}/evidence.json`, "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(evidence.kind, "ORG-READ-STATE-VUE-C-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.userReview, "pending");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 32);
  assert.equal(evidence.screenshots.length, 54);
  assert.equal(Object.keys(evidence.sourceHashes).length, 178);
  const cases = [401, 403, 409, 429, 500, 503]
    .map((status) => ({ status, entry: "initial" }))
    .concat([401, 403].map((status) => ({ status, entry: "background" })));
  assert.deepEqual(
    evidence.runs.map((r) => `${r.mode}/${r.entry}/${r.status}/${r.width}`),
    ["baseline", "review"].flatMap((mode) =>
      cases.flatMap((c) => [390, 1440].map((width) => `${mode}/${c.entry}/${c.status}/${width}`)),
    ),
  );
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
  for (const shot of evidence.screenshots) {
    const bytes = await readFile(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of evidence.runs) {
    const actual = (name) => run.checks.find((c) => c.name === name)?.actual;
    assert.equal(actual("old facts and editing removed"), 0);
    assert.equal(
      actual("original automatic attempts retained"),
      [429, 503].includes(run.status) ? 3 : 1,
    );
    assert.equal(actual("recovery one summary request"), 1);
    assert.equal(actual("zero writes or request bodies"), true);
    assert.deepEqual(actual("no unexpected network"), []);
    assert.deepEqual(actual("no runtime errors"), []);
    assert.ok(run.requests.every((r) => r.key.startsWith("GET ") && r.body === null));
    if (run.mode === "review") {
      assert.deepEqual(actual("previous metadata observation"), { name: false, timestamp: false });
      assert.equal(actual("single error region no duplicate banner"), 0);
      assert.equal(actual("retry focus stays on persistent heading"), true);
      assert.equal(actual("loading region has status semantics"), "status");
    } else if (run.entry === "background")
      assert.deepEqual(actual("previous metadata observation"), { name: true, timestamp: true });
  }
});
