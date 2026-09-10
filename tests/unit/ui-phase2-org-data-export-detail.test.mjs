import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import postcss from "postcss";
import { readBeforeAuditPage } from "../../scripts/lib/ui-phase2-audit-page-evidence.mjs";
import {
  capturedExportDetailHash,
  undoExportDetailTokens,
} from "../../scripts/lib/ui-phase2-export-detail-token-delta.mjs";

const component = "apps/web/src/components/OrganizationDataPanel.vue";
const baseline = "d401ec95501555a458715ea3a610e61f5f8eead7";
const root = "output/playwright/p35-export-detail-vue";
const lf = (v) => v.replaceAll("\r\n", "\n");
const read = (f) => lf(readFileSync(f, "utf8"));
const old = (f) =>
  lf(execFileSync("git", ["show", `${baseline}:${f}`], { encoding: "utf8", maxBuffer: 5000000 }));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const e = JSON.parse(read(`${root}/evidence.json`));

test("P35 export detail changes only styling marker/import, not script, fields or actions", () => {
  assert.equal(
    read(component)
      .replace(
        ' aria-labelledby="org-data-title" data-export-detail-c>',
        ' aria-labelledby="org-data-title">',
      )
      .replace('\n<style src="../org-data-export-detail.css"></style>\n', ""),
    old(component),
  );
  const css = postcss.parse(
    undoExportDetailTokens(read("apps/web/src/org-data-export-detail.css")),
  );
  assert.equal(css.nodes.filter((n) => n.type !== "comment").length, 1);
  assert.equal(css.nodes.find((n) => n.type === "atrule").params, "(max-width: 760px)");
  css.walkRules((rule) =>
    assert.ok(
      rule.selectors.every((s) => s.replace(/\s+/g, " ").startsWith("#app [data-export-detail-c]")),
      rule.selector,
    ),
  );
  assert.doesNotMatch(css.toString(), /@import|url\(|!important/);
  css.walkDecls("display", (decl) => {
    if (decl.value === "none")
      assert.ok(decl.parent.selector.endsWith("summary::-webkit-details-marker"));
  });
});

test("P35 approved mobile composition is pinned without promoting other images or whole page", () => {
  const file = "output/playwright/p35-controls-review/export-details-composition-390.png";
  const sha = "ace59de073c5b4507a6704d89c8a0767043715e98370608a56ddd70c49e08217";
  assert.equal(hash(readFileSync(file)), sha);
  const approval = read("design-plans/ui-phase-2-2026-09-07/P35-MOBILE-EXPORT-DETAIL-APPROVAL.md");
  assert.ok(approval.includes(sha));
  assert.match(approval, /仅批准此设计组合/);
  assert.equal(
    JSON.parse(read("output/playwright/p35-controls-review/evidence.json")).status,
    "pending-user-review",
  );
});

test("P35 null and zero approvals pin only the two reviewed 390px images", () => {
  const approval = read("design-plans/ui-phase-2-2026-09-07/P35-MOBILE-EXPORT-DETAIL-APPROVAL.md");
  const approved = [
    [
      "zero-open-390.png",
      "zero",
      "4d9f22dddd4c73714a04c5021aae81213b8b1991a0c13bf8d99aec4358cd40ae",
    ],
    [
      "known-zero-open-390.png",
      "known-zero",
      "3c4ea30c98279a4da0f361e73d72a39e7547411bdc3d17c6fa30ef512160a560",
    ],
  ];
  for (const [file, scene, sha] of approved) {
    const shot = e.screenshots.find((s) => s.file === file);
    assert.equal(shot.width, 390);
    assert.equal(shot.scene, scene);
    assert.equal(shot.sha256, sha);
    assert.equal(hash(readFileSync(`${root}/${file}`)), sha);
    assert.ok(approval.includes(file));
    assert.ok(approval.includes(sha));
  }
  assert.match(approval, /两种状态均通过，继续其他状态/);
  assert.match(approval, /不包含760px图、其他导出状态或完整控件包/);
  assert.match(approval, /“正在生成”与“等待重试”继续待审/);
  assert.equal(Object.hasOwn(e, "approved"), false);
});

test("P35 actual child proof covers mobile layout, null versus zero and desktop exclusion", () => {
  assert.equal(e.baselineCommit, baseline);
  assert.equal(e.baselineLoaded, true);
  assert.equal(e.checks.length, 548);
  assert.equal(e.screenshots.length, 24);
  assert.equal(e.checks.filter((c) => c.name.includes("baseline pixels")).length, 14);
  for (const width of [390, 760, 761, 1440])
    for (const name of [
      "zero row exact label",
      "zero row native detail opens",
      "missing times preserve original formatter",
      "unknown status retained",
      "unknown type retained",
      "no external/API requests",
      "no page errors",
    ])
      assert.ok(
        e.checks.some((c) => c.width === width && c.name === name),
        `${width}:${name}`,
      );
  for (const width of [390, 760])
    for (const scene of [
      "normal",
      "zero",
      "long",
      "unknown",
      "missing",
      "queued",
      "leased",
      "retry_scheduled",
      "succeeded",
      "dead_letter",
      "expired",
    ])
      assert.ok(
        e.checks.some((c) => c.width === width && c.name === `${scene}: no field clipping`),
      );
  assert.deepEqual([...new Set(e.screenshots.map((s) => s.width))].sort(), [390, 760]);
  assert.match(e.scope, /not-parent-API-SQL-production/);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(capturedExportDetailHash(file, read(file)), sha, file);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${root}/${s.file}`)), s.sha256, s.file);
  assert.deepEqual(
    readdirSync(root)
      .filter((f) => f.endsWith(".png"))
      .sort(),
    e.screenshots.map((s) => s.file).sort(),
  );
});

test("P35 prior design evidence only updates the exact source association, preserving all old PNG and approvals", () => {
  for (const folder of [
    "design-plans/ui-phase-2-2026-09-07/design/org-data-direction-c",
    "output/playwright/p35-controls-review",
  ]) {
    const before = JSON.parse(old(`${folder}/evidence.json`));
    // Verify the original P35-only association after undoing the separately proven P37 layer.
    const after = JSON.parse(readBeforeAuditPage(`${folder}/evidence.json`));
    assert.equal(before.sourceHashes[component], hash(old(component)));
    before.sourceHashes[component] = hash(read(component));
    assert.deepEqual(after, before, folder);
    for (const s of after.screenshots)
      assert.equal(hash(readFileSync(`${folder}/${s.file}`)), s.sha256, s.file);
  }
});
