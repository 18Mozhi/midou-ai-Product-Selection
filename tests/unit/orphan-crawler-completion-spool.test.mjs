import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { auditCrawlerCompletionSpool } from "../../scripts/verify-orphan-crawler-completion-spool.mjs";

const orphan = "00000000-0000-4000-8000-000000000001";
const unrelated = "00000000-0000-4000-8000-000000000002";
const job = "00000000-0000-4000-8000-000000000003";
const receipt = (run_id) =>
  JSON.stringify({
    schema_version: 1,
    path: `/api/v1/internal/crawler-runtime/jobs/${job}/complete`,
    body: { run_id, lease_token: "fixture-secret", result: { body: "fixture-evidence" } },
  });

test("empty spool does not invent a result or mutate the missing quarantine directory", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "scoutops-spool-audit-")));
  try {
    assert.deepEqual(await auditCrawlerCompletionSpool(root, [orphan]), {
      orphan_rows: 1,
      pending: 0,
      quarantined: 0,
      opaque_receipts: 0,
      matched_orphans: 0,
      partial_temp: 0,
      status: "no_matching_completion_receipt_observed",
    });
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("matching by exact run, pending and quarantine duplicate count once without exposing input", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "scoutops-spool-audit-")));
  try {
    await mkdir(join(root, "quarantine"));
    await writeFile(join(root, "duplicate.json"), receipt(orphan));
    await writeFile(join(root, "unrelated.json"), receipt(unrelated));
    const match = join(root, "quarantine", "duplicate.json");
    await writeFile(match, receipt(orphan));
    const report = await auditCrawlerCompletionSpool(root, [orphan]);
    assert.equal(report.pending, 2);
    assert.equal(report.quarantined, 1);
    assert.equal(report.matched_orphans, 1);
    assert.equal(report.status, "matching_completion_receipt_present");
    assert.doesNotMatch(JSON.stringify(report), /fixture-secret|fixture-evidence|00000000/);
    assert.equal(await readFile(match, "utf8"), receipt(orphan));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("malformed and unfinished receipts never yield a no-match conclusion", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "scoutops-spool-audit-")));
  try {
    await writeFile(join(root, "incomplete.tmp"), "pending");
    await writeFile(join(root, "malformed.json"), "{}");
    const report = await auditCrawlerCompletionSpool(root, [orphan]);
    assert.equal(report.partial_temp, 1);
    assert.equal(report.opaque_receipts, 1);
    assert.equal(report.status, "inconclusive");
    await assert.rejects(auditCrawlerCompletionSpool(root, [orphan, orphan]), /invalid_input/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
