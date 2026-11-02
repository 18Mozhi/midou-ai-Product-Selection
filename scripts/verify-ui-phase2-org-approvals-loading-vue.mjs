import { assertLegacyCssPreviewReadOnly } from "./lib/retired-runtime-css.mjs";
assertLegacyCssPreviewReadOnly();
import { readArchivedApprovalsParent } from "./lib/ui-phase2-approvals-parent-baseline.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { loadingVueDriver, loadingOutput } from "./lib/ui-phase2-org-approvals-loading-driver.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.every((arg) => ["--capture", "--smoke"].includes(arg)) &&
    !(args.includes("--capture") && args.includes("--smoke")),
);
if (args.includes("--capture")) await mkdir(loadingOutput);

try {
  await import(
    "data:text/javascript;base64," +
      Buffer.from(loadingVueDriver(readArchivedApprovalsParent())).toString("base64")
  );
} catch (error) {
  console.error(
    String(error?.stack ?? error).replaceAll(
      /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
      "p34-loading-vue-driver",
    ),
  );
  process.exitCode = 1;
}
