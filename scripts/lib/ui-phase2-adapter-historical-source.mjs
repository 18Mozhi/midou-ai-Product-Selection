import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeAdapterEmptyMobile } from "./ui-phase2-adapter-empty-mobile-baseline.mjs";
import { beforeAdapterRefreshFocus } from "./ui-phase2-adapter-refresh-focus-baseline.mjs";
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
};
const mobileColors =
  "  --p47-empty-canvas: #f6f8fb;\n" +
  "  --p47-empty-border: #d9e1ec;\n" +
  "  --p47-empty-ink: #152b49;\n" +
  "  --p47-empty-muted: #53657c;\n" +
  "  --p47-empty-accent: #185adb;\n";

// For explicitly historical evidence only. Never transform the running Vue or a current proof.
export function p47HistoricalSource(file, source, stage) {
  assert.ok(["pre-mobile", "pre-refresh"].includes(stage), "Unknown P47 capture stage");
  source = source.replaceAll("\r\n", "\n");
  if (file === p47HistoricalSourceFiles.component) {
    if (hash(source) === paginationFocusRevision.current)
      source = beforeAdapterPaginationFocus(source);
    const preMobile = beforeAdapterEmptyMobile(source);
    return stage === "pre-refresh" ? beforeAdapterRefreshFocus(preMobile) : preMobile;
  }
  if (file === p47HistoricalSourceFiles.palette) {
    if (hash(source) === p47PaletteRevisions.before) return source;
    assert.equal(hash(source), p47PaletteRevisions.mobile, "Unknown P47 palette revision");
    assert.equal(source.split(mobileColors).length, 2);
    const previous = source.replace(mobileColors, "");
    assert.equal(hash(previous), p47PaletteRevisions.before, "Previous palette must match in full");
    return previous;
  }
  return source;
}
