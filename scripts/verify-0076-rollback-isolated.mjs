import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { createClient } from "redis";
import { splitSqlStatements } from "./apply-deployment-migrations.mjs";

const env = process.env;
const database = env.DB_NAME;
const safePort = (value, standard) =>
  /^\d{4,5}$/.test(value ?? "") &&
  Number(value) > 1023 &&
  Number(value) < 65536 &&
  Number(value) !== standard;
assert.equal(env.DB_HOST, "127.0.0.1", "requires explicitly isolated loopback MySQL");
assert.equal(env.DB_USER, "product_scout", "must use the non-root business account");
assert.ok(env.DB_PASSWORD, "missing isolated MySQL password");
assert.match(
  database ?? "",
  /^scoutops_0076_probe_[a-z0-9_]{1,24}$/,
  "requires a dedicated empty fixture schema",
);
assert.ok(safePort(env.DB_PORT, 3306), "requires a dedicated non-default MySQL port");
assert.equal(env.REDIS_HOST, "127.0.0.1", "requires explicitly isolated loopback Redis");
assert.ok(safePort(env.REDIS_PORT, 6379), "requires a dedicated non-default Redis port");

const options = {
  host: "127.0.0.1",
  port: Number(env.DB_PORT),
  database,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  charset: "utf8mb4",
  connectTimeout: 4000,
  dateStrings: true,
};
const redis = createClient({
  socket: {
    host: "127.0.0.1",
    port: Number(env.REDIS_PORT),
    connectTimeout: 4000,
    reconnectStrategy: false,
  },
  ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
});
redis.on("error", () => {});
const migration = (name) =>
  readFile(new URL(`../database/migrations/${name}.sql`, import.meta.url), "utf8");
const [base, previous, up, down] = await Promise.all([
  migration("0016e_collection_tasks_m03_05.up"),
  migration("0049_credential_renewal_auto_replay.up"),
  migration("0076_collection_backlog_cancellation.up"),
  migration("0076_collection_backlog_cancellation.down"),
]);
const execute = async (connection, source) => {
  for (const statement of splitSqlStatements(source)) await connection.query(statement);
};
const connection = await mysql.createConnection(options);
const created = [];
const key = `scoutops:0076:verify:${randomUUID()}`;
const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const one = async (sql) => (await connection.query(sql))[0][0];
const definition = async () => (await one("SHOW CREATE TABLE collection_tasks"))["Create Table"];
const rows = async () => ({
  tasks: (
    await connection.query("SELECT *, status+0 AS status_ordinal FROM collection_tasks ORDER BY id")
  )[0],
  audit: (await connection.query("SELECT * FROM collection_task_events ORDER BY id"))[0],
});
const setStatus = (id, status) =>
  connection.execute("UPDATE collection_tasks SET status=? WHERE id=?", [status, id]);
const phases = [];
let reserved = false;
try {
  const identity = await one(
    "SELECT VERSION() AS version, @@character_set_server AS charset, DATABASE() AS db",
  );
  assert.match(identity.version, /^5\.7\./);
  assert.equal(identity.charset, "utf8mb4");
  assert.equal(identity.db, database);
  assert.equal((await connection.query("SHOW TABLES"))[0].length, 0, "fixture schema is not empty");
  await redis.connect();
  assert.equal(await redis.ping(), "PONG");
  assert.equal(await redis.set(key, "untouched", { NX: true, EX: 180 }), "OK");
  reserved = true;
  const scope = ["organizations", "workspaces", "users"];
  const ids = scope.map(() => randomUUID());
  for (const [index, table] of scope.entries()) {
    await connection.query(
      `CREATE TABLE \`${table}\` (id CHAR(36) CHARACTER SET ascii PRIMARY KEY) ENGINE=InnoDB`,
    );
    created.push(table);
    await connection.execute(`INSERT INTO \`${table}\` (id) VALUES (?)`, [ids[index]]);
  }
  for (const table of ["collection_tasks", "collection_task_events"]) {
    const ddl = splitSqlStatements(base).find((statement) =>
      statement.startsWith(`CREATE TABLE \`${table}\``),
    );
    assert.ok(ddl, `real source DDL missing: ${table}`);
    await connection.query(ddl);
    created.push(table);
  }
  await execute(connection, previous);
  const taskIds = [randomUUID(), randomUUID()];
  for (const [index, status] of ["queued", "succeeded"].entries()) {
    await connection.execute(
      "INSERT INTO collection_tasks(id,organization_id,workspace_id,status,priority,scheduled_at,available_at,missing_fields_json,request_id,trace_id,version,created_by,created_at,updated_at) VALUES(?,?,?,?,'normal',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'[]','probe','probe',1,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
      [taskIds[index], ids[0], ids[1], status, ids[2]],
    );
  }
  const original = { definition: await definition(), rows: await rows() };
  await execute(connection, up);
  assert.match(await definition(), /'automatically_replayed','cancelled'/);
  const exerciseDown = async () => {
    const dedicated = await mysql.createConnection(options);
    try {
      // Prove safety even when the caller starts without strict SQL mode.
      await dedicated.query("SET SESSION sql_mode=''");
      await execute(dedicated, down);
      assert.equal((await dedicated.query("SELECT @@SESSION.sql_mode AS mode"))[0][0].mode, "");
    } finally {
      await dedicated.end();
    }
  };
  await exerciseDown();
  assert.deepEqual({ definition: await definition(), rows: await rows() }, original);
  assert.equal(await redis.get(key), "untouched");
  phases.push({
    scenario: "no_cancellation",
    result: "rollback_applied",
    preservedRowsSha256: sha(original.rows),
  });
  await execute(connection, up);
  const reject = async (scenario) => {
    const before = { definition: await definition(), rows: await rows() };
    await assert.rejects(
      exerciseDown(),
      (error) => error?.errno === 1062 && error?.code === "ER_DUP_ENTRY",
    );
    assert.deepEqual({ definition: await definition(), rows: await rows() }, before);
    assert.equal(await redis.get(key), "untouched");
    phases.push({
      scenario,
      result: "refused_without_changes",
      mysqlError: 1062,
      snapshotSha256: sha(before),
    });
  };
  await setStatus(taskIds[0], "cancelled");
  await reject("cancelled_status_without_receipt");
  await setStatus(taskIds[0], "queued");
  await connection.execute(
    "INSERT INTO collection_task_events(id,task_id,organization_id,workspace_id,event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES(?,?,?,?,'collection.task.cancelled','queued','cancelled','system','probe','probe','probe','{}',UTC_TIMESTAMP(3))",
    [randomUUID(), taskIds[0], ids[0], ids[1]],
  );
  await reject("receipt_without_cancelled_status");
  await setStatus(taskIds[0], "cancelled");
  await reject("cancelled_status_and_receipt");
  console.log(JSON.stringify({ mysql: identity.version, redis: "PONG", phases }, null, 2));
} finally {
  try {
    for (const table of created.reverse()) await connection.query(`DROP TABLE \`${table}\``);
  } finally {
    await connection.end();
    if (reserved) assert.equal(await redis.del(key), 1, "fixture Redis key cleanup failed");
    if (redis.isOpen) await redis.quit();
  }
}
