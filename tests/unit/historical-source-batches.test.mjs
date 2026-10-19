import assert from "node:assert/strict";
import test from "node:test";
import { readCommittedSourceBatches } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";

const commits = Array.from({ length: 5 }, (_, i) => i.toString(16).padStart(40, "0"));
test("all historical revisions remain verified in ordered bounded batches", () => {
  const calls = [];
  const result = readCommittedSourceBatches(
    "source.vue",
    commits,
    (command, args, options) => {
      calls.push(options);
      assert.equal(command, "git");
      assert.equal(args[0], "cat-file");
      assert.equal(options.maxBuffer, 64 * 1024 * 1024);
      const rows = options.input.trim().split("\n");
      const metadata = args[1] === "--batch-check";
      if (!metadata) assert.ok(rows.length <= 2);
      return Buffer.concat(
        rows.map((row) => {
          const commit = row.split(":")[0];
          const body = Buffer.from(commit + "\r\n", "utf8");
          if (metadata) return Buffer.from(`${commit} blob ${body.length}\n`);
          return Buffer.concat([
            Buffer.from(`${commit} blob ${body.length}\n`),
            body,
            Buffer.from("\n"),
          ]);
        }),
      );
    },
    200,
  );
  assert.deepEqual(
    calls.map((c) => c.input.trim().split("\n").length),
    [5, 2, 2, 1],
  );
  assert.deepEqual(
    result,
    commits.map((c) => c + "\n"),
  );
  assert.deepEqual(
    readCommittedSourceBatches("empty", [], () => assert.fail("empty history")),
    [],
  );
});

test("missing revisions stay missing and truncated or trailing bytes fail closed", () => {
  assert.deepEqual(
    readCommittedSourceBatches("missing", [commits[0]], () =>
      Buffer.from(`${commits[0]}:missing missing\n`),
    ),
    [],
  );
  for (const [size, bytes] of [
    [4, "truncated"],
    [4, `${commits[0]} blob 4\nno`],
    [1, `${commits[0]} blob 1\nx\nextra`],
  ]) {
    assert.throws(() =>
      readCommittedSourceBatches("source.vue", [commits[0]], (_command, args) =>
        Buffer.from(args[1] === "--batch-check" ? `${commits[0]} blob ${size}\n` : bytes),
      ),
    );
  }
  for (const metadata of ["bad", `${commits[0]} blob 999999999\n`, ""]) {
    assert.throws(() =>
      readCommittedSourceBatches("source.vue", [commits[0]], () => Buffer.from(metadata)),
    );
  }
  const injected = new Error("ENOBUFS");
  assert.throws(
    () =>
      readCommittedSourceBatches("source.vue", [commits[0]], () => {
        throw injected;
      }),
    (e) => e === injected,
  );
});
