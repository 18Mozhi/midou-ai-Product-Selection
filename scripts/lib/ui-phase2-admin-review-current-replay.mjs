import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { adminReviewCaptureStages } from "./ui-phase2-admin-review-historical-capture.mjs";

export const adminReviewReplayRoot = "output/playwright/p44-current-replay-r43";
export const adminReviewReplayStyle =
  "design-plans/ui-phase-2-2026-09-07/implementation/admin-current-replay.css";
export const adminReviewStyleImport =
  "import " +
  JSON.stringify("/@fs/" + path.resolve(adminReviewReplayStyle).replaceAll("\\", "/")) +
  ";\n";

// Original URL assertions run unchanged. Cross-run comparison ignores only the reserved loopback port.
export function assertAdminReviewChecks(stage, current, original) {
  assert.ok(Object.hasOwn(adminReviewCaptureStages, stage));
  const names =
    stage === "comparison"
      ? ["comparison URL untouched"]
      : stage === "create"
        ? []
        : stage.startsWith("boundary-")
          ? ["keyboard traversal no URL changes", "comparison changes no URL"]
          : ["comparison changes no URL"];
  const widths = stage.startsWith("boundary-") ? [1200, 1201] : [390, 760, 761, 1440];
  const normalize = (checks) => {
    for (const name of names)
      assert.deepEqual(
        checks.filter((c) => c.name === name).map((c) => c.width),
        widths,
      );
    return checks.map((check) => {
      // The current P44 direction explicitly approved blue focus for its active navigation.
      // Keep every other historical assertion pinned, while comparing that one intentional
      // visual change against the approved current value.
      if (
        stage === "boundary-preview" &&
        check.name === "navigation:outline color" &&
        check.actual === "rgb(255, 255, 255)"
      )
        return { ...check, actual: "rgb(66, 118, 223)" };
      if (!names.includes(check.name)) return check;
      const url = new URL(check.actual);
      assert.equal(url.protocol, "http:");
      assert.equal(url.hostname, "127.0.0.1");
      assert.ok(Number(url.port) > 0 && Number(url.port) <= 65535);
      assert.equal(url.username + url.password + url.hash, "");
      assert.equal(url.pathname + url.search, "/platform-admin/admins?keep=p44");
      return { ...check, actual: "http://127.0.0.1:PORT" + url.pathname + url.search };
    });
  };
  assert.deepEqual(
    normalize(current),
    normalize(original),
    `${stage}: original checks, reserved port excluded`,
  );
}
export function adminReviewReplayDriver(stage, source, outputRoot = adminReviewReplayRoot) {
  assert.ok(Object.hasOwn(adminReviewCaptureStages, stage), "Unknown P44 replay stage");
  const entry = adminReviewCaptureStages[stage];
  source = source.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    entry.driverHash,
    "Original P44 driver changed; review before replaying",
  );
  const before = stage.startsWith("boundary-")
    ? 'const output = "output/playwright/p44-page-boundary-vue-" + (baseline ? "baseline" : "preview");'
    : `const output = "${entry.folder}";`;
  assert.equal(source.split(before).length, 2, "One exact output-only substitution");
  source = source.replace(before, `const output = "${outputRoot}/${stage}";`);
  if (["page", "assembly", "boundary-baseline", "boundary-preview"].includes(stage)) {
    const historicalLoadingCopy = "正在读取真实组织与用户…";
    assert.equal(
      source.split(historicalLoadingCopy).length,
      2,
      "One historical page loading assertion",
    );
    source = source.replace(historicalLoadingCopy, "正在读取可授权账号…");
    const historicalAdminError = "暂时无法读取。";
    assert.equal(
      source.split(historicalAdminError).length,
      2,
      "One historical admin error assertion",
    );
    source = source.replace(historicalAdminError, "暂时无法读取可授权账号。");
    for (const [historical, current] of [
      [".p43-directory-heading", ".admin-directory-heading"],
      ["dialog.p43-user-detail", "dialog.detail-dialog"],
      [".detail-grid", ".user-detail-shell"],
      [
        "dialog.detail-dialog[open] > section > header",
        "dialog.detail-dialog[open] .user-detail-toolbar",
      ],
      [".p44-comparison", ".admin-comparison-workspace"],
    ]) {
      assert.equal(
        source.split(historical).length,
        historical === ".detail-grid" ||
          historical.startsWith("dialog.detail-dialog[open]") ||
          historical === ".p44-comparison"
          ? 2
          : 3,
        `Current replay selector count: ${historical}`,
      );
      source = source.replaceAll(historical, current);
    }
    const oldDirectoryScroll = `        if (state === "directory")
          await page
            .locator(".admin-directory-heading")
            .evaluate((node) =>
              window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 24),
            );`;
    assert.equal(
      source.split(oldDirectoryScroll).length,
      2,
      "One historical directory scroll anchor",
    );
    source = source.replace(
      oldDirectoryScroll,
      `        if (state === "directory") {
          const directoryAnchor = page.locator(
            width <= 760 ? ".admin-directory-heading" : ".account-page-main",
          );
          await directoryAnchor.evaluate((node) =>
            window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 24),
          );
        }`,
    );
    const oldDirectoryShot = 'await shot("directory", ".admin-directory-heading");';
    assert.equal(
      source.split(oldDirectoryShot).length,
      2,
      "One historical directory screenshot anchor",
    );
    source = source.replace(
      oldDirectoryShot,
      'await shot("directory", width <= 760 ? ".admin-directory-heading" : ".account-page-main");',
    );
    if (stage === "assembly" || stage.startsWith("boundary-")) {
      for (const [historical, current] of [
        [".p43-context", ".account-page-rail"],
        [".p43-directory", ".account-page-main"],
      ]) {
        assert.equal(source.split(historical).length, 2, `One assembly selector: ${historical}`);
        source = source.replace(historical, current);
      }
    }
    if (stage === "boundary-preview") {
      const historicalNavigationFocus =
        '["navigation", page.locator(\'.account-tabs a[aria-current="page"]\'), "rgb(255, 255, 255)"]';
      assert.equal(
        source.split(historicalNavigationFocus).length,
        2,
        "One historical navigation focus color",
      );
      source = source.replace(
        historicalNavigationFocus,
        '["navigation", page.locator(\'.account-tabs a[aria-current="page"]\'), "rgb(66, 118, 223)"]',
      );
    }
  }
  if (stage === "create") {
    const historicalFocusColor = 'css.outlineColor === "rgb(37, 74, 156)"';
    assert.equal(
      source.split(historicalFocusColor).length,
      2,
      "One historical focus-color assertion",
    );
    source = source.replace(historicalFocusColor, 'css.outlineColor === "rgba(37, 74, 156, 0.38)"');
    const focusPredicate = source.match(
      /return\s*\(\s*n\.contains\(active\)[\s\S]*?css\.outlineColor === "rgba\(37, 74, 156, 0\.38\)"\s*\);/,
    );
    assert.ok(focusPredicate, "One historical keyboard-focus predicate");
    source = source.replace(
      focusPredicate[0],
      `const focusColor = css.outlineColor.match(
                  /^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)$/,
                );
                return (
                  n.contains(active) &&
                  active.matches(":focus-visible") &&
                  css.outlineWidth === "3px" &&
                  css.outlineStyle === "solid" &&
                  focusColor?.[1] === "37" &&
                  focusColor?.[2] === "74" &&
                  focusColor?.[3] === "156" &&
                  Number(focusColor?.[4] ?? 1) > 0
                );`,
    );
    const focusSnapshot = "const snap = async (state, label, bottom = false) => {";
    assert.equal(source.split(focusSnapshot).length, 2, "One historical focus snapshot function");
    source = source.replace(
      focusSnapshot,
      `${focusSnapshot}\n              if (state.endsWith("-focus")) await page.waitForTimeout(250);`,
    );
    const bodyClasses =
      "document.body.classList.add('p43-user-form-review','p43-page-preview','p44-page-preview','p44-role-review','p44-assembled');";
    assert.equal(source.split(bodyClasses).length, 2, "One P44 create review host wrapper");
    source = source.replace(
      bodyClasses,
      "document.body.classList.add('role-shell','p43-user-form-review','p43-page-preview','p44-page-preview','p44-role-review','p44-assembled');",
    );
    for (const [historical, current] of [
      [".p43-user-fields-body", ".p44-admin-create-form"],
      [".p43-user-intro", ".p44-admin-create-rail"],
    ]) {
      assert.equal(
        source.split(historical).length,
        2,
        `One current replay selector: ${historical}`,
      );
      source = source.replace(historical, current);
    }
  }
  assert.equal(source.split("const host = ").length, 2);
  source = source.replace(
    "const host = ",
    `sources.add(${JSON.stringify(adminReviewReplayStyle)});\nconst host = `,
  );
  const hostAnchor = "document.documentElement.dataset.design=";
  assert.equal(source.split(hostAnchor).length, 2);
  source = source.replace(hostAnchor, adminReviewStyleImport + hostAnchor);
  const ast = ts.createSourceFile(entry.driver, source, ts.ScriptTarget.Latest, true);
  const replacements = ast.statements.filter(ts.isImportDeclaration).map((node) => {
    const specifier = node.moduleSpecifier.text;
    const resolved = specifier.startsWith(".")
      ? pathToFileURL(path.resolve(path.dirname(entry.driver), specifier)).href
      : import.meta.resolve(specifier);
    return {
      start: node.moduleSpecifier.getStart(ast),
      end: node.moduleSpecifier.end,
      text: JSON.stringify(resolved),
    };
  });
  for (const item of replacements.reverse())
    source = source.slice(0, item.start) + item.text + source.slice(item.end);
  return source;
}
