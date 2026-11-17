import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import {
  applyAccountProductionEvidenceSuffix,
  assertAccountEvidencePristine,
  assertAccountEvidenceSuffixPrefix,
  verifyAccountEvidenceHistoryGuards,
} from "./apply-account-production-forward.mjs";
import {
  assertAccountProductionFence,
  assertAccountProductionTarget,
} from "./lib/account-production-fence.mjs";
import { assertStandaloneCrawlerCutoverPreflight } from "./lib/account-crawler-cutover-preflight.mjs";
import { compileAccountRetirementProduction } from "./plan-account-retirement-production.mjs";

const lock = "scoutops:account-retirement:production";

export async function serveEvidenceSuffix(db, commands, send, planSha, expectedCount) {
  const compiled = await compileAccountRetirementProduction(planSha);
  await assertAccountProductionTarget(db);
  const [[lease]] = await db.query("SELECT GET_LOCK(?,0) acquired", [lock]);
  if (Number(lease?.acquired) !== 1) throw new Error("account_release_evidence_suffix_lock_busy");
  const fence = () =>
    assertAccountProductionFence(db, "account_release_evidence_suffix_fence_lost");
  const verify = async (activeRun) => {
    await fence();
    await assertAccountEvidenceSuffixPrefix(db, compiled.plan);
    await assertAccountEvidencePristine(db);
    await assertStandaloneCrawlerCutoverPreflight(db);
    const [seals] = await db.query(
      "SELECT c.source_run_id,CAST(c.source_record_count AS CHAR) records " +
        "FROM account_ownership_cutover c JOIN account_retirement_runs r " +
        "ON r.id=c.source_run_id AND r.primary_account_id=c.primary_account_id " +
        "WHERE c.slot='current' AND c.contract_version=25",
    );
    if (
      seals.length !== 1 ||
      seals[0].records !== expectedCount ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(seals[0].source_run_id) ||
      (activeRun && seals[0].source_run_id !== activeRun)
    )
      throw new Error("account_release_evidence_suffix_seal_changed");
    await verifyAccountEvidenceHistoryGuards(db, compiled.forward[110]);
    await fence();
    return seals[0].source_run_id;
  };
  try {
    await fence();
    await send({ status: "fenced" });
    let run = null,
      applied = false;
    for await (const cmd of commands) {
      if (!cmd || Object.keys(cmd).length !== 1)
        throw new Error("account_release_evidence_suffix_invalid_command");
      if (cmd.action === "verify_suffix" && run === null) {
        run = await verify(null);
        await send({ status: "suffix_verified" });
      } else if (cmd.action === "apply_suffix" && run !== null && !applied) {
        await fence();
        const forward = await applyAccountProductionEvidenceSuffix(db, planSha, run);
        applied = true;
        await send({ status: "database_verified", forward });
      } else if (cmd.action === "assert_fence" && applied) {
        await fence();
        await send({ status: "fenced" });
      } else if (cmd.action === "release") return;
      else throw new Error("account_release_evidence_suffix_invalid_command");
    }
    throw new Error("account_release_evidence_suffix_session_closed");
  } finally {
    await db.query("SELECT RELEASE_LOCK(?)", [lock]);
  }
}

async function main() {
  const [mode, plan, records] = process.argv.slice(2);
  const e = process.env;
  if (
    process.argv.length !== 5 ||
    mode !== "--fenced-evidence-suffix" ||
    !/^[a-f0-9]{64}$/.test(plan) ||
    !/^[1-9][0-9]{0,19}$/.test(records) ||
    e.DB_NAME !== "product_scout" ||
    e.DB_HOST !== "127.0.0.1" ||
    e.DB_USER !== "product_scout" ||
    !e.DB_PASSWORD ||
    !/^\d{1,5}$/.test(e.DB_PORT ?? "")
  )
    throw new Error("account_release_evidence_suffix_invalid_target");
  const db = await mysql.createConnection({
    host: e.DB_HOST,
    port: Number(e.DB_PORT),
    database: e.DB_NAME,
    user: e.DB_USER,
    password: e.DB_PASSWORD,
    charset: "utf8mb4",
    connectTimeout: 8000,
  });
  const lines = createInterface({ input: process.stdin, terminal: false });
  try {
    await serveEvidenceSuffix(
      db,
      (async function* () {
        for await (const line of lines) {
          if (line.length > 256) throw new Error("account_release_evidence_suffix_invalid_command");
          yield JSON.parse(line);
        }
      })(),
      (result) => process.stdout.write(JSON.stringify(result) + "\n"),
      plan,
      records,
    );
  } finally {
    lines.close();
    process.stdin.pause();
    await db.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    await main();
  } catch (error) {
    const reason = String(error?.code ?? error?.message ?? "").split(":", 1)[0];
    process.stderr.write(
      (/^(?:(?:account_|mysql57_|quote_|trend_|competitor_|migration_)[a-z0-9_]+|ER_[A-Z0-9_]+|ERR_[A-Z0-9_]+)$/.test(
        reason,
      )
        ? reason
        : "account_release_evidence_suffix_failed") + "\n",
    );
    process.exitCode = 1;
  }
}
