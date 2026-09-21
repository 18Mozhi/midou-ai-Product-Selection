import { readFile } from "node:fs/promises";
import {
  accountPairLifecycleDriver,
  originalAccountLifecycleDriver,
} from "./lib/ui-phase2-account-pair-lifecycle-driver.mjs";

const source = await readFile(originalAccountLifecycleDriver, "utf8");
// In-memory module: no scratch script or second copy of the test flow on disk.
try {
  await import(
    "data:text/javascript;base64," +
      Buffer.from(accountPairLifecycleDriver(source)).toString("base64")
  );
} catch (error) {
  // Preserve diagnostics and line numbers without printing the full generated module URL.
  console.error(
    String(error?.stack ?? error).replaceAll(
      /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
      "account-pair-lifecycle-composed",
    ),
  );
  process.exitCode = 1;
}
