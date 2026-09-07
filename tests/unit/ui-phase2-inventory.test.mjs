import assert from "node:assert/strict";
import test from "node:test";
import {
  scanSource,
  parseLegacyInventory,
  reconcileLegacy,
  reachableFiles,
} from "../../scripts/lib/ui-phase2-inventory.mjs";

const filename = "apps/web/src/components/Example.vue";
const scan = (source) => scanSource(source, filename);

test("Vue AST preserves greater-than expressions, accessible labels and inherited conditions", () => {
  const result = scan(`<script setup>function save() { return true; }</script>
<template><section v-if="canEdit"><button v-for="item in items" :disabled="item.count > 1"
@click="save()" aria-label="保存对象"><span>保存</span></button></section></template>`);
  assert.equal(result.candidates.length, 1);
  const item = result.candidates[0];
  assert.equal(item.attributes[":disabled"], "item.count > 1");
  assert.equal(item.label, "保存对象");
  assert.deepEqual(
    item.conditions.map((condition) => condition.directive),
    ["v-if", "v-for"],
  );
  assert.equal(item.handlerDefinitions[0].name, "save");
  assert.equal(item.actionId, null);
  assert.equal(item.sideEffect, "unknown-until-handler-reviewed");
});

test("inventory includes links, menu events, submit inputs, forms and shared dialog callers", () => {
  const result = scan(`<template><RouterLink :to="target">详情</RouterLink>
<a href="/">返回</a><div role="menuitem" @click="open">打开</div>
<input type="submit" aria-label="提交"/><form @submit.prevent="save"></form>
<AuditedReasonDialog :open="visible" @submit="commit" @cancel="cancel"/>
<dialog aria-label="确认"><button>取消</button></dialog></template>`);
  assert.equal(result.candidates.filter((item) => item.kind === "control").length, 5);
  assert.equal(result.candidates.filter((item) => item.kind === "form-event").length, 1);
  assert.equal(result.candidates.filter((item) => item.kind === "dialog-component-call").length, 1);
  assert.equal(result.candidates.filter((item) => item.kind === "dialog-definition").length, 1);
  assert.ok(result.candidates.some((item) => item.events?.["@submit.prevent"] === "save"));
});

test("line movement does not change source identity, duplicate identical controls remain distinct", () => {
  const source = `<template><button @click="save">保存</button><button @click="save">保存</button></template>`;
  const before = scan(source).candidates;
  const after = scan(`\n\n${source}`).candidates;
  assert.deepEqual(
    before.map((item) => item.candidateId),
    after.map((item) => item.candidateId),
  );
  assert.notEqual(before[0].candidateId, before[1].candidateId);
  assert.equal(after[0].line, before[0].line + 2);
});

test("shared reason aliases and native modal calls are discovered from script AST", () => {
  const result = scan(`<script setup lang="ts">
import { useAuditedReason } from '../use-audited-reason';
const { ask: askReason } = useAuditedReason();
async function execute() { await askReason({ title: '说明' }); window.confirm('确定'); panel.value.showModal(); }
function confirm() { return true; }
confirm();
</script><template><button @click="execute">执行</button></template>`);
  const calls = result.candidates.filter((item) => item.kind === "dialog-script-call");
  assert.deepEqual(
    calls.map((item) => item.tag),
    ["askReason", "window.confirm", "panel.value.showModal"],
  );
  assert.deepEqual(result.imports, ["../use-audited-reason"]);
});

test("dynamic component/spread paths remain explicit runtime review warnings", () => {
  const result = scan(
    `<template><component :is="current"/><button v-bind="props" v-on="events"/><div v-html="markup"/></template>`,
  );
  assert.equal(result.warnings.length, 3);
  assert.equal(result.candidates[0].reviewStatus, "unreviewed");
});

test("legacy location mapping does not invent business dispositions or nearest-line matches", () => {
  const entries = parseLegacyInventory(
    `| 12 | [${filename}:1](../../${filename}#L1) | 保存 | 次 |\n| 13 | [${filename}:22](../../${filename}#L22) | 删除 | 次 |`,
    "button",
  );
  const candidates = scan(`<template><button>保存</button></template>`).candidates;
  const mapped = reconcileLegacy(entries, candidates);
  assert.equal(mapped[0].candidateIds.length, 1);
  assert.equal(mapped[0].businessDisposition, null);
  assert.deepEqual(mapped[1].candidateIds, []);
  assert.equal(mapped[1].disposition, "unresolved-source-moved-or-removed");
});

test("import reachability is cycle-safe and does not include unrelated modules", () => {
  const modules = new Map([
    ["root.vue", { dependencies: ["child.vue", "helper.ts"] }],
    ["child.vue", { dependencies: ["root.vue"] }],
    ["helper.ts", { dependencies: [] }],
    ["unrelated.vue", { dependencies: [] }],
  ]);
  assert.deepEqual([...reachableFiles("root.vue", modules)].sort(), [
    "child.vue",
    "helper.ts",
    "root.vue",
  ]);
});

test("malformed SFC fails closed instead of producing a partial success inventory", () => {
  assert.throws(() => scan(`<template><button></template>`));
});

test("type-only imports and router metadata do not attribute every app route to each page", () => {
  const result = scan(`<script setup lang="ts">
import type { Shell } from '../shell';
import { type Role } from '../roles';
import { navigate } from '../navigation';
</script><template><button>确定</button></template>`);
  assert.deepEqual(result.imports, ["../navigation"]);
  const modules = new Map([
    ["page.vue", { dependencies: ["routes.ts", "dialog.vue"] }],
    ["routes.ts", { dependencies: ["App.vue"] }],
    ["App.vue", { dependencies: ["unrelated.vue"] }],
  ]);
  assert.deepEqual(
    [...reachableFiles("page.vue", modules, new Set(["routes.ts"]))],
    ["page.vue", "routes.ts", "dialog.vue"],
  );
});

test("historical AST mapping survives line and style edits and rejects changed actions at reused lines", () => {
  const old = scan(
    `<template><button class="old" @click="save">保存</button></template>`,
  ).candidates;
  const current = scan(
    `<template><button @click="remove">删除</button>\n<button class="new" @click="save">保存</button></template>`,
  ).candidates;
  const entries = [{ legacyId: "button-1", file: filename, line: 1, type: "button" }];
  const mapping = reconcileLegacy(entries, current, old)[0];
  assert.equal(mapping.candidateIds[0], current[1].candidateId);
  assert.equal(mapping.businessDisposition, null);
  assert.equal(old[0].candidateId, current[1].candidateId);
});

test("one legacy regex span can correspond to multiple real AST controls without losing either", () => {
  const source = `<template><button>市场</button><button>竞争</button></template>`;
  const items = scan(source).candidates;
  const entries = [{ legacyId: "button-1", file: filename, line: 1, type: "button" }];
  const mapped = reconcileLegacy(entries, items, items, [
    { legacyId: "button-1", start: 10, end: source.length },
  ])[0];
  assert.equal(mapped.candidateIds.length, 2);
  assert.equal(mapped.disposition, "historical-source-match-needs-semantic-review");
  assert.equal(mapped.businessDisposition, null);
});
