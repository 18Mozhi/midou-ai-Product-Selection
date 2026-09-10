import assert from "node:assert/strict";

export const auditParentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
// Exact inverse of the three additions inside loadAuditPage. No template, API,
// general load(), write handler, token or other-route code is removed or substituted.
export function undoAuditPageDelta(source) {
  source = source.replaceAll("\r\n", "\n");
  const additions = [
    String.raw`  const sequence = loadSequence,
    initialData = data.value,
    organizationId = props.organizationId,
    routePath = props.routePath,
    ownsRead = () =>
      sequence === loadSequence &&
      data.value === initialData &&
      props.organizationId === organizationId &&
      props.routePath === routePath;
`,
    "    if (!ownsRead()) return;\n",
    String.raw`    if (!ownsRead()) {
      rethrowUnexpectedError(error);
      return;
    }
`,
  ];
  if (!source.includes(additions[0])) return source;
  for (const added of additions) {
    assert.equal(source.split(added).length, 2, "Exact P37 pagination additions");
    source = source.replace(added, "");
  }
  return source;
}
