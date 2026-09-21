import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const ownerPathParent = "apps/web/src/components/OrganizationAdminCenter.vue";
export const ownerPathPanel = "apps/web/src/components/OrganizationApprovalPanel.vue";

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
  assert.equal(
    createHash("sha256").update(reconstructed).digest("hex"),
    expected,
    `Historical source differs beyond P34 owner-path delta: ${file}`,
  );
}
