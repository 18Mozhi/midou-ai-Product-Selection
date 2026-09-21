import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import ts from "typescript";
import { spawnSync } from "node:child_process";
import {
  beforeAdapterEmptyMobile,
  emptyMobileChanges,
} from "../../scripts/lib/ui-phase2-adapter-empty-mobile-baseline.mjs";
import {
  previewCurrentAdapterAccess,
  previewCurrentAdapterFilterPagination,
} from "../../scripts/lib/ui-phase2-adapter-current-state-preview.mjs";
import {
  beforeAdapterPaginationFocus,
  paginationFocusHandler,
  paginationBeforeNav,
  paginationCurrentNav,
  paginationFocusRevision,
} from "../../scripts/lib/ui-phase2-adapter-pagination-focus-baseline.mjs";
import { pageTurnHandler } from "../../scripts/lib/ui-phase2-adapter-filter-pagination-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const source = read("apps/web/src/components/ProviderAdapterCenter.vue");
const previous = beforeAdapterPaginationFocus(source);
const focusFunction = (text, name = "resetEmptyFilters") => {
  const script = parse(text).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile("adapter.ts", script, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  assert.equal(functions.length, 1);
  return functions[0].getText(ast);
};

for (const [state, preview, digest, count] of [
  [
    "access",
    previewCurrentAdapterAccess,
    "9e09ef9ede4ed2400b83d346765abc6170ab0db9f2be817c80fe6af391ada5a1",
    60,
  ],
  [
    "filter-pagination",
    previewCurrentAdapterFilterPagination,
    "e992e6930d347e8ce854c4bb75b403733fe4cfdb89af4d2a2fbdb633bc688541",
    36,
  ],
]) {
  test(`P47 ${state} replay refuses capture before starting a browser or overwriting prior evidence`, () => {
    const root = `output/playwright/p47-${state}-current-review/evidence.json`;
    const before = read(root);
    const run = spawnSync(
      process.execPath,
      [
        "scripts/verify-ui-phase2-provider-adapter-current-states.mjs",
        `--state=${state}`,
        "--capture",
      ],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 1);
    assert.ok(run.stderr.includes("Pagination-focus revision is replay-only here"));
    assert.equal(run.stdout, "");
    assert.equal(read(root), before);
  });
  test(`P47 ${state} archive retains its exact manifest, driver, helper, CSS and all original images`, () => {
    const root = `output/playwright/p47-${state}-review`;
    assert.equal(hash(read(`${root}/evidence.json`)), digest);
    const evidence = JSON.parse(read(`${root}/evidence.json`));
    assert.equal(evidence.screenshots.length, count);
    for (const shot of evidence.screenshots)
      assert.equal(hash(readFileSync(`${root}/${shot.file}`)), shot.sha256, shot.file);
    for (const dependency of [
      `scripts/verify-ui-phase2-provider-adapter-${state}.mjs`,
      `scripts/lib/ui-phase2-adapter-${state}-preview.mjs`,
      `design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-${state}-preview.css`,
    ])
      assert.equal(hash(read(dependency)), evidence.sourceHashes[dependency], dependency);
  });

  test(`P47 current ${state} composition preserves the actual empty-focus function and rejects unverified source changes`, () => {
    const current = preview(source);
    const parsed = parse(current);
    assert.deepEqual(parsed.errors, []);
    compileScript(parsed.descriptor, { id: "p47-current" });
    assert.deepEqual(
      compileTemplate({
        source: parsed.descriptor.template.content,
        id: "p47-current",
        filename: "P47.vue",
      }).errors,
      [],
    );
    assert.equal(focusFunction(current, "turnPage"), focusFunction(source, "turnPage"));
    // The only difference from the verified previous proposal is the current focus patch.
    const withoutPagination =
      state === "access"
        ? current
            .replace(paginationFocusHandler, "")
            .replace(paginationCurrentNav, paginationBeforeNav)
        : current.replace(paginationFocusHandler, pageTurnHandler);
    assert.equal(withoutPagination, preview(previous));
    assert.equal(focusFunction(current), focusFunction(source));
    assert.equal(
      focusFunction(current, "refreshFromButton"),
      focusFunction(source, "refreshFromButton"),
    );
    assert.equal((current.match(/@click="refreshFromButton"/g) ?? []).length, 1);
    assert.equal(
      (current.match(/<header class="adapter-heading" tabindex="-1">/g) ?? []).length,
      1,
    );
    assert.equal((current.match(/@click="resetEmptyFilters"/g) ?? []).length, 1);
    assert.equal(
      (current.match(/import \{ computed, nextTick, onMounted, ref, watch \} from "vue";/g) ?? [])
        .length,
      1,
    );
    assert.match(current, /class="adapter-reset" @click="resetFilters"/);
    let withoutMobile = withoutPagination;
    for (const [before, after] of emptyMobileChanges) {
      assert.equal(current.split(after).length, 2, "Actual mobile markup and import preserved");
      withoutMobile = withoutMobile.replace(after, before);
    }
    assert.equal(withoutMobile, preview(beforeAdapterEmptyMobile(previous)));
    assert.equal(preview(source.replaceAll("\n", "\r\n")), current);
    for (const changed of [
      source + "\n// unknown drift",
      source.replace("input.focus();", "input.blur();"),
      source.replace("resetEmptyFilters", "resetOtherFilters"),
      source.replace("heading.focus({ preventScroll: true });", "heading.blur();"),
      source.replace("还没有可查看的来源", "另一套未审文案"),
      source.replace("adapter-empty--approved-mobile", "adapter-empty--other"),
      source.replace("page.value += direction;", "page.value -= direction;"),
      source.replace("status.focus({ preventScroll: true });", "status.blur();"),
    ])
      assert.throws(() => preview(changed), /explicitly verified production revision/);
  });
}

test("P47 pagination inverse accepts only exact current/before snapshots, never unknown changes", () => {
  assert.equal(hash(previous), paginationFocusRevision.before);
  assert.equal(hash(source), paginationFocusRevision.current);
  assert.equal(beforeAdapterPaginationFocus(previous), previous);
  assert.equal(beforeAdapterPaginationFocus(source.replaceAll("\n", "\r\n")), previous);
  for (const changed of [
    source + "\n",
    previous + "\n",
    source.replace("pageSize = 20", "pageSize = 10"),
    source.replace("document.activeElement === trigger", "true"),
  ])
    assert.throws(() => beforeAdapterPaginationFocus(changed));
});
