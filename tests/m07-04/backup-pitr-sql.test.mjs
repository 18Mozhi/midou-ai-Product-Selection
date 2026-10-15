import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validatePitrSql, rewritePitrSql } from "../../scripts/lib/backup-pitr-sql.mjs";

const target = "product_scout_restore_m0704_0123456789ab";
const crc = (bytes) => {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
};
function event(type, schema = target, tableId = 1) {
  const length = type === 15 ? 120 : type === 19 ? 34 + Buffer.byteLength(schema) : 33;
  const b = Buffer.alloc(length);
  b[4] = type;
  b.writeUInt32LE(length, 9);
  if (type === 15) {
    b.writeUInt16LE(4, 19);
    b[75] = 19;
    b[94] = 8;
    b[length - 5] = 1;
  } else b.writeUIntLE(tableId, 19, 6);
  if (type === 19) {
    b[27] = Buffer.byteLength(schema);
    b.write(schema, 28);
  }
  b.writeUInt32LE(crc(b.subarray(0, -4)), length - 4);
  return b;
}
const binary = (...events) =>
  `BINLOG '\n${Buffer.concat([event(15), ...events]).toString("base64")}\n'/*!*/;`;
const valid = binary(event(19), event(30));
const rejects = (sql) =>
  assert.throws(() => validatePitrSql(sql, target), { code: "backup_pitr_sql_unsafe" });

test("PITR allows only the exact approved migration-ledger bootstrap and qualifies the isolated target", async () => {
  const deploy = await readFile("scripts/apply-deployment-migrations.mjs", "utf8");
  const ledger = deploy.match(
    /pool\.query\(`(CREATE TABLE IF NOT EXISTS schema_migrations [\s\S]+?)`\)/,
  )[1];
  const result = rewritePitrSql(
    `${ledger}; ${binary(event(19, "product_scout"), event(30))}`,
    "product_scout",
    target,
  );
  assert.ok(
    result.sql.startsWith(`CREATE TABLE IF NOT EXISTS \`${target}\`.\`schema_migrations\``),
  );
  assert.equal(validatePitrSql(result.sql, target).rowEvents, 1);
  for (const changed of [
    ledger.replace("VARCHAR(255)", "VARCHAR(180)"),
    ledger.replace("schema_migrations", "users"),
    ledger.replace("schema_migrations", "product_scout.schema_migrations"),
    ledger.replace("schema_migrations", "mysql.schema_migrations"),
    ledger + " AS SELECT 1",
    ledger.replace("schema_migrations", `\`${target}_other\`.\`schema_migrations\``),
  ])
    rejects(`${valid} ${changed};`);
  rejects(`${valid} BEGIN; SAVEPOINT sp; ${ledger}; ROLLBACK TO sp;`);
});

test("PITR supports bounded transaction-local savepoint replay with MySQL semantics", () => {
  const sql = `BEGIN; SAVEPOINT \`sp_1\`; SAVEPOINT second; ROLLBACK TO SAVEPOINT SP_1;
    SAVEPOINT second; RELEASE SAVEPOINT second; SAVEPOINT sp_1; ROLLBACK TO sp_1; ${valid} COMMIT;`;
  assert.equal(validatePitrSql(sql, target).rowEvents, 1);
  const source = `BEGIN; SAVEPOINT sp; ${binary(event(19, "product_scout"), event(30))} ROLLBACK TO sp; RELEASE SAVEPOINT sp; COMMIT;`;
  assert.match(rewritePitrSql(source, "product_scout", target).sql, /SAVEPOINT sp/);
});

test("PITR rejects unknown, expired, malformed and cross-transaction savepoints", () => {
  for (const control of [
    "SAVEPOINT sp",
    "ROLLBACK TO sp",
    "BEGIN; ROLLBACK TO missing",
    "BEGIN; SAVEPOINT a; SAVEPOINT b; ROLLBACK TO a; RELEASE SAVEPOINT b",
    "BEGIN; SAVEPOINT a; RELEASE SAVEPOINT a; ROLLBACK TO a",
    "BEGIN; SAVEPOINT a; COMMIT; BEGIN; ROLLBACK TO a",
    "BEGIN; SAVEPOINT a; ROLLBACK; BEGIN; ROLLBACK TO a",
    "BEGIN; SAVEPOINT `a.b`",
    "BEGIN; SAVEPOINT @x",
    "BEGIN; SAVEPOINT 'x'",
    `BEGIN; SAVEPOINT ${"x".repeat(65)}`,
    "BEGIN; SAVEPOINT sp extra",
    "BEGIN; SAVEPOINT sp; DELETE FROM product_scout.users",
  ])
    rejects(`${valid} ${control};`);
  rejects(
    `${valid} BEGIN; ${Array.from({ length: 1025 }, (_, i) => `SAVEPOINT sp_${i};`).join("")}`,
  );
});

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

test("PITR rewrites verified original maps and recalculates CRC without changing row events", () => {
  assert.equal(crc(Buffer.from("123456789")), 0xcbf43926);
  const row = event(31, "product_scout");
  const source = `SET TRANSACTION ISOLATION LEVEL READ COMMITTED/*!*/;\n${binary(event(19, "product_scout"), row)}`;
  const result = rewritePitrSql(source, "product_scout", target);
  assert.equal(validatePitrSql(result.sql, target).eventChecksumsVerified, true);
  const encoded = result.sql.match(/BINLOG '([^']+)'/)[1];
  const bytes = Buffer.from(encoded, "base64");
  assert.deepEqual(bytes.subarray(bytes.length - row.length), row);
  assert.equal(result.boundary.mapEvents, 1);
});
test("PITR rejects corrupt original checksums and stale rewritten checksums", () => {
  const original = event(19, "product_scout");
  original[original.length - 1] ^= 1;
  assert.throws(() => rewritePitrSql(binary(original, event(30)), "product_scout", target), {
    code: "backup_pitr_sql_unsafe",
  });
  const map = event(19);
  map[map.length - 1] ^= 1;
  rejects(binary(map, event(30)));
});

test("PITR accepts native separately padded event blocks without dropping subsequent rows", () => {
  const events = [event(15), event(19, "product_scout"), event(31)];
  const native = `BINLOG '\n${events.map((value) => value.toString("base64")).join("\n")}\n'/*!*/;`;
  const result = rewritePitrSql(native, "product_scout", target);
  assert.equal(result.boundary.rowEvents, 1);
  assert.equal(validatePitrSql(result.sql, target).eventChecksumsVerified, true);
});
