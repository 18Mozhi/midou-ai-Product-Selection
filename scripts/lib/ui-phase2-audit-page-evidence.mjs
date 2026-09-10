import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { auditParentFile, undoAuditPageDelta } from "./ui-phase2-audit-page-delta.mjs";

const journalFile = "design-plans/ui-phase-2-2026-09-07/P37-PAGINATION-SOURCE-ASSOCIATIONS.json";
const raw = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
export const hasAuditPageAssociations = () => existsSync(journalFile);
export function readBeforeAuditPage(file) {
  const source = raw(file);
  if (file === auditParentFile) return undoAuditPageDelta(source);
  if (!hasAuditPageAssociations()) return source;
  const journal = JSON.parse(raw(journalFile)),
    entry = journal.entries.find((v) => v.file === file);
  if (!entry) return source;
  assert.equal(hash(source), entry.afterHash, `Current pagination evidence drift: ${file}`);
  const value = JSON.parse(source);
  for (const change of entry.changes) {
    let parent = value;
    for (const key of change.keys.slice(0, -1)) parent = parent[key];
    const key = change.keys.at(-1);
    assert.deepEqual(parent[key], change.after);
    parent[key] = change.before;
  }
  const before = JSON.stringify(value, null, 2) + "\n";
  assert.equal(hash(before), entry.beforeHash, `Historical pagination evidence drift: ${file}`);
  return before;
}
export function hashBeforeAuditPage(file) {
  const current = hash(raw(file));
  const change = hasAuditPageAssociations() && JSON.parse(raw(journalFile)).sourceChanges[file];
  if (!change) return current;
  assert.equal(current, change.after, file);
  return change.before;
}
