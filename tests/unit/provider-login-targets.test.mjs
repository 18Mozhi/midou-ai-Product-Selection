import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BUILTIN_PROVIDER_SOURCES } from "../../packages/provider-sources/dist/index.js";
import { MySqlProviderSourceRepository } from "../../apps/api/dist/mysql-provider-source-repository.js";

test("every setup source has a real HTTPS page and authenticated sources can open login targets", () => {
  const setup = BUILTIN_PROVIDER_SOURCES.filter(
    (item) => item.availability === "setup_required",
  );
  assert.ok(setup.length > 0);
  for (const item of setup) {
    const target = new URL(item.target_url);
    assert.equal(target.protocol, "https:", item.code);
    assert.notEqual(target.hostname, "", item.code);
    assert.notEqual(target.protocol, "setup:", item.code);
  }
  for (const code of [
    "1688_search",
    "taobao",
    "tmall",
    "jd",
    "tiktok_shop",
    "temu",
    "shein",
    "aliexpress",
  ]) {
    const source = setup.find((item) => item.code === code);
    assert.equal(source?.access_mode, "authenticated_browser", code);
    assert.match(source?.target_url ?? "", /^https:\/\//, code);
  }
});

test("source UI only offers anonymous tests for executable automatic public adapters", async () => {
  const ui = await readFile(
    "apps/web/src/components/ProviderSourceCenter.vue",
    "utf8",
  );
  assert.match(
    ui,
    /item\.availability === 'automatic'[\s\S]*\['public_page', 'public_rss'\]/,
  );
  assert.match(ui, /配置网页登录/);
});

test("catalog synchronization honors the declared source status for ERP and manual imports", async () => {
  const inserted = new Map();
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values = []) => {
      if (sql.includes("FROM platform_role_assignments"))
        return [[{ user_id: "00000000-0000-4000-8000-000000000001" }], []];
      if (sql === "SELECT id,status,version FROM providers WHERE code=? FOR UPDATE")
        return [[], []];
      if (sql.startsWith("INSERT INTO providers"))
        inserted.set(values[1], values[19]);
      return [[], []];
    },
  };
  const pool = { getConnection: async () => connection };
  const definitions = BUILTIN_PROVIDER_SOURCES.filter((item) =>
    ["erp_product_catalog", "manual_product_supply_csv"].includes(item.code),
  );
  const result = await new MySqlProviderSourceRepository(pool).syncCatalog({
    definitions,
    now: new Date("2026-08-19T10:00:00.000Z"),
  });
  assert.equal(inserted.get("erp_product_catalog"), "enabled");
  assert.equal(inserted.get("manual_product_supply_csv"), "disabled");
  assert.equal(result.automatic_enabled, 0);
});
