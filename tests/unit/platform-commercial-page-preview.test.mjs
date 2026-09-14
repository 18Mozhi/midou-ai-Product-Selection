import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  previewCommercialPage,
  previewCommercialShell,
  commercialReviewSetup,
} from "../../scripts/lib/platform-commercial-page-preview.mjs";
import {
  shellReviewImport,
  shellReviewSetup,
} from "../../scripts/lib/ui-phase2-shell-vue-preview.mjs";

for (const [name, transform] of [
  ["CommercialOperationsCenter", previewCommercialPage],
  ["NavigationShell", previewCommercialShell],
]) {
  test(`${name}: C preview retains original scripts/contracts/styles and compiles`, async () => {
    const filename = `apps/web/src/components/${name}.vue`;
    const source = (await readFile(filename, "utf8")).replaceAll("\r\n", "\n");
    const result = transform(source),
      before = parse(source).descriptor,
      parsed = parse(result);
    assert.deepEqual(parsed.errors, []);
    const after = parsed.descriptor;
    assert.equal(
      after.scriptSetup.content
        .replace(commercialReviewSetup, "")
        .replace(shellReviewImport, "")
        .replace(shellReviewSetup, ""),
      before.scriptSetup.content,
    );
    assert.deepEqual(
      after.styles.map(({ loc, map, ...style }) => style),
      before.styles.map(({ loc, map, ...style }) => style),
    );
    for (const re of [
      /v-model[\w.-]*="[^"]*"/g,
      /@[\w.-]+="[^"]*"/g,
      /(?:pattern|minlength|maxlength|required|:disabled)(?:="[^"]*")?/g,
    ]) {
      const expected = source.match(re) || [],
        actual = result.match(re) || [];
      for (const value of new Set(expected))
        assert.equal(
          actual.filter((x) => x === value).length,
          expected.filter((x) => x === value).length,
          value,
        );
    }
    const script = compileScript(after, { id: name });
    assert.deepEqual(
      compileTemplate({
        source: after.template.content,
        filename,
        id: name,
        compilerOptions: { bindingMetadata: script.bindings },
      }).errors,
      [],
    );
    assert.throws(() => transform(result));
  });
}
test("P58 task sections leave all original Teleport dialogs outside the conditional workspace", async () => {
  const source = (
    await readFile("apps/web/src/components/CommercialOperationsCenter.vue", "utf8")
  ).replaceAll("\r\n", "\n");
  const result = previewCommercialPage(source);
  const originalDialogs = source.slice(
    source.indexOf('    <Teleport to="body"'),
    source.indexOf("</template>\n\n<style"),
  );
  assert.ok(result.includes(originalDialogs));
  assert.ok(result.includes('    </template>\n    <Teleport to="body"'));
  assert.equal((result.match(/@submit.prevent="readOrganization"/g) || []).length, 1);
  assert.ok(result.includes("v-show=\"reviewTask === 'organization'\""));
  assert.ok(!result.includes("请在下方按名称"));
  assert.ok(
    result.indexOf('@submit.prevent="readOrganization"') <
      result.indexOf("v-if=\"state === 'loading'\""),
    "Failed reads must not hide UUID correction",
  );
});

test("P58 CLI expression parses and host rejects unsupported flags before starting", async () => {
  new vm.Script(
    `(${await readFile("scripts/lib/platform-commercial-page-browser-checks.js", "utf8")})`,
  );
  const result = spawnSync(
    process.execPath,
    ["scripts/preview-platform-commercial-page.mjs", "--production"],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes("Only --capture-review is accepted"));
});

test("P58 initial read feedback owns its trace while retained notice remains separate", async () => {
  const text = previewCommercialPage(
    await readFile("apps/web/src/components/CommercialOperationsCenter.vue", "utf8"),
  );
  assert.ok(text.includes('v-if="notice && loadedOnce"'));
  const errorPanel = text.slice(
    text.indexOf("v-else-if=\"['error', 'rate_limited', 'blocked']"),
    text.indexOf("    <template v-else>"),
  );
  assert.ok(errorPanel.includes('<TechnicalDetails :request-id="requestId" />'));
  assert.ok(errorPanel.includes('@click="load()"'));
  new vm.Script(
    `(${await readFile("scripts/lib/platform-commercial-read-browser-checks.js", "utf8")})`,
  );
});
