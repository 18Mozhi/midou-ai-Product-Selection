import { readFile } from "node:fs/promises";
import { approvalsParentBase } from "./lib/ui-phase2-org-approvals-parent-current-driver.mjs";
import { readFeedbackVueDriver } from "./lib/ui-phase2-org-approvals-read-feedback-driver.mjs";

try {
  await import(
    "data:text/javascript;base64," +
      Buffer.from(readFeedbackVueDriver(await readFile(approvalsParentBase, "utf8"))).toString(
        "base64",
      )
  );
} catch (error) {
  console.error(
    String(error?.stack ?? error).replaceAll(
      /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
      "p34-read-feedback-vue-driver",
    ),
  );
  process.exitCode = 1;
}
