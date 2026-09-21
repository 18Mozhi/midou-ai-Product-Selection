import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildApprovalsAppPaginationRunner } from "./lib/ui-phase2-org-approvals-app-pagination.mjs";

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every((arg) => ["--smoke", "--capture"].includes(arg)));
const source = await readFile("scripts/verify-ui-phase2-org-approvals-vue-c.mjs", "utf8");
const runner = buildApprovalsAppPaginationRunner(source).replace(
  /from "([^"\n]+)"/g,
  (_match, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  // Preserve the failure and exit status without printing an entire in-memory driver in each frame.
  console.error(
    String(error.stack ?? error).replace(
      /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
      "<P34-original-App-driver-with-pagination-checks>",
    ),
  );
  process.exitCode = 1;
}
