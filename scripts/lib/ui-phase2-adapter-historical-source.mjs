import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { beforeAdapterReadError } from "./ui-phase2-adapter-read-error-baseline.mjs";
import { readErrorRevision } from "./ui-phase2-adapter-read-error-baseline.mjs";
import { beforeAdapterEmptyMobile } from "./ui-phase2-adapter-empty-mobile-baseline.mjs";
import { beforeAdapterRefreshFocus } from "./ui-phase2-adapter-refresh-focus-baseline.mjs";
import {
  beforeAdapterTableTools,
  tableToolsRevision,
} from "./ui-phase2-adapter-table-tools-baseline.mjs";
import {
  beforeAdapterPaginationFocus,
  paginationFocusRevision,
} from "./ui-phase2-adapter-pagination-focus-baseline.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
export const p47HistoricalSourceFiles = {
  component: "apps/web/src/components/ProviderAdapterCenter.vue",
  palette: "apps/web/src/design/provider-adapter-tokens.css",
};
export const p47PaletteRevisions = {
  before: "c6ff4f890f97866b8e8faca8bee234532534ecb014e2acf5ba61567da24600a6",
  mobile: "ec274e4382f9b741d26d79f5cc8d5dd5b1602967000cb227320fca0e018fe214",
  mobileCommit: "73f7676ce3ebfc5600f39d372f0a7083fd8e7e2a",
  approvedCurrent: "3f698489b5c23cd4b634655959c976c336e55d3b0fcc7d491bb56b999f71cdad",
};
const p47ReadErrorCurrent = readErrorRevision.current;
const mobileColors =
  "  --p47-empty-canvas: #f6f8fb;\n" +
  "  --p47-empty-border: #d9e1ec;\n" +
  "  --p47-empty-ink: #152b49;\n" +
  "  --p47-empty-muted: #53657c;\n" +
  "  --p47-empty-accent: #185adb;\n";

// Remove only later approved presentation layers before applying older exact inverses.
export function beforeAdapterP47ReadAndTableTools(source) {
  source = source.replaceAll("\r\n", "\n");
  if ([p47ReadErrorCurrent, readErrorRevision.approvedCurrent].includes(hash(source)))
    source = beforeAdapterReadError(source);
  if (hash(source) === tableToolsRevision.current) source = beforeAdapterTableTools(source);
  return source;
}

// For explicitly historical evidence only. Never transform the running Vue or a current proof.
export function p47HistoricalSource(file, source, stage) {
  assert.ok(["pre-mobile", "pre-refresh"].includes(stage), "Unknown P47 capture stage");
  source = source.replaceAll("\r\n", "\n");
  if (file === p47HistoricalSourceFiles.component) {
    source = beforeAdapterP47ReadAndTableTools(source);
    if (hash(source) === paginationFocusRevision.current)
      source = beforeAdapterPaginationFocus(source);
    const preMobile = beforeAdapterEmptyMobile(source);
    return stage === "pre-refresh" ? beforeAdapterRefreshFocus(preMobile) : preMobile;
  }
  if (file === p47HistoricalSourceFiles.palette) {
    if (hash(source) === p47PaletteRevisions.approvedCurrent) {
      source = execFileSync("git", ["show", `${p47PaletteRevisions.mobileCommit}:${file}`], {
        encoding: "utf8",
      }).replaceAll("\r\n", "\n");
      assert.equal(hash(source), p47PaletteRevisions.mobile, "Pinned P47 palette source changed");
    }
    if (hash(source) === p47PaletteRevisions.before) return source;
    assert.equal(hash(source), p47PaletteRevisions.mobile, "Unknown P47 palette revision");
    assert.equal(source.split(mobileColors).length, 2);
    const previous = source.replace(mobileColors, "");
    assert.equal(hash(previous), p47PaletteRevisions.before, "Previous palette must match in full");
    return previous;
  }
  return source;
}
