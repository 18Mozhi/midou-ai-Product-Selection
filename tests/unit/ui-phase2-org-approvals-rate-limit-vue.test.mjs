import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { undoAuditPageDelta } from "../../scripts/lib/ui-phase2-audit-page-delta.mjs";
import {
  rateLimitBaseline,
  rateLimitParent,
  rateLimitCard,
  assertRateLimitPresentationDelta,
} from "../../scripts/lib/ui-phase2-rate-limit-retention.mjs";

const original = (file) =>
  execFileSync("git", ["show", `${rateLimitBaseline}:${file}`], { encoding: "utf8" });
const before = Object.fromEntries([rateLimitParent, rateLimitCard].map((f) => [f, original(f)]));
const after = Object.fromEntries(
  [rateLimitParent, rateLimitCard].map((f) => [
    f,
    f === rateLimitParent ? undoAuditPageDelta(readFileSync(f, "utf8")) : readFileSync(f, "utf8"),
  ]),
);
const output = "output/playwright/p34-rate-limit-vue";
const e = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
const hash = (data) => createHash("sha256").update(data).digest("hex");
test("P34 rate-limit only adds one scoped presentation branch and optional heading", () => {
  assert.doesNotThrow(() => assertRateLimitPresentationDelta(before, after));
  for (const mutation of [
    (s) => s.replaceAll("lastReadFailureStatus === 429", "lastReadFailureStatus === 403"),
    (s) => s.replaceAll("state === 'rate_limited' && !data", "state === 'rate_limited'"),
    (s) => s.replace('@reload="load()"', '@reload="load({ background: true })"'),
    (s) => s.replace('api("/org/admin/summary")', 'api("/org/admin/other")'),
  ])
    assert.throws(() =>
      assertRateLimitPresentationDelta(before, {
        ...after,
        [rateLimitParent]: mutation(after[rateLimitParent]),
      }),
    );
  assert.throws(() =>
    assertRateLimitPresentationDelta(before, {
      ...after,
      [rateLimitCard]: after[rateLimitCard].replace("组织后台暂不可用", "错误标题"),
    }),
  );
  for (const file of [
    "apps/web/src/api-client.ts",
    "apps/web/src/approval-read-failure.css",
    "apps/web/src/design/approval-read-failure-tokens.css",
  ])
    assert.equal(
      readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
      original(file).replaceAll("\r\n", "\n"),
    );
});

test("P34 live429 proof binds176 checks,52 unchanged images and8 new screenshots", () => {
  assert.equal(e.baselineCommit, rateLimitBaseline);
  assert.equal(e.checks.length, 176);
  assert.equal(e.checks.filter((c) => c.name.endsWith("pixels unchanged")).length, 52);
  assert.equal(e.screenshots.length, 8);
  assert.deepEqual([...new Set(e.checks.map((c) => c.width))], [390, 760, 761, 1440]);
  for (const [f, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(readFileSync(f, "utf8").replaceAll("\r\n", "\n")), sha, f);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  for (const width of [390, 760, 761, 1440]) {
    for (const target of ["summary", "approvals"])
      for (const name of ["original three limited GET attempts", "other read occurs once"])
        assert.ok(e.checks.some((c) => c.width === width && c.name === `${target}: ${name}`));
    for (const name of [
      "initial-500: pixels unchanged",
      "background-429: pixels unchanged",
      "members-429: pixels unchanged",
      "workspaces-429: pixels unchanged",
    ])
      assert.ok(e.checks.some((c) => c.width === width && c.name === name));
  }
  for (const width of [390, 760])
    for (const target of ["summary", "approvals"])
      for (const name of [
        "rate limit heading",
        "one visible retry",
        "real actionable notice retained",
        "real request ID",
        "retry reads both once",
        "query preserved after recovery",
      ])
        assert.ok(e.checks.some((c) => c.width === width && c.name === `${target}: ${name}`));
});

test("P34 original500 pictures and evidence remain byte-identical at the historical snapshot", () => {
  const oldFolder = "output/playwright/p34-first-failure-vue",
    file = `${oldFolder}/evidence.json`;
  assert.equal(
    readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
    original(file).replaceAll("\r\n", "\n"),
  );
  const old = JSON.parse(original(file));
  for (const s of old.screenshots)
    assert.equal(hash(readFileSync(`${oldFolder}/${s.file}`)), s.sha256);
});
