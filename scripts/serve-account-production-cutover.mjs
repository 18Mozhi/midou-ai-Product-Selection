import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import {
  assertAccountProductionFence,
  assertAccountProductionTarget,
} from "./lib/account-production-fence.mjs";
import { runAccountProductionCutover } from "./run-account-production-cutover.mjs";

const lock = "scoutops:account-retirement:production";

// The deployment controller launches exactly one child after stopping BaoTa
// writers. Hold its database fence through review, migration and file install.
export async function serveAccountCutover(
  connection,
  commands,
  send,
  run = runAccountProductionCutover,
) {
  await assertAccountProductionTarget(connection);
  const [[lease]] = await connection.query("SELECT GET_LOCK(?,0) acquired", [lock]);
  if (Number(lease?.acquired) !== 1) throw new Error("account_cutover_session_lock_busy");
  const fence = () =>
    assertAccountProductionFence(connection, "account_cutover_session_not_fenced");
  try {
    await fence();
    await send({ status: "fenced" });
    let active = null;
    let applied = false;
    for await (const command of commands) {
      if (command?.action === "release") return;
      if (command?.action === "assert_fence") {
        await fence();
        await send({ status: "fenced" });
      } else if (command?.action === "prepare" && active === null && !applied) {
        const expectedPlanSha256 = command.plan_sha256;
        const result = await run(connection, { phase: "prepare", expectedPlanSha256 });
        if (result.status !== "review_required")
          throw new Error("account_cutover_session_prepare_failed");
        active = {
          expectedPlanSha256,
          runId: result.run_id,
          expectedReviewSha256: result.review.review_sha256,
        };
        await send({ status: result.status, run_id: result.run_id, review: result.review });
      } else if (
        command?.action === "apply" &&
        active &&
        !applied &&
        command.run_id === active.runId &&
        command.review_sha256 === active.expectedReviewSha256
      ) {
        const result = await run(connection, { phase: "apply", ...active });
        if (result.status !== "database_verified")
          throw new Error("account_cutover_session_apply_failed");
        applied = true;
        await send({ status: result.status, run_id: result.run_id, forward: result.forward });
      } else {
        throw new Error("account_cutover_session_unexpected_command");
      }
    }
    throw new Error("account_cutover_session_closed_without_release");
  } finally {
    await connection.query("SELECT RELEASE_LOCK(?) released", [lock]);
  }
}

async function main() {
  const env = process.env;
  if (
    process.argv.slice(2).join(" ") !== "--fenced-stdio" ||
    env.DB_HOST !== "127.0.0.1" ||
    env.DB_NAME !== "product_scout" ||
    env.DB_USER !== "product_scout" ||
    !env.DB_PASSWORD ||
    !/^\d{1,5}$/.test(env.DB_PORT ?? "")
  )
    throw new Error("account_cutover_session_invalid_target");
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: "utf8mb4",
    connectTimeout: 8000,
    multipleStatements: false,
  });
  const lines = createInterface({ input: process.stdin, terminal: false });
  async function* messages() {
    for await (const line of lines) {
      if (line.length > 4096) throw new Error("account_cutover_session_message_too_large");
      yield JSON.parse(line);
    }
  }
  try {
    await serveAccountCutover(connection, messages(), (value) => {
      process.stdout.write(`${JSON.stringify(value)}\n`);
    });
  } finally {
    lines.close();
    process.stdin.pause();
    await connection.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    // Never send SQL clauses, secrets, stack traces or business data on failure.
    const reason = error?.code ?? error?.message;
    process.stderr.write(
      `${/^(?:account_[a-z0-9_]+|ER_[A-Z0-9_]+)$/.test(reason) ? reason : "account_cutover_session_failed"}\n`,
    );
    process.exitCode = 1;
  }
}
