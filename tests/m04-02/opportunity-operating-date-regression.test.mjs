import test from "node:test";
import assert from "node:assert/strict";

test("MySQL DATE values keep their calendar day outside UTC", async () => {
  process.env.TZ = "Asia/Shanghai";
  const { mysqlDateOnly } = await import(
    "../../apps/api/dist/mysql-opportunity-repository.js"
  );
  const mysqlDate = new Date(2026, 7, 1);

  assert.equal(mysqlDate.toISOString().slice(0, 10), "2026-07-31");
  assert.equal(mysqlDateOnly(mysqlDate), "2026-08-01");
  assert.equal(mysqlDateOnly("2026-08-01"), "2026-08-01");
});
