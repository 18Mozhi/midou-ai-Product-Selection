import test from "node:test";
import assert from "node:assert/strict";
import { validatePitrSql } from "../../scripts/lib/backup-pitr-sql.mjs";

const target = "product_scout_restore_m0704_0123456789ab";
function event(type, schema = target, tableId = 1) {
  const length = type === 19 ? 30 + Buffer.byteLength(schema) : 29;
  const b = Buffer.alloc(length);
  b[4] = type;
  b.writeUInt32LE(length, 9);
  b.writeUIntLE(tableId, 19, 6);
  if (type === 19) {
    b[27] = Buffer.byteLength(schema);
    b.write(schema, 28);
  }
  return b;
}
const binary = (...events) => `BINLOG '\n${Buffer.concat(events).toString("base64")}\n'/*!*/;`;
const valid = binary(event(19), event(30));
const rejects = (sql) =>
  assert.throws(() => validatePitrSql(sql, target), { code: "backup_pitr_sql_unsafe" });

test("PITR accepts only row events mapped to the exact isolated database", () => {
  const sql = `/*!50530 SET @@SESSION.PSEUDO_SLAVE_MODE=1*/;\nDELIMITER /*!*/;\n# comment\nSET @@SESSION.SQL_LOG_BIN=0/*!*/;\nBEGIN/*!*/;\n${valid}\nCOMMIT/*!*/;\nDELIMITER ;\n`;
  assert.equal(validatePitrSql(sql, target).rowEvents, 1);
});
test("PITR rejects table maps for production and unrelated databases", () => {
  for (const schema of ["product_scout", "mysql", `${target}_other`])
    rejects(binary(event(19, schema), event(30)));
});
test("PITR rejects raw DML, DDL, privilege changes and arbitrary session expressions", () => {
  for (const sql of [
    "DROP DATABASE product_scout",
    "DELETE FROM product_scout.users",
    "CREATE USER attacker",
    "SET @@GLOBAL.SQL_LOG_BIN=0",
    "SET @x=(SELECT 1)",
    "CALL dangerous()",
    "USE `product_scout`",
    "/*!50000 DROP DATABASE product_scout*/",
    "SET @@SESSION.SQL_MODE='x'; DROP DATABASE product_scout",
  ])
    rejects(`${valid}\n${sql};`);
});
test("PITR rejects unknown events, unmapped rows and truncated events", () => {
  rejects(binary(event(30)));
  rejects(binary(event(19), event(2)));
  rejects(binary(event(19), event(30, target, 2)));
  rejects(binary(event(19), event(30).subarray(0, 20)));
  rejects("SET SQL_LOG_BIN=0;");
});
test("PITR preserves fail closed behavior for malformed encodings and targets", () => {
  rejects("BINLOG 'a===';");
  assert.throws(() => validatePitrSql(valid, "product_scout"), { code: "backup_pitr_sql_unsafe" });
});

test("PITR rejects comment and string tricks rather than erasing executable statements", () => {
  for (const sql of [
    "SET TIME_ZONE='/*'; DROP DATABASE product_scout; SET TIME_ZONE='*/';",
    "SET TIME_ZONE='#'; DROP DATABASE product_scout;",
    "/*!50000 SET SQL_MODE='*/'; DROP DATABASE product_scout;",
    "SET SQL_MODE='a\\'; DROP DATABASE product_scout;",
  ])
    rejects(`${valid}\n${sql}`);
});
