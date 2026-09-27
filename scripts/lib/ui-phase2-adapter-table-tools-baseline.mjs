import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const tableToolsRevision = {
  before: "24a3b27fca62f5331bd19c58ba501e2b6b9777d7e59a7b03248286d82a4962a2",
  current: "7fce30d574f08ef93c5530b7d609e5d5fde38c0ab246e20c91fbd8c45497b798",
};

const importLine = 'import "../provider-adapters-c-table-tools.css";\n';
const hash = (source) => createHash("sha256").update(source).digest("hex");

// Historical comparison only. The production route keeps its table-tools stylesheet import.
export function beforeAdapterTableTools(source) {
  source = source.replaceAll("\r\n", "\n");
  if (hash(source) === tableToolsRevision.before) return source;
  assert.equal(hash(source), tableToolsRevision.current, "Unknown P47 table-tools revision");
  assert.equal(source.split(importLine).length, 2, "Unique approved table-tools import");
  const previous = source.replace(importLine, "");
  assert.equal(
    hash(previous),
    tableToolsRevision.before,
    "P47 table-tools inverse must match in full",
  );
  return previous;
}
