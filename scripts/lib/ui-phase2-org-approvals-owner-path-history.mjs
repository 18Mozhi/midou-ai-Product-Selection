import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  assertCaptureSourceRevision,
  assertCurrentSourceRevision,
} from "./ui-phase2-token-copy-baseline.mjs";
import { responsiveFocusRevision } from "./ui-phase2-responsive-focus-contract.mjs";

export const ownerPathParent = "apps/web/src/components/OrganizationAdminCenter.vue";
export const ownerPathPanel = "apps/web/src/components/OrganizationApprovalPanel.vue";
export const ownerPathCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-approvals-vue-c.css";
export const ownerPathCssSnapshot =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-approvals-vue-c-600079.history.css";
export const ownerPathCssHash = "600079aa26c56d60c6d954a6189fa4f3be394303206027135cd6abbcbab8f7a5";

// Historical comparisons only. Never install this source in a current preview,
// producer, or runtime. Current behavior is verified by the query/lifecycle tests.
// Reverse exactly the three source edits made by the P34 route-ownership fix.
// Every caller must compare the entire result with its unchanged historical input.
export function beforeP34OwnerPath(file, source) {
  let result = source.replaceAll("\r\n", "\n");
  const changes =
    file === ownerPathParent
      ? [['        :owner-path="props.routePath"\n', ""]]
      : file === ownerPathPanel
        ? [
            ["  ownerPath?: string;\n", ""],
            [
              "const queryOwnerPath = props.ownerPath ?? route.path,",
              "const queryOwnerPath = route.path,",
            ],
          ]
        : [];
  for (const [after, before] of changes) {
    assert.equal(result.split(after).length, 2, `Exact P34 owner-path addition: ${file}`);
    result = result.replace(after, before);
  }
  return result;
}

export function assertP34HistoricalSourceHash(file, source, expected) {
  const reconstructed = beforeP34OwnerPath(file, source);
  const reconstructedHash = createHash("sha256").update(reconstructed).digest("hex");
  if (reconstructedHash === expected) return;
  try {
    // Later page work may change the current source after the immutable P34 capture.
    // Bind the supplied current source to HEAD and prove the capture separately in history.
    assertCurrentSourceRevision(file, source);
    assertCaptureSourceRevision(file, reconstructed, expected);
  } catch {
    assert.fail(`Historical source differs beyond P34 owner-path delta: ${file}`);
  }
}

export function assertP34EvidenceSourceHash(file, source, expected) {
  if (file === ownerPathCss) {
    const snapshot = readFileSync(ownerPathCssSnapshot, "utf8").replaceAll("\r\n", "\n");
    assert.equal(expected, ownerPathCssHash);
    assert.equal(
      createHash("sha256").update(snapshot).digest("hex"),
      ownerPathCssHash,
      "Recovered P34 capture-time CSS snapshot was altered",
    );
    return;
  }
  if (file === ownerPathParent || file === ownerPathPanel) {
    try {
      assertP34HistoricalSourceHash(file, source, expected);
      return;
    } catch {
      assertCaptureSourceRevision(file, source, expected);
      return;
    }
  }
  if (file === responsiveFocusRevision.paletteFile) {
    const notificationSelector = ",\n.responsive-filter-drawer--notifications";
    assert.equal(expected, responsiveFocusRevision.paletteBeforeNotifications);
    assert.equal(source.split(notificationSelector).length, 2);
    assert.equal(
      createHash("sha256").update(source.replace(notificationSelector, "")).digest("hex"),
      expected,
    );
    return;
  }
  assertCaptureSourceRevision(file, source, expected);
}
