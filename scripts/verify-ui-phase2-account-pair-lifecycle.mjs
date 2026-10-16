import {
  accountPairLifecycleDriver,
  loadOriginalAccountLifecycleSource,
  pairLifecycleOutput,
} from "./lib/ui-phase2-account-pair-lifecycle-driver.mjs";
import { existsSync } from "node:fs";

// Reject an immutable completed packet before compiling a historical composition.
if (process.argv.length === 3 && process.argv[2] === "--capture" && existsSync(pairLifecycleOutput))
  throw new Error(`EEXIST: capture packet already exists: ${pairLifecycleOutput}`);

const source = loadOriginalAccountLifecycleSource();
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
