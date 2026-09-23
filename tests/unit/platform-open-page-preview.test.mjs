import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  previewOpenPage,
  previewOpenShell,
} from "../../scripts/lib/platform-open-page-preview.mjs";

const pagePath = "apps/web/src/components/OpenPlatformCenter.vue";
const dialogPath = "apps/web/src/components/OpenCreateDialog.vue";
const actionDialogPath = "apps/web/src/components/OpenActionReasonDialog.vue";
const page = await readFile(pagePath, "utf8");
const transformed = previewOpenPage(page);

test("P60 production C page exposes one route-owned title and three accessible task views", () => {
  assert.match(page, /class="open-platform open-platform--c"/);
  assert.match(page, /<h1>开放平台<\/h1>/);
  for (const view of ["clients", "webhooks", "deliveries"]) {
    assert.match(page, new RegExp(`data-view="${view}"`));
    assert.match(
      page,
      new RegExp(`aria-current="activeView === '${view}' \\? 'page' : undefined"`),
    );
  }
  assert.equal((page.match(/<ResponsiveDataView/g) || []).length, 3);
});

test("P60 creation remains in the original form model and handlers, inside a native dialog", async () => {
  assert.match(page, /<OpenCreateDialog[\s\S]*?<section class="open-create"/);
  assert.match(page, /@click="activeView === 'clients' \? createClient\(\) : createWebhook\(\)"/);
  assert.match(page, /path: "\/platform\/open\/clients"/);
  assert.match(page, /path: "\/platform\/open\/webhooks"/);
  assert.match(page, /scopes: \["status:read"\]/);
  assert.match(page, /:aria-invalid="Boolean\(fieldErrors\.organization_id\)"/);
  assert.match(page, /aria-describedby="p60-org-help p60-org-error"/);
  assert.match(page, /class="field-error"/);
  assert.match(page, /<ConfirmDialog/);
  const dialog = await readFile(dialogPath, "utf8");
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /@cancel\.prevent="close"/);
  assert.match(dialog, /waitingForConfirmation/);
  assert.match(dialog, /@keydown="keydown"/);
  assert.match(page, /<OpenActionReasonDialog/);
  const actionDialog = await readFile(actionDialogPath, "utf8");
  assert.match(actionDialog, /aria-describedby="p60-action-reason-help p60-action-reason-error"/);
  assert.match(actionDialog, /@cancel\.prevent="cancel"/);
});

test("P60 review transform is idempotent and its shell title is route-scoped", async () => {
  assert.match(transformed, /open-platform--c open-platform--review/);
  assert.equal(transformed.replace(" open-platform--review", ""), page.replaceAll("\r\n", "\n"));
  const shell = previewOpenShell(
    await readFile("apps/web/src/components/NavigationShell.vue", "utf8"),
  );
  assert.match(shell, /routePath !== '\/platform-admin\/open-platform'/);
  const styles = await readFile("apps/web/src/open-platform-c.css", "utf8");
  assert.match(styles, /\.role-shell:has\(\.open-platform--c\) \.role-page-title/);
});

test("P60 actual Vue and create dialog compile", async () => {
  for (const [source, filename] of [
    [page, pagePath],
    [await readFile(dialogPath, "utf8"), dialogPath],
    [await readFile(actionDialogPath, "utf8"), actionDialogPath],
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
