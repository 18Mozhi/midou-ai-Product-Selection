import test from "node:test";
import { historicalTokenCopySource } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const output = "output/playwright/p36-fields-review";
const e = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");

test("P36 mobile filter approval pins only the shown fields, help and bottom reset region", () => {
  const sha = "1bdc3c39fdc4f85483db1ca9a6d8fb2f24d8000321a118e976515029c9eb154b";
  const file = "composition-filters-default-390.png";
  const approval = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/P36-MOBILE-FILTER-COMPOSITION-APPROVAL.md",
    "utf8",
  );
  assert.equal(hash(readFileSync(`${output}/${file}`)), sha);
  assert.equal(e.screenshots.find((s) => s.file === file).sha256, sha);
  assert.ok(approval.includes(sha));
  assert.match(approval, /筛选组合通过，继续其他组合/);
  assert.match(approval, /批准仅覆盖四字段单列、就近帮助文字与底部重置区域/);
  assert.match(approval, /不包含顶部折叠按钮、创建表单、权限规则、实际 Vue、整页或生产验收/);
  assert.match(approval, /此前 P36 两项控件视觉问题仍待答/);
  assert.equal(e.approval, "pending-field-review");
});

test("P36 seven actual v-models, one scope group and two shared reason contexts stay distinct", () => {
  const child = readFileSync("apps/web/src/components/OrganizationTokenPanel.vue", "utf8");
  const models = [...child.matchAll(/v-model(?:\.number)?="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.equal(models.length, 7);
  assert.deepEqual(e.models.map((m) => m.model).sort(), models);
  assert.deepEqual(
    e.fields
      .filter((f) => !["scopes", "reason"].includes(f.kind))
      .map((f) => f.model)
      .sort(),
    models,
  );
  assert.equal(e.fields.filter((f) => f.kind === "scopes").length, 1);
  assert.deepEqual(
    e.fields.filter((f) => f.kind === "reason").map((f) => f.action),
    ["rotate", "revoke"],
  );
  for (const m of e.models.filter((m) => m.options))
    assert.deepEqual(e.fields.find((f) => f.model === m.model).options, m.options);
  for (const [id, max] of [
    ["create-name", 120],
    ["create-reason", 500],
  ])
    assert.equal(e.fields.find((f) => f.id === id).max, max);
  const ttl = e.models.find((m) => m.model === "createForm.ttl_days");
  assert.equal(ttl.attrs.min, "1");
  assert.equal(ttl.attrs.max, "365");
  assert.ok(Object.hasOwn(ttl.attrs, "required"));
  const shared = readFileSync("apps/web/src/components/AuditedReasonDialog.vue", "utf8");
  assert.doesNotMatch(shared, /maxlength=/);
  assert.ok(e.fields.filter((f) => f.kind === "reason").every((f) => f.proposalMax === 500));
});

test("P36 each of78 field states has both widths,20 compositions and exact field flow evidence", () => {
  assert.equal(e.fields.length, 10);
  assert.equal(e.checks.length, 156);
  assert.equal(e.flows.length, 10);
  assert.equal(e.compositions.length, 20);
  assert.equal(e.screenshots.length, 196);
  const expected = e.fields
    .flatMap((f) =>
      f.variants.flatMap((v) =>
        [1440, 390].map((w) => `${f.id}-${v.replaceAll(":", "-")}-${w}.png`),
      ),
    )
    .sort();
  assert.deepEqual(
    e.screenshots
      .filter((s) => s.fieldId)
      .map((s) => s.file)
      .sort(),
    expected,
  );
  for (const f of e.fields)
    for (const variant of f.variants)
      for (const width of [1440, 390])
        assert.equal(
          e.checks.filter(
            (s) =>
              s.fieldId === f.id &&
              s.variant === variant &&
              s.width === width &&
              s.sourceFilterIds &&
              s.fieldContract,
          ).length,
          1,
        );
  for (const [name] of e.compositions)
    for (const width of [1440, 390])
      assert.equal(
        e.screenshots.filter((s) => s.composition === name && s.width === width).length,
        1,
      );
  for (const width of [1440, 390])
    for (const kind of ["native-tab-form-order", "exact-source-handler-body-intent-only"])
      assert.equal(e.flows.filter((f) => f.width === width && f.kind === kind).length, 1);
});

test("P36 historical source and image fingerprints retain exact captures", () => {
  for (const [f, sha] of Object.entries(e.sourceHashes))
    // Capture-time proof only; current behavior has a separate mounted regression.
    assert.equal(hash(historicalTokenCopySource(f, readFileSync(f, "utf8"))), sha, f);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  assert.deepEqual(
    readdirSync(output).sort(),
    [...e.screenshots.map((s) => s.file), "index.html", "evidence.json"].sort(),
  );
  const counts = [];
  for (const [dir, r] of Object.entries(e.retained)) {
    const raw = readFileSync(`${dir}/evidence.json`, "utf8").replaceAll("\r\n", "\n");
    assert.equal(hash(raw), r.manifest);
    const old = JSON.parse(raw);
    assert.equal(old.screenshots.length, r.pngCount);
    counts.push(r.pngCount);
    for (const s of old.screenshots) assert.equal(hash(readFileSync(`${dir}/${s.file}`)), s.sha256);
  }
  assert.deepEqual(counts, [112, 354]);
});

test("P36 new fields remain proposals, not approval or production acceptance", () => {
  assert.equal(e.approval, "pending-field-review");
  assert.match(e.scope, /no mounted Vue\/API\/SQL\/permissions\/OS clipboard or production proof/);
  assert.equal(Object.hasOwn(e, "approved"), false);
  const source = readFileSync("scripts/verify-ui-phase2-org-token-fields.mjs", "utf8");
  assert.match(source, /vm.runInNewContext/);
  assert.match(source, /model.options/);
  assert.match(source, /await browser.close\(\)/);
  assert.match(source, /window.__clipboardCalls/);
  assert.ok(e.fields.find((f) => f.id === "filter-query").variants.includes("long"));
  assert.equal(e.models.find((m) => m.model === "tokenQuery").attrs.maxlength, undefined);
});
