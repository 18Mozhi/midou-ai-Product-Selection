import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  previewSecurityPage,
  previewSecurityShell,
} from "../../scripts/lib/platform-security-page-preview.mjs";
import {
  shellReviewImport,
  shellReviewSetup,
} from "../../scripts/lib/ui-phase2-shell-vue-preview.mjs";
import { securityReviewFixtures } from "../../scripts/lib/security-review-fixtures.mjs";

for (const [name, transform] of [
  ["SecurityOperationsCenter", previewSecurityPage],
  ["NavigationShell", previewSecurityShell],
]) {
  test(`${name} C review preserves original scripts, bindings and styles`, async () => {
    const filename = `apps/web/src/components/${name}.vue`;
    const source = (await readFile(filename, "utf8")).replaceAll("\r\n", "\n"),
      result = transform(source);
    const before = parse(source).descriptor,
      after = parse(result).descriptor;
    assert.equal(
      after.scriptSetup.content.replace(shellReviewImport, "").replace(shellReviewSetup, ""),
      before.scriptSetup.content,
    );
    assert.deepEqual(
      after.styles.map(({ loc, map, ...style }) => style),
      before.styles.map(({ loc, map, ...style }) => style),
    );
    for (const re of [/v-model[\w.-]*="[^"]*"/g, /@[\w.-]+="[^"]*"/g, /:disabled="[^"]*"/g])
      for (const value of new Set(source.match(re) || []))
        assert.equal(
          (result.match(re) || []).filter((item) => item === value).length,
          (source.match(re) || []).filter((item) => item === value).length,
        );
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
test("P59 grouping keeps all five original data-view consumers and ready/error boundaries", async () => {
  const source = (
    await readFile("apps/web/src/components/SecurityOperationsCenter.vue", "utf8")
  ).replaceAll("\r\n", "\n");
  const result = previewSecurityPage(source);
  assert.equal((result.match(/<ResponsiveDataView/g) || []).length, 5);
  const consumers = (text) =>
    [...text.matchAll(/<ResponsiveDataView[\s\S]*?<\/ResponsiveDataView>/g)].map(
      (match) => match[0],
    );
  assert.deepEqual(consumers(result), consumers(source));
  assert.ok(result.indexOf("    <template v-else>") < result.indexOf('class="security-view-nav"'));
  assert.ok(result.indexOf('class="security-view-nav"') < result.indexOf('class="p59-background"'));
  assert.ok(result.indexOf('class="p59-background"') < result.indexOf('class="p59-investigation"'));
  assert.equal((result.match(/id="security-operations-title"/g) || []).length, 1);
});
test("review snapshots reuse original E2E fields and keep the two credential collections separate", async () => {
  const { fixture, snapshot } = await securityReviewFixtures();
  const credentials = snapshot("credentials");
  assert.deepEqual(credentials.credential_assets, fixture.credential_assets);
  assert.deepEqual(credentials.organization_tokens, fixture.organization_tokens);
  assert.deepEqual(credentials.sessions, []);
  assert.deepEqual(credentials.summary, fixture.summary);
  assert.equal(
    credentials.pagination.organization_tokens.total,
    fixture.organization_tokens.length,
  );
  assert.throws(() => snapshot("unknown"));
});

test("P59 review runner rejects live mode and unsafe capture paths before starting a server", () => {
  for (const args of [["--production"], ["--capture-review", "../overwrite"]]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-security-page-preview.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes("Use no arguments or --capture-review rN"));
    assert.equal(result.stdout, "");
  }
});
