import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBundle, verifyBundle } from "../../scripts/backup-recovery.mjs";

test("backup verification uses and cleans the caller-owned temporary root", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-controlled-backup-test-"));
  try {
    const source = join(root, "fixture.txt"),
      bundle = join(root, "fixture.scoutbackup");
    const secret = "test-only-controlled-backup-key-1234567890";
    await writeFile(source, "controlled temporary verification fixture");
    await createBundle({ source, output: bundle, secret });
    await verifyBundle({ bundle, secret, tempRoot: root });
    assert.deepEqual((await readdir(root)).sort(), ["fixture.scoutbackup", "fixture.txt"]);
    await assert.rejects(verifyBundle({ bundle, secret: `${secret}-wrong`, tempRoot: root }));
    assert.deepEqual((await readdir(root)).sort(), ["fixture.scoutbackup", "fixture.txt"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
