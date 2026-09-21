import assert from "node:assert/strict";
import test from "node:test";
import {
  batchCommandFiles,
  runCommandFileBatches,
} from "../../scripts/lib/code-style-command-batches.mjs";

const command = "D:/Program Files/Node/node.exe";
const prefix = ["D:/项目/node_modules/prettier/bin/prettier.cjs", "--check"];
const files = Array.from(
  { length: 900 },
  (_, index) => `apps/web/src/components/目录 with space/Component-${index}.vue`,
);
test("formatter batches every file once in original order within the escaped command budget", () => {
  const batches = batchCommandFiles(command, prefix, files);
  assert.ok(batches.length > 1);
  assert.deepEqual(batches.flat(), files);
  for (const batch of batches) {
    assert.ok(batch.length > 0);
    assert.ok(
      [command, ...prefix, ...batch].reduce((total, arg) => total + arg.length * 2 + 3, 0) <=
        24_000,
    );
  }
  assert.deepEqual(batchCommandFiles(command, prefix, []), []);
});
test("formatter rejects invalid budgets and oversized arguments without losing files", () => {
  assert.throws(() => batchCommandFiles(command, prefix, files, 0), /Invalid/);
  assert.throws(() => batchCommandFiles(command, prefix, files, 1), /prefix exceeds/);
  assert.throws(() => batchCommandFiles(command, prefix, ["x".repeat(24_000)]), /Single/);
  assert.throws(() => batchCommandFiles(command, prefix, [null]), /must be strings/);
});
test("all batches run after a formatting violation and the gate stays failed", () => {
  const visited = [],
    results = [];
  const exit = runCommandFileBatches(
    command,
    prefix,
    files,
    (executable, args) => {
      assert.equal(executable, command);
      assert.deepEqual(args.slice(0, prefix.length), prefix);
      const status = visited.length === 0 ? 1 : 0;
      visited.push(...args.slice(prefix.length));
      return { status };
    },
    (result) => results.push(result),
  );
  assert.equal(exit, 1);
  assert.deepEqual(visited, files);
  assert.equal(results.length, batchCommandFiles(command, prefix, files).length);
});
test("spawn errors are delivered to diagnostics and cannot be treated as success", () => {
  const error = { code: "ENAMETOOLONG" },
    result = { status: null, error },
    seen = [];
  assert.equal(
    runCommandFileBatches(
      command,
      prefix,
      [files[0]],
      () => result,
      (r) => seen.push(r),
    ),
    1,
  );
  assert.deepEqual(seen, [result]);
  assert.equal(
    runCommandFileBatches(
      command,
      prefix,
      files,
      () => ({ status: 0 }),
      () => {},
    ),
    0,
  );
});
