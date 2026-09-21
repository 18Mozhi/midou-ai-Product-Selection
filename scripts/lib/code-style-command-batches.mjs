import assert from "node:assert/strict";

// Conservative UTF-16 budget including worst-case quoting/escaping on Windows.
// Keep every file in order; batching must not narrow the formatting gate.
export function batchCommandFiles(command, prefix, files, limit = 24_000) {
  assert.ok(Number.isInteger(limit) && limit > 0, "Invalid formatter command budget");
  const cost = (value) => {
    assert.equal(typeof value, "string", "Command arguments must be strings");
    return value.length * 2 + 3;
  };
  const fixed = [command, ...prefix].reduce((total, arg) => total + cost(arg), 0);
  assert.ok(fixed < limit, "Formatter prefix exceeds command budget");
  const batches = [];
  let batch = [],
    used = fixed;
  for (const file of files) {
    const size = cost(file);
    assert.ok(fixed + size <= limit, "Single formatter file exceeds command budget");
    if (used + size > limit) {
      batches.push(batch);
      batch = [];
      used = fixed;
    }
    batch.push(file);
    used += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export function runCommandFileBatches(command, prefix, files, run, onResult) {
  let exit = 0;
  for (const batch of batchCommandFiles(command, prefix, files)) {
    const result = run(command, [...prefix, ...batch]);
    onResult(result);
    if (result.error || result.status !== 0) exit ||= result.status || 1;
  }
  return exit;
}
