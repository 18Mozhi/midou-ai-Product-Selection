import { readFile } from "node:fs/promises";
import { teamsAnchorBase, teamsAnchorDriver } from "./lib/ui-phase2-teams-anchor-driver.mjs";

try {
  await import(
    "data:text/javascript;base64," +
      Buffer.from(teamsAnchorDriver(await readFile(teamsAnchorBase, "utf8"))).toString("base64")
  );
} catch (error) {
  console.error(
    String(error?.stack ?? error).replaceAll(
      /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
      "p33-anchor-driver-composed",
    ),
  );
  process.exitCode = 1;
}
