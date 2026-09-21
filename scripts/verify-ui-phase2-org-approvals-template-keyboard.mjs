import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTemplateKeyboardRunner } from "./lib/ui-phase2-org-approvals-template-keyboard.mjs";

assert.ok(
  process.argv.slice(2).length <= 1 &&
    process.argv.slice(2).every((arg) => ["--smoke", "--capture"].includes(arg)),
);
const source = await readFile("scripts/verify-ui-phase2-org-approvals-vue-c.mjs", "utf8");
const runner = buildTemplateKeyboardRunner(source).replace(
  /from "([^"\n]+)"/g,
  (_match, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(
    String(error.stack ?? error).replace(
      /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
      "<P34-template-keyboard-App-driver>",
    ),
  );
  process.exitCode = 1;
}
