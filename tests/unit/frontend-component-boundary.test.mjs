import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const components = "apps/web/src/components";

test("thousand-line platform pages keep data orchestration in bounded presentation components", async () => {
  const limits = new Map([
    [`${components}/PlatformAccountCenter.vue`, 1_000],
    [`${components}/PlatformAdminRecords.vue`, 240],
    [`${components}/ProviderSourceCenter.vue`, 1_000],
    [`${components}/ProviderParserSampleDialog.vue`, 240],
  ]);

  for (const [path, limit] of limits) {
    const source = await readFile(path, "utf8");
    assert.ok(source.split(/\r?\n/u).length < limit, `${path} must remain below ${limit} lines`);
  }

  const [accounts, sources] = await Promise.all([
    readFile(`${components}/PlatformAccountCenter.vue`, "utf8"),
    readFile(`${components}/ProviderSourceCenter.vue`, "utf8"),
  ]);
  assert.match(accounts, /import PlatformAdminRecords/);
  assert.match(accounts, /<PlatformAdminRecords/);
  assert.match(sources, /import ProviderParserSampleDialog/);
  assert.match(sources, /<ProviderParserSampleDialog/);
});
