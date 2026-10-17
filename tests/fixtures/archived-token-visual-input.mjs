import { readFileSync } from "node:fs";
import { readPreSelectionRebuild } from "./pre-selection-rebuild-snapshot.mjs";
import { readCaptureSourceRevision } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";

// Retired P36 visual/model audit inputs only. Never feed these bytes to the app.
export function readArchivedTokenVisualInput(file) {
  if (file.startsWith("apps/web/src/")) return readPreSelectionRebuild(file);
  if (file === "scripts/lib/ui-phase2-org-token-design-data.mjs")
    return readCaptureSourceRevision(
      file,
      "0d0db09e6c418a0e4700c67847f8e8fa443a4d6df6146d644a98f352cdcb9a4f",
    );
  return readFileSync(file, "utf8").replaceAll("\r\n", "\n");
}
