import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewTenancyPage } from "../../scripts/lib/tenancy-page-preview.mjs";
test("P08 keeps organization read separate from context write", async () => {
  const source = previewTenancyPage(
    await readFile("apps/web/src/components/TenancyChooser.vue", "utf8"),
  );
  assert.match(source, /chooseOrganization[\s\S]*?\/workspaces[\s\S]*?\/teams/);
  assert.match(
    source,
    /chooseWorkspace[\s\S]*?\/auth\/context[\s\S]*?organization_id[\s\S]*?workspace_id/,
  );
  assert.match(source, /workspace\.status!=='active'/);
  assert.match(source, /当前账号<\/span>/);
  assert.doesNotMatch(source, /tenancy-account/);
});
