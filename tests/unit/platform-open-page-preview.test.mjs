import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  previewOpenPage,
  previewOpenShell,
  openReviewImport,
  openCreateComponent,
} from "../../scripts/lib/platform-open-page-preview.mjs";
import { openReviewFixtures } from "../../scripts/lib/open-review-fixtures.mjs";
const original = await readFile("apps/web/src/components/OpenPlatformCenter.vue", "utf8");
const transformed = previewOpenPage(original);
test("P60 review transform preserves original business script except isolated component import", () => {
  assert.equal(
    parse(transformed).descriptor.scriptSetup.content.replace(openReviewImport, ""),
    parse(original.replaceAll("\r\n", "\n")).descriptor.scriptSetup.content,
  );
});
test("P60 preserves all three original ResponsiveDataView blocks and actions", () => {
  const blocks = (value) => value.match(/<ResponsiveDataView[\s\S]*?<\/ResponsiveDataView>/g);
  assert.equal(blocks(transformed).length, 3);
  assert.deepEqual(blocks(transformed), blocks(original.replaceAll("\r\n", "\n")));
  assert.equal((transformed.match(/<ConfirmDialog/g) || []).length, 1);
});
test("P60 review moves create to separate input step, preserves original handlers", () => {
  const workspace = transformed.indexOf('<section class="open-workspace"');
  assert.ok(workspace >= 0 && workspace < transformed.indexOf("<OpenCreateReview"));
  assert.ok(
    transformed.includes("@click=\"activeView === 'clients' ? createClient() : createWebhook()\""),
  );
  for (const key of ["organization_id", "name", "quota", "target_url", "reason", "events"])
    assert.ok(transformed.includes(`:aria-invalid="Boolean(fieldErrors.${key})"`));
});
test("P60 transform and original-slot component compile with Vue", async () => {
  for (const [source, filename] of [
    [transformed, "OpenPlatformCenter.vue"],
    [await readFile(openCreateComponent, "utf8"), "OpenCreateReview.vue"],
  ]) {
    const { descriptor, errors } = parse(source, { filename });
    assert.deepEqual(errors, []);
    const script = compileScript(descriptor, { id: filename });
    assert.deepEqual(
      compileTemplate({
        source: descriptor.template.content,
        filename,
        id: filename,
        compilerOptions: { bindingMetadata: script.bindings },
      }).errors,
      [],
    );
  }
});
test("P60 removes duplicate shell title only for the actual route", async () => {
  const shell = previewOpenShell(
    await readFile("apps/web/src/components/NavigationShell.vue", "utf8"),
  );
  assert.ok(shell.includes("routePath !== '/platform-admin/open-platform'"));
});
test("P60 transform refuses changed anchors", () => {
  assert.throws(
    () => previewOpenPage(original.replace("开放接口与事件回调", "renamed")),
    /Unique P60/,
  );
});
test("P60 samples are extracted from original E2E fixture without secret fabrication", async () => {
  const { fixture, orgId, nav } = await openReviewFixtures();
  assert.equal(fixture.clients[0].organization_id, orgId);
  assert.equal(fixture.clients[0].id, "c1");
  assert.equal(fixture.webhooks[0].id, "w1");
  assert.equal(fixture.deliveries[0].id, "d1");
  assert.equal(nav.shell, "platform_admin");
  assert.equal(JSON.stringify(fixture).includes('"secret"'), false);
});
