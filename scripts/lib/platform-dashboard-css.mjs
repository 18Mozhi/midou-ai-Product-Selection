import assert from "node:assert/strict";

export const platformDashboardCss = "apps/web/src/styles/platform-dashboard.css";
export const platformDashboardLayoutCss = "apps/web/src/styles/platform-dashboard-layout.css";
const layoutImport = '@import "./platform-dashboard-layout.css";\n\n';

/** Reassemble the known split in source order for existing color and history assertions. */
export function expandPlatformDashboardCss(entry, layout) {
  const normalized = entry.replaceAll("\r\n", "\n");
  assert.equal(normalized.split(layoutImport).length, 2, "expected one dashboard layout import");
  return normalized.replace(layoutImport, () => `\n${layout.replaceAll("\r\n", "\n")}\n`);
}
