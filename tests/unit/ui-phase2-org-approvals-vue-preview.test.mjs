import test from "node:test";
import {
  beforeP34OwnerPath,
  assertP34HistoricalSourceHash,
} from "../../scripts/lib/ui-phase2-org-approvals-owner-path-history.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { baseParse, NodeTypes } from "@vue/compiler-core";
import {
  approvalsVueFile,
  approvalsVueCss,
  approvalsVueChanges,
  previewApprovalsVue,
} from "../../scripts/lib/ui-phase2-org-approvals-vue-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const original = read(approvalsVueFile),
  revised = previewApprovalsVue(original);
const before = parse(original).descriptor,
  after = parse(revised).descriptor;
function elements(source, predicate) {
  const root = baseParse(source),
    found = [];
  const visit = (n) => {
    if (n.type === NodeTypes.ELEMENT && predicate(n)) found.push(n);
    for (const child of n.children ?? []) visit(child);
  };
  visit(root);
  return found;
}
const hasClass = (node, part) =>
  node.props.some(
    (p) =>
      p.type === NodeTypes.ATTRIBUTE &&
      p.name === "class" &&
      p.value?.content.split(" ").includes(part),
  );
test("P34 C preview compiles, reverses and preserves the complete runtime script", () => {
  compileScript(after, { id: "p34-c" });
  assert.deepEqual(
    compileTemplate({ source: after.template.content, filename: approvalsVueFile, id: "p34-c" })
      .errors,
    [],
  );
  assert.equal(after.scriptSetup.content, before.scriptSetup.content);
  let reverse = revised;
  for (const [a, b] of [...approvalsVueChanges].reverse()) {
    assert.equal(reverse.split(b).length, 2);
    reverse = reverse.replace(b, a);
  }
  assert.equal(reverse, original);
});
test("all original events, models, links and approved mobile subtrees remain intact", () => {
  const contract = (source) =>
    elements(source, () => true).flatMap((n) =>
      n.props
        .filter((p) => p.type === NodeTypes.DIRECTIVE && ["on", "model"].includes(p.name))
        .map((p) => p.loc.source),
    );
  assert.deepEqual(contract(after.template.content), contract(before.template.content));
  for (const marker of ["org-approval-template-filters-c", "org-approval-empty"]) {
    const old = elements(before.template.content, (n) => hasClass(n, marker)).map(
      (n) => n.loc.source,
    );
    const current = elements(after.template.content, (n) => hasClass(n, marker)).map(
      (n) => n.loc.source,
    );
    assert.deepEqual(current, old, marker);
  }
  const links = (source) =>
    elements(source, (n) => n.tag === "RouterLink").map((n) => n.loc.source);
  assert.deepEqual(links(after.template.content), links(before.template.content));
  assert.equal(elements(after.template.content, (n) => n.tag.toLowerCase() === "dialog").length, 0);
  assert.deepEqual(
    after.styles.map((s) => s.content),
    before.styles.map((s) => s.content),
  );
});
test("differences use explicit before/after text without changing ordinal or field expressions", () => {
  assert.match(revised, /<small>变更前<\/small>\{\{ field.before \?\? "未设置" \}\}/);
  assert.match(revised, /<small>变更后<\/small>\{\{ field.after \?\? "未设置" \}\}/);
  assert.match(
    revised,
    /!visibleTemplates.some\(template => template.id === selectedTemplate.id\)/,
  );
  assert.match(revised, /第 \{\{ change.ordinal \}\} 节点/);
  assert.doesNotMatch(read(approvalsVueCss), /!important/);
});
test("changed source anchors and unknown flags fail before execution", () => {
  assert.throws(
    () =>
      previewApprovalsVue(original.replace('class="org-approval-governance"', 'class="changed"')),
    /anchor/,
  );
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-org-approvals-vue-c.mjs", "--unknown"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
});

test("P34 historical six-width review binds source lineage, original contracts and image bytes", () => {
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const folder = "output/playwright/p34-approvals-vue-c-r4";
  const e = JSON.parse(read(`${folder}/evidence.json`));
  assert.equal(e.kind, "P34-ACTUAL-VUE-C-r4");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(Object.keys(e.sourceHashes).length, 179);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assertP34HistoricalSourceHash(file, read(file), expected);
  assert.equal(
    e.transformedHashes[approvalsVueFile],
    hash(beforeP34OwnerPath(approvalsVueFile, revised)),
  );
  assert.deepEqual(
    e.runs.filter((r) => r.mode === "baseline").map((r) => r.width),
    [390, 760],
  );
  assert.deepEqual(
    e.runs.filter((r) => r.mode === "review").map((r) => r.width),
    [390, 760, 761, 840, 841, 1440],
  );
  assert.equal(
    e.runs.reduce((n, r) => n + r.checks.length, 0),
    224,
  );
  for (const run of e.runs) {
    assert.ok(run.requests.length > 0);
    assert.ok(run.requests.every((r) => r.key.startsWith("GET ") && r.body === null));
    assert.deepEqual(run.checks.find((c) => c.name === "no unexpected requests").actual, []);
    assert.deepEqual(run.checks.find((c) => c.name === "no runtime errors").actual, []);
  }
  assert.equal(e.screenshots.length, 58);
  for (const image of e.screenshots) {
    const bytes = readFileSync(`${folder}/${image.file}`);
    assert.equal(hash(bytes), image.sha256);
    assert.equal(bytes.readUInt32BE(16), image.width);
    assert.equal(bytes.readUInt32BE(20), image.viewport.height);
    assert.ok(image.viewport.height >= 1000 && image.viewport.height <= 4000);
  }
});

test("P34 capture refuses existing evidence before starting a browser or service", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-org-approvals-vue-c.mjs", "--capture"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /EEXIST/);
});
