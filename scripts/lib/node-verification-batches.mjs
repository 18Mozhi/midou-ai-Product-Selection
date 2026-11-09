import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

export const nodeVerificationBatchTimeoutMs = 900_000;
export const nodeVerificationBatchFileLimit = 36;
export const nodeVerificationCommandLengthLimit = 12_000;

/** Partition in input order. Never omit or deduplicate a requested test. */
export function nodeVerificationBatches(executable, prefix, files) {
  const encodedLength = (argument) => JSON.stringify(argument).length + 1;
  const fixed = [executable, ...prefix].reduce((sum, argument) => sum + encodedLength(argument), 0);
  assert.ok(fixed < nodeVerificationCommandLengthLimit, "Node test prefix exceeds command budget");
  const batches = [];
  let batch = [];
  let length = fixed;
  for (const file of files) {
    const size = encodedLength(file);
    assert.ok(
      fixed + size <= nodeVerificationCommandLengthLimit,
      `Node test path exceeds command budget: ${file}`,
    );
    if (
      batch.length >= nodeVerificationBatchFileLimit ||
      length + size > nodeVerificationCommandLengthLimit
    ) {
      batches.push([...prefix, ...batch]);
      batch = [];
      length = fixed;
    }
    batch.push(file);
    length += size;
  }
  if (batch.length) batches.push([...prefix, ...batch]);
  return batches;
}

export async function releaseMatrixNodeBatches(root) {
  const files = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await collect(path);
      else if (entry.name.endsWith(".test.mjs"))
        files.push(relative(root, path).replaceAll("\\", "/"));
    }
  }
  await collect(resolve(root, "tests"));
  files.sort();
  const stripTypes = "--experimental-strip-types";
  const prefix = process.allowedNodeEnvironmentFlags.has(stripTypes)
    ? [stripTypes, "--test", "--test-concurrency=4"]
    : [
        "--loader",
        resolve(root, "scripts/lib/typescript-test-loader.mjs"),
        "--test",
        "--test-concurrency=4",
      ];
  return { files, prefix, batches: nodeVerificationBatches(process.execPath, prefix, files) };
}
