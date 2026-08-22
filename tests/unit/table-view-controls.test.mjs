import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("all desktop table surfaces share column visibility freeze and density controls", async () => {
  const [controls, responsive, credentials, logs] = await Promise.all(
    [
      "apps/web/src/components/TableViewControls.vue",
      "apps/web/src/components/ResponsiveDataView.vue",
      "apps/web/src/components/CredentialAssetCenter.vue",
      "apps/web/src/components/PlatformLogCenter.vue",
    ].map((path) => readFile(path, "utf8")),
  );

  assert.match(controls, /列设置/);
  assert.match(controls, /hiddenColumns/);
  assert.match(controls, /首列已冻结/);
  assert.match(controls, /data-table-density/);
  assert.match(controls, /position: sticky/);
  assert.match(controls, /visibleColumnCount <= 1/);
  assert.doesNotMatch(controls, /!important|#[0-9a-f]{3,8}\b/i);
  assert.match(responsive, /TableViewControls/);
  for (const source of [credentials, logs]) assert.match(source, /ResponsiveDataView/);
});
