import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { previewMysqlPage } from "../../scripts/lib/mysql-page-preview.mjs";

const source = readFileSync("apps/web/src/components/MySqlResilienceCenter.vue", "utf8");
const preview = parse(previewMysqlPage(source)).descriptor;
const original = parse(source).descriptor;

test("P68 C review preserves the production script and Vue compilation", () => {
  assert.equal(preview.scriptSetup.content, original.scriptSetup.content);
  assert.ok(preview.template.content.includes("<h1>MySQL 运行核验</h1>"));
  assert.doesNotMatch(
    preview.template.content,
    /mysql-resilience__metrics|mysql-resilience__impact/,
  );
  assert.match(original.template.content, /mysql-resilience--c/);
  assert.match(original.styles[0].content, /mysql-resilience-c\.css/);
});

test("P68 C review separates runtime evidence, recovery and actual-to-target durability", () => {
  const template = preview.template.content;
  for (const id of [
    "p68-resource-grid",
    "p68-measurements",
    "p68-recovery",
    "p68-durability",
    "p68-contract",
  ])
    assert.ok(template.includes(id), id);
  assert.match(template, /未知不填0/);
  assert.match(template, /不新增读副本、负载均衡或备用服务器/);
  assert.match(template, /不发起备份或恢复/);
});

test("P68 C review exposes the same visible focus treatment for native actions", () => {
  const css = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/implementation/mysql-page-preview.css",
    "utf8",
  );
  assert.match(css, /mysql-resilience--review button:focus-visible/);
  assert.match(css, /outline:\s*3px solid #2465d7/);
});
