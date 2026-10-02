import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

test("live verification cleanup never rewrites organizations by broad slug matching", async () => {
  const files = (await readdir("scripts"))
    .filter((name) => name.startsWith("verify-") && name.endsWith("-live.mjs"))
    .sort();

  assert.ok(files.length > 0, "live verification scripts must remain discoverable");
  for (const file of files) {
    const source = await readFile(`scripts/${file}`, "utf8");
    assert.doesNotMatch(
      source,
      /UPDATE\s+organizations\s+SET\s+default_workspace_id\s*=\s*NULL\s+WHERE\s+LOWER\s*\(\s*slug\s*\)/i,
      `${file} must scope organization cleanup to the exact generated IDs`,
    );
  }
});
