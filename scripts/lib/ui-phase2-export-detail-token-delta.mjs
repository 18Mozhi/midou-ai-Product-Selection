import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import postcss from "postcss";

export const exportDetailStyle = "apps/web/src/org-data-export-detail.css";
export const exportDetailTokens = "apps/web/src/design/export-detail-tokens.css";
export const exportDetailPalette = Object.freeze({
  ink: "#202c3d",
  muted: "#58677b",
  blue: "#254a9c",
  line: "#dbe1e9",
  paper: "#fff",
  neutral: "#edf1f6",
  "success-ink": "#236951",
  "success-bg": "#e7f2ee",
  "info-bg": "#e8eefb",
  "danger-ink": "#9e3f3d",
  "danger-bg": "#fbeeed",
  pressed: "#dbe7fb",
  focus: "#285ec7",
  technical: "#f3f5f9",
});
export function undoExportDetailTokens(source) {
  const sheet = postcss.parse(readFileSync(exportDetailTokens, "utf8")),
    rules = sheet.nodes.filter((n) => n.type !== "comment");
  assert.equal(rules.length, 1);
  assert.equal(rules[0].type, "rule");
  assert.equal(rules[0].selector, "html #app [data-export-detail-c] .org-data-export-list");
  assert.ok(rules[0].nodes.every((n) => n.type === "decl" && !n.important));
  const entries = rules[0].nodes.map((n) => [n.prop, n.value]);
  assert.equal(entries.length, 14);
  assert.deepEqual(
    Object.fromEntries(entries),
    Object.fromEntries(
      Object.entries(exportDetailPalette).map(([k, v]) => [`--so-export-detail-${k}`, v]),
    ),
  );
  const importLine = '@import "./design/export-detail-tokens.css";\n\n';
  assert.equal(source.split(importLine).length, 2);
  let restored = source.replace(importLine, "");
  for (const [name, value] of Object.entries(exportDetailPalette)) {
    const token = `var(--so-export-detail-${name})`;
    assert.ok(restored.includes(token), `Unused migration token ${name}`);
    restored = restored.replaceAll(token, name === "paper" ? "white" : value);
  }
  return restored;
}
// Historical manifests keep their captured hashes. This permits only the proven byte-exact
// palette extraction, not arbitrary CSS drift, and must not be described as a new capture.
export function capturedExportDetailSource(file, source) {
  return file === exportDetailStyle ? undoExportDetailTokens(source) : source;
}
export function capturedExportDetailHash(file, source) {
  return createHash("sha256").update(capturedExportDetailSource(file, source)).digest("hex");
}
