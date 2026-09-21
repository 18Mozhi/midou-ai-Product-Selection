import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  p47HistoricalSource,
  p47HistoricalSourceFiles as files,
  p47PaletteRevisions,
} from "../../scripts/lib/ui-phase2-adapter-historical-source.mjs";
const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");

test("P47 archive resolver recovers only the two complete verified capture revisions", () => {
  const source = read(files.component);
  assert.equal(
    hash(p47HistoricalSource(files.component, source, "pre-mobile")),
    "2f71a84bc29b416ce9de84732993fa488ae856ac508d22297bdab8f7278b6e5f",
  );
  assert.equal(
    hash(p47HistoricalSource(files.component, source, "pre-refresh")),
    "ea3eaecf5bb8a6ec5e8e701dd8743cac61a35c6806a8a0d35079ba64be3b5e40",
  );
  assert.ok(source.includes("adapter-empty--approved-mobile"));
  assert.ok(source.includes("function refreshFromButton"));
});
test("P47 archive resolver restores the exact 37-role palette without accepting unknown colors", () => {
  const source = read(files.palette);
  assert.equal(hash(source), p47PaletteRevisions.mobile);
  for (const stage of ["pre-mobile", "pre-refresh"]) {
    const previous = p47HistoricalSource(files.palette, source, stage);
    assert.equal(hash(previous), p47PaletteRevisions.before);
    assert.equal((previous.match(/--p47-/g) ?? []).length, 37);
    assert.equal(p47HistoricalSource(files.palette, previous, stage), previous);
    for (const changed of [
      source + "\n",
      source.replace("#142a46", "#142a47"),
      source.replace("#185adb", "#185adc"),
    ])
      assert.throws(() => p47HistoricalSource(files.palette, changed, stage));
  }
});
test("P47 archive resolver rejects runtime, focus, mobile markup drift and unknown stages", () => {
  const source = read(files.component);
  for (const changed of [
    source + "\n// drift",
    source.replace("12_000", "13_000"),
    source.replace("input.focus();", "input.blur();"),
    source.replace("adapter-empty--approved-mobile", "unreviewed"),
    source.replace("page.value += direction;", "page.value -= direction;"),
  ])
    for (const stage of ["pre-mobile", "pre-refresh"])
      assert.throws(() => p47HistoricalSource(files.component, changed, stage));
  assert.throws(() => p47HistoricalSource(files.component, source, "unknown"));
});
test("P47 archive resolver cannot substitute unrelated source files or mutate current reads", () => {
  const source = read(files.component);
  assert.equal(p47HistoricalSource("unrelated.vue", source, "pre-mobile"), source);
  assert.equal(p47HistoricalSource("unrelated.css", "unknown\r\n", "pre-refresh"), "unknown\n");
  p47HistoricalSource(files.component, source, "pre-mobile");
  assert.equal(read(files.component), source);
});

test("P47 historical resolution preserves pre-pagination input support and current pagination source", async () => {
  const { beforeAdapterPaginationFocus } =
    await import("../../scripts/lib/ui-phase2-adapter-pagination-focus-baseline.mjs");
  const source = read(files.component),
    previous = beforeAdapterPaginationFocus(source);
  for (const stage of ["pre-mobile", "pre-refresh"])
    assert.equal(
      p47HistoricalSource(files.component, previous, stage),
      p47HistoricalSource(files.component, source, stage),
    );
  assert.ok(source.includes("function turnPage(direction: -1 | 1, event: MouseEvent)"));
  assert.equal(read(files.component), source);
});
