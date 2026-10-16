import assert from "node:assert/strict";
import test from "node:test";
import { BUILTIN_PROVIDER_SOURCES } from "../../packages/provider-sources/dist/index.js";
import { MySqlProviderSourceCatalogRepository } from "../../apps/api/dist/mysql-provider-source-catalog-repository.js";
const definition = BUILTIN_PROVIDER_SOURCES.find((d) => d.code === "amazon_product");
const now = new Date("2026-10-17T00:00:00Z");
function fixture(overrides = {}, fail = false) {
  const expected = {
    name: definition.name,
    target_url: definition.target_url,
    access_mode: definition.access_mode,
    markets_json: definition.markets,
    languages_json: definition.languages,
    fields_json: definition.fields,
    dedupe_key: definition.dedupe_key,
    failure_rules_json: definition.failure_rules,
    parser_version: definition.parser_version,
    healthcheck_url: definition.healthcheck_url,
    owner_label: definition.owner_label,
  };
  const row = { id: "source", status: "enabled", version: 8, ...expected, ...overrides },
    calls = [];
  const c = {
    beginTransaction: async () => calls.push(["begin"]),
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
    query: async (sql, values) => {
      calls.push([sql, values]);
      if (sql.includes("FROM platform_role_assignments")) return [[{ user_id: "admin" }]];
      if (sql.startsWith("SELECT id,status,version,")) return [[row]];
      if (sql.startsWith("UPDATE providers")) {
        if (fail) throw Error("write failed");
        return [{ affectedRows: 1 }];
      }
      throw Error("unexpected query");
    },
  };
  return {
    calls,
    repository: new MySqlProviderSourceCatalogRepository({ getConnection: async () => c }),
  };
}
for (const encoded of [false, true])
  test(`unchanged catalog preserves smoke timestamp with JSON ${encoded ? "text" : "objects"}`, async () => {
    const f = fixture(
      encoded
        ? {
            markets_json: JSON.stringify(definition.markets),
            languages_json: JSON.stringify(definition.languages),
            fields_json: JSON.stringify(definition.fields),
            failure_rules_json: JSON.stringify(definition.failure_rules),
          }
        : {},
    );
    const result = await f.repository.syncCatalog({ definitions: [definition], now });
    assert.equal(result.updated, 0);
    assert.equal(result.automatic_enabled, Number(definition.availability === "automatic"));
    assert.equal(
      f.calls.some(([s]) => s.startsWith("UPDATE providers")),
      false,
    );
    assert.deepEqual(f.calls.slice(-2), [["commit"], ["release"]]);
  });
for (const status of ["enabled", "disabled"])
  test(`parser upgrade updates metadata but preserves ${status} and configuration version`, async () => {
    const f = fixture({ status, parser_version: "amazon-structured-product-v2" });
    const result = await f.repository.syncCatalog({ definitions: [definition], now });
    assert.equal(result.updated, 1);
    assert.equal(
      result.automatic_enabled,
      status === "enabled" && definition.availability === "automatic" ? 1 : 0,
    );
    const update = f.calls.find(([s]) => s.startsWith("UPDATE providers"));
    assert.equal(update[1][8], definition.parser_version);
    assert.equal(update[1].at(-2), now);
    assert.equal(update[1].at(-1), "source");
    assert.doesNotMatch(update[0], /\bstatus=|\bversion=\?|schedule_minutes=|timeout_ms=|terms_/);
  });
test("catalog upgrade failure rolls back before API can become ready", async () => {
  const f = fixture({ parser_version: "old" }, true);
  await assert.rejects(
    f.repository.syncCatalog({ definitions: [definition], now }),
    /write failed/,
  );
  assert.equal(
    f.calls.some(([s]) => s === "commit"),
    false,
  );
  assert.deepEqual(f.calls.slice(-2), [["rollback"], ["release"]]);
});
