import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse } from "@vue/compiler-sfc";
import ts from "typescript";
import { computed, effectScope, nextTick, reactive, ref, watch } from "vue";
import { undoTokenQuerySync } from "../../scripts/lib/ui-phase2-token-query-delta.mjs";

const file = "apps/web/src/components/OrganizationTokenPanel.vue";
const current = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const source = parse(current).descriptor.scriptSetup.content;
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const compiled = ts.transpileModule(
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const settle = async () => {
  await nextTick();
  await nextTick();
  await Promise.resolve();
};
function mount(t, query = {}, deferred = false) {
  const scope = effectScope();
  t.after(() => scope.stop());
  const route = reactive({ path: "/org-admin/tokens", query });
  const writes = [];
  const props = reactive({
    tokens: Array.from({ length: 14 }, (_, i) => ({
      id: String(i),
      name: `令牌${i}`,
      status: "active",
      scopes: ["task:read"],
      created_at: `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
    })),
    secret: "",
    busy: false,
    createToken: () => {
      throw Error("write forbidden");
    },
    performTokenAction: () => {
      throw Error("write forbidden");
    },
    dismissSecret: () => {
      throw Error("write forbidden");
    },
  });
  const router = {
    replace: (target) => {
      let resolve, reject;
      const promise = new Promise((a, b) => {
        resolve = a;
        reject = b;
      });
      writes.push({ query: { ...target.query }, resolve, reject });
      if (!deferred) {
        route.query = target.query;
        resolve();
      }
      return promise;
    },
  };
  const globals = {
    computed,
    ref,
    watch,
    nextTick,
    defineProps: () => props,
    useRoute: () => route,
    useRouter: () => router,
  };
  const h = scope.run(() =>
    new Function(
      ...Object.keys(globals),
      `${compiled}\nreturn {tokenQuery,statusFilter,scopeFilter,tokenSort,tokenPage,pageCount,resetFilters,createForm};`,
    )(...Object.values(globals)),
  );
  const state = () => [
    h.tokenQuery.value,
    h.statusFilter.value,
    h.scopeFilter.value,
    h.tokenSort.value,
    h.tokenPage.value,
  ];
  return { route, writes, h, state, props };
}

test("P36 query change is an exact bounded script delta", () => {
  const baseline = execFileSync("git", ["show", `c380b995:${file}`], {
    encoding: "utf8",
  }).replaceAll("\r\n", "\n");
  assert.equal(
    parse(undoTokenQuerySync(current)).descriptor.scriptSetup.content,
    parse(baseline).descriptor.scriptSetup.content,
  );
  assert.throws(() =>
    undoTokenQuerySync(
      current.replace("pendingQueryWrites.has(queryFingerprint(route.query))", "false"),
    ),
  );
});

test("P36 restores four filters and explicit page in one batch without URL echo", async (t) => {
  const { route, state, writes } = mount(t);
  route.query = {
    org_token_query: "令牌",
    org_token_status: "active",
    org_token_scope: "task:read",
    org_token_sort: "name_asc",
    org_token_page: "2",
    keep: "yes",
  };
  await settle();
  assert.deepEqual(state(), ["令牌", "active", "task:read", "name_asc", 2]);
  assert.equal(writes.length, 0);
});

test("P36 default reset retains page while changed filters reset page one", async (t) => {
  const { h, state, route } = mount(t, { org_token_page: "2", keep: "yes" });
  h.resetFilters();
  await settle();
  assert.equal(state()[4], 2);
  h.tokenQuery.value = "令牌";
  await settle();
  assert.equal(state()[4], 1);
  assert.equal(route.query.keep, "yes");
  h.resetFilters();
  await settle();
  assert.deepEqual(route.query, { keep: "yes" });
});

test("P36 same-instance URL normalization matches original readers", async (t) => {
  const { route, state } = mount(t);
  route.query = {
    org_token_query: "长".repeat(220),
    org_token_status: "unknown",
    org_token_scope: ["task:read"],
    org_token_sort: null,
    org_token_page: "0",
  };
  await settle();
  assert.deepEqual(state(), ["长".repeat(200), "all", "all", "created_desc", 1]);
});

test("P36 local long input is not truncated by its own URL acknowledgement", async (t) => {
  const { h, route } = mount(t);
  h.tokenQuery.value = "长".repeat(220);
  await settle();
  assert.equal(h.tokenQuery.value.length, 220);
  assert.equal(route.query.org_token_query.length, 220);
});

test("P36 late own acknowledgements do not roll a newer local input backwards", async (t) => {
  const { h, route, writes } = mount(t, {}, true);
  h.tokenQuery.value = "甲";
  await settle();
  h.tokenQuery.value = "乙";
  await settle();
  assert.equal(writes.length, 2);
  route.query = writes[0].query;
  writes[0].resolve();
  await settle();
  assert.equal(h.tokenQuery.value, "乙");
  route.query = writes[1].query;
  writes[1].resolve();
  await settle();
  assert.equal(h.tokenQuery.value, "乙");
});

test("P36 failed replace is released so an external navigation can restore that value", async (t) => {
  const { h, route, writes } = mount(t, {}, true);
  h.tokenQuery.value = "甲";
  await settle();
  writes[0].reject(Error("cancelled fixture"));
  await settle();
  h.tokenQuery.value = "乙";
  await settle();
  route.query = { org_token_query: "甲" };
  await settle();
  assert.equal(h.tokenQuery.value, "甲");
  writes[1].resolve();
});

test("P36 inactive route cannot receive token query writes; return restores URL", async (t) => {
  const { h, route, state, writes } = mount(t);
  h.createForm.value.name = "未提交草稿";
  route.path = "/other";
  route.query = { other: "retained" };
  await settle();
  h.tokenQuery.value = "隐藏页变化";
  await settle();
  assert.equal(writes.length, 0);
  assert.deepEqual(route.query, { other: "retained" });
  route.path = "/org-admin/tokens";
  await settle();
  assert.deepEqual(state(), ["", "all", "all", "created_desc", 1]);
  assert.equal(h.createForm.value.name, "未提交草稿");
});

test("P36 rapid external restores and shrinking result pages remain coherent", async (t) => {
  const { route, state, h } = mount(t);
  route.query = { org_token_query: "令牌", org_token_page: "2" };
  route.query = { org_token_query: "令牌1", org_token_page: "2" };
  await settle();
  assert.equal(state()[0], "令牌1");
  assert.equal(h.pageCount.value, 1);
  assert.equal(state()[4], 1);
});
