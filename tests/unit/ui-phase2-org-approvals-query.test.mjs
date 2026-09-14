import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { reactive, ref, computed, watch, effectScope, nextTick } from "vue";

const source = readFileSync("apps/web/src/components/OrganizationApprovalPanel.vue", "utf8");
const ast = ts.createSourceFile(
  "panel.ts",
  parse(source).descriptor.scriptSetup.content,
  ts.ScriptTarget.Latest,
  true,
);
const script = ast.statements
  .filter((n) => !ts.isImportDeclaration(n))
  .map((n) => n.getFullText(ast))
  .join("\n");
const plain = (v) => JSON.parse(JSON.stringify(v));
const keys =
  "section requestQuery requestStatus requestWorkspace requestResource requestSort requestPage templateQuery templateStatus templateWorkspace templateResource templateSort templatePage selectedTemplateId resetRequests resetTemplates".split(
    " ",
  );
async function flush() {
  await nextTick();
  await nextTick();
}
function harness(query = {}, options = {}) {
  const route = reactive({ path: options.path ?? "/org-admin/approvals", query });
  const calls = [],
    pending = [];
  const props = reactive({
    ownerPath: options.ownerPath,
    templates: Array.from({ length: 14 }, (_, i) => ({
      id: `t${i}`,
      name: `模板${i}`,
      workspace_name: "采购",
      resource_type: "task",
      status: "published",
      current_version: i + 1,
      node_count: 2,
    })),
    approvals: Array.from({ length: 24 }, (_, i) => ({
      id: `a${i}`,
      title: `审批${i}`,
      template_id: `t${i % 14}`,
      status: "pending",
      resource_type: "task",
      created_at: "2026-08-26",
    })),
    summary: { pending: 24 },
  });
  const scope = effectScope();
  const h = scope.run(() => {
    const box = {
      exports: {},
      ref,
      computed,
      watch,
      nextTick,
      defineProps: () => props,
      useRoute: () => route,
      useRouter: () => ({
        replace: (value) => {
          calls.push(plain(value));
          return new Promise((resolve, reject) =>
            pending.push({ query: plain(value.query), resolve, reject }),
          );
        },
      }),
    };
    vm.runInNewContext(
      ts.transpileModule(script + `\nexport const h={${keys.join(",")}};`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText,
      box,
    );
    return box.exports.h;
  });
  return {
    h,
    route,
    calls,
    props,
    pending,
    stop: () => scope.stop(),
    complete: async (index = pending.length - 1) => {
      route.query = pending[index].query;
      pending[index].resolve();
      await flush();
    },
  };
}
test("P34 external same-instance URL restores both views and pages without writing back", async () => {
  const t = harness();
  try {
    t.route.query = {
      keep: "yes",
      approval_view: "templates",
      approval_request_status: "pending",
      approval_request_page: "2",
      approval_template_workspace: "采购",
      approval_template_sort: "nodes_desc",
      approval_template_page: "2",
    };
    await flush();
    assert.equal(t.h.section.value, "templates");
    assert.equal(t.h.requestStatus.value, "pending");
    assert.equal(t.h.requestPage.value, 2);
    assert.equal(t.h.templatePage.value, 2);
    assert.equal(t.h.templateWorkspace.value, "采购");
    assert.equal(t.h.templateSort.value, "nodes_desc");
    assert.equal(t.calls.length, 0);
    t.route.query = {};
    await flush();
    assert.equal(t.h.section.value, "requests");
    assert.equal(t.h.requestStatus.value, "all");
    assert.equal(t.h.templateWorkspace.value, "all");
    assert.equal(t.h.requestPage.value, 1);
    assert.equal(t.h.templatePage.value, 1);
    assert.equal(t.calls.length, 0);
  } finally {
    t.stop();
  }
});
test("P34 restoring query and page together does not let filter watchers reset the page", async () => {
  const t = harness();
  try {
    t.route.query = {
      approval_request_query: "审批",
      approval_request_status: "pending",
      approval_request_resource: "task",
      approval_request_sort: "title_asc",
      approval_request_page: "3",
      approval_template_query: "模板",
      approval_template_status: "published",
      approval_template_resource: "task",
      approval_template_page: "2",
    };
    await flush();
    assert.equal(t.h.requestPage.value, 3);
    assert.equal(t.h.templatePage.value, 2);
    assert.equal(t.h.requestQuery.value, "审批");
    assert.equal(t.h.templateQuery.value, "模板");
    t.h.requestQuery.value = "审批1";
    await flush();
    assert.equal(t.h.requestPage.value, 1);
    assert.equal(t.h.templatePage.value, 2);
    assert.equal(t.calls.length, 1);
  } finally {
    t.stop();
  }
});
test("P34 restored inputs use the same existing parser and do not normalize the incoming URL", async () => {
  const t = harness();
  try {
    const query = {
      approval_view: "bad",
      approval_request_query: "x".repeat(220),
      approval_request_page: "2.5",
      approval_template_status: ["draft"],
      approval_template_page: "-1",
    };
    t.route.query = query;
    await flush();
    assert.equal(t.h.section.value, "requests");
    assert.equal(t.h.requestQuery.value.length, 200);
    assert.equal(t.h.requestPage.value, 1);
    assert.equal(t.h.templateStatus.value, "all");
    assert.equal(t.h.templatePage.value, 1);
    assert.deepEqual(plain(t.route.query), query);
    assert.equal(t.calls.length, 0);
  } finally {
    t.stop();
  }
});
test("P34 own URL writes retain unrelated query and do not reset later local input", async () => {
  const t = harness({ keep: "yes" });
  try {
    t.h.requestQuery.value = "审批";
    await flush();
    t.h.requestQuery.value = "审批1";
    await flush();
    assert.equal(t.calls.length, 2);
    assert.equal(t.calls[1].query.keep, "yes");
    await t.complete(0);
    assert.equal(t.h.requestQuery.value, "审批1");
    await t.complete(1);
    assert.equal(t.h.requestQuery.value, "审批1");
    assert.equal(t.calls.length, 2);
    t.h.resetRequests();
    await flush();
    assert.equal(t.calls.at(-1).query.approval_request_query, undefined);
    assert.equal(t.calls.at(-1).query.keep, "yes");
  } finally {
    t.stop();
  }
});
test("P34 local typed text is not truncated by acknowledgement of its own URL write", async () => {
  const t = harness();
  try {
    t.h.requestQuery.value = "x".repeat(220);
    await flush();
    await t.complete();
    assert.equal(t.h.requestQuery.value.length, 220);
    assert.equal(t.calls.length, 1);
  } finally {
    t.stop();
  }
});
test("P34 unrelated route cannot hydrate or receive stale panel query writes", async () => {
  const t = harness();
  try {
    t.h.requestQuery.value = "保留当前筛选";
    await flush();
    await t.complete();
    t.route.path = "/org-admin/members";
    t.route.query = { member_query: "成员" };
    await flush();
    assert.equal(t.h.requestQuery.value, "保留当前筛选");
    t.h.templateQuery.value = "后台数据变化";
    await flush();
    assert.equal(t.calls.length, 1);
    t.route.path = "/org-admin/approvals";
    t.route.query = { approval_request_query: "返回页面" };
    await flush();
    assert.equal(t.h.requestQuery.value, "返回页面");
    assert.equal(t.calls.length, 1);
  } finally {
    t.stop();
  }
});
test("P34 first created while cached restores its owning route without writing into the destination", async () => {
  const t = harness(
    { keep: "destination" },
    {
      path: "/org-admin",
      ownerPath: "/org-admin/approvals",
    },
  );
  try {
    t.h.templateQuery.value = "缓存期间";
    await flush();
    assert.equal(t.calls.length, 0);
    t.route.path = "/org-admin/approvals";
    t.route.query = {
      approval_view: "templates",
      approval_template_query: "采购",
      keep: "external",
    };
    await flush();
    assert.equal(t.h.section.value, "templates");
    assert.equal(t.h.templateQuery.value, "采购");
    assert.equal(t.calls.length, 0);
    t.h.templateQuery.value = "新筛选";
    await flush();
    assert.equal(t.calls.length, 1);
    assert.equal(t.calls[0].query.keep, "external");
    assert.equal(t.calls[0].query.approval_template_query, "新筛选");
  } finally {
    t.stop();
  }
});
test("P34 parent supplies its owned path to a potentially late-created panel", () => {
  const parent = readFileSync("apps/web/src/components/OrganizationAdminCenter.vue", "utf8");
  assert.match(
    parent,
    /<OrganizationApprovalPanel\s+v-else-if="view === 'approvals'"\s+:owner-path="props.routePath"/,
  );
});
test("P34 rapid external query changes keep latest route and cleanup after scope disposal", async () => {
  const t = harness();
  t.route.query = { approval_view: "templates" };
  t.route.query = { approval_request_query: "最后一次" };
  await flush();
  assert.equal(t.h.section.value, "requests");
  assert.equal(t.h.requestQuery.value, "最后一次");
  t.stop();
  t.route.query = { approval_request_query: "停止之后" };
  await flush();
  assert.equal(t.h.requestQuery.value, "最后一次");
  assert.equal(t.calls.length, 0);
});
