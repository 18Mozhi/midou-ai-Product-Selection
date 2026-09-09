import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { ref, reactive, computed, watch, effectScope, nextTick } from "vue";

export async function verifyCostRulesSource() {
  const source = await readFile("apps/web/src/components/CostRuleConsole.vue", "utf8");
  let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const ast = ts.createSourceFile("setup.ts", script, ts.ScriptTarget.Latest, true);
  for (const n of [...ast.statements].reverse())
    if (ts.isImportDeclaration(n)) script = script.slice(0, n.pos) + script.slice(n.end);
  const expose =
    "form,createValidation,create,openCreate,closeCreate,showCreate,createError,busy,load,rules,selected,state,notice,search,statusFilter,page,pageCount,pagedRules,returnPath,canManage,canSelection,canAdmin,rollbackTargets,beginAction,submitAction,closeAction,actionReason,actionError,showAction,rollbackTargetId,activeCostRule";
  const js = ts.transpileModule(script + `\nreturn {${expose}};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const scopes = [],
    checks = [];
  class ApiClientError extends Error {
    constructor(code = "cost_rule_revision_conflict") {
      super("isolated failure");
      Object.assign(this, {
        code,
        kind: "conflict",
        requestId: "isolated",
        userMessage: "隔离失败",
        actionHint: "请核对版本",
      });
    }
  }
  function setup(props = {}, query = {}) {
    const calls = [],
      replies = [],
      route = { query },
      scope = effectScope();
    scopes.push(scope);
    const env = {
      ref,
      reactive,
      computed,
      watch,
      ApiClientError,
      onMounted: () => {},
      defineProps: () => ({
        apiBaseUrl: "inert",
        capabilities: ["opportunity:approve"],
        roles: ["selection_manager", "organization_admin"],
        ...props,
      }),
      useRoute: () => route,
      useRouter: () => ({
        replace: (v) => {
          route.query = v.query;
        },
        push: () => {},
      }),
      useModalDialog: () => ({ dialogElement: ref(null), handleCancel: () => {} }),
      createApiClient: () => async (url, options) => {
        calls.push({ url, options: options ? JSON.parse(JSON.stringify(options)) : undefined });
        assert.ok(replies.length, url);
        const r = await replies.shift();
        if (r instanceof Error) throw r;
        return r;
      },
    };
    return {
      ...scope.run(() => new Function(...Object.keys(env), js)(...Object.values(env))),
      calls,
      replies,
      route,
    };
  }
  const rule = (id, status = "draft", market = "US", platform = "amazon") => ({
    id,
    status,
    market,
    platform,
    name: id,
    version_code: id,
    revision: 7,
    fee_lines: [],
    conversion_rates: [],
    automatic_scope: null,
    effective_from: "2026-09-09",
    approvals: [],
    published_at: null,
    updated_at: "2026-09-09",
  });
  const ok = (data) => ({ data, request_id: "isolated" });
  const valid = (s) =>
    Object.assign(s.form, {
      version_code: " v6 ",
      name: " 规则 ",
      platform_fee: 0,
      payment_fee: 0,
      tax: 0,
      fulfillment: 0,
    });
  try {
    let s = setup();
    s.openCreate();
    for (const f of ["platform_fee", "payment_fee", "tax", "fulfillment"])
      assert.equal(s.form[f], "");
    await s.create();
    assert.equal(s.calls.length, 0);
    valid(s);
    assert.equal(s.createValidation.value, "");
    s.replies.push(new ApiClientError("cost_rule_version_conflict"));
    await s.create();
    assert.deepEqual(s.calls[0].options.body.fee_lines, [
      ...["platform_fee", "payment_fee", "tax"].map((type) => ({
        type,
        mode: "percentage_of_sale",
        value: 0,
        currency: null,
      })),
      { type: "fulfillment", mode: "fixed_amount", value: 0, currency: "USD" },
    ]);
    assert.deepEqual(s.calls[0].options.body.conversion_rates, []);
    assert.equal(s.calls[0].options.body.automatic_scope, null);
    assert.equal(s.showCreate.value, true);
    assert.equal(s.form.platform_fee, 0);
    s.closeCreate();
    s.openCreate();
    assert.equal(s.form.platform_fee, "");
    assert.equal(s.form.name, "");
    checks.push(
      "Actual create: blank mandatory fees block POST; explicit zero retained; optional lines omitted; conflict retains; reopening resets",
    );
    valid(s);
    Object.assign(s.form, {
      currency: "EUR",
      logistics: 0,
      conversion_rate: 0.13,
      conversion_effective_on: "2026-09-08",
      conversion_source_url: "https://example.com/rate",
      automatic_product_family: "phone_case",
    });
    assert.equal(s.createValidation.value, "");
    s.replies.push(new ApiClientError());
    await s.create();
    const b = s.calls.at(-1).options.body;
    assert.equal(b.fee_lines.at(-1).type, "logistics");
    assert.equal(b.fee_lines.at(-1).value, 0);
    assert.equal(b.conversion_rates[0].quote_currency, "EUR");
    assert.deepEqual(b.automatic_scope, { product_family: "phone_case" });
    s.form.platform = "other";
    assert.ok(s.createValidation.value);
    s.form.platform = "amazon";
    s.form.conversion_source_url = "http://example.com";
    assert.ok(s.createValidation.value);
    checks.push(
      "Actual optional zero logistics/phone_case and CNY->form currency; non-Amazon and HTTP source rejected locally; server checks not implied",
    );
    for (const [roles, caps, a, b] of [
      [[], ["opportunity:approve"], false, false],
      [["selection_manager"], ["opportunity:approve"], true, false],
      [["organization_admin"], ["opportunity:approve"], false, true],
      [["selection_manager"], [], false, false],
    ]) {
      s = setup({ roles, capabilities: caps });
      assert.equal(s.canSelection.value, a);
      assert.equal(s.canAdmin.value, b);
      if (!caps.length) {
        s.openCreate();
        assert.equal(s.showCreate.value, false);
      }
    }
    checks.push(
      "Actual capability plus real-role computeds remain separate; read-only creation opener unavailable",
    );
    s = setup();
    s.rules.value = [
      rule("active", "active"),
      rule("retired", "retired"),
      rule("approved", "approved"),
      rule("wrong-market", "retired", "CA"),
      rule("wrong-platform", "retired", "US", "other"),
    ];
    s.selected.value = s.rules.value[0];
    assert.deepEqual(
      s.rollbackTargets.value.map((r) => r.id),
      ["retired", "approved"],
    );
    checks.push(
      "Actual rollback candidates exclude self and cross-market/platform; only approved/retired",
    );
    for (const [action, role] of [
      ["submit"],
      ["approve", "selection_manager"],
      ["reject", "selection_manager"],
      ["approve", "organization_admin"],
      ["reject", "organization_admin"],
      ["publish"],
      ["rollback"],
    ]) {
      s = setup();
      s.selected.value = rule("target");
      s.rules.value = [s.selected.value, rule("restore", "retired")];
      s.beginAction(action, role);
      s.actionReason.value = " ";
      await s.submitAction();
      assert.equal(s.calls.length, 0);
      s.actionReason.value = "  核对依据  ";
      s.replies.push(new ApiClientError());
      await s.submitAction();
      assert.deepEqual(s.calls[0].options.body, {
        action,
        reason: "核对依据",
        expected_revision: 7,
        ...(role ? { approval_role: role } : {}),
        ...(action === "rollback" ? { target_rule_id: "restore" } : {}),
      });
      assert.equal(s.actionReason.value, "  核对依据  ");
      assert.equal(s.showAction.value, true);
      s.closeAction();
      assert.equal(s.calls.length, 1);
    }
    checks.push(
      "All seven actual action bodies have exact role/revision/target fields, trimmed reason; conflict retained and cancel has no replay",
    );
    s = setup();
    s.selected.value = rule("target");
    s.beginAction("submit");
    s.actionReason.value = "核对依据";
    let resolve;
    s.replies.push(new Promise((r) => (resolve = r)));
    const first = s.submitAction();
    await s.submitAction();
    s.closeAction();
    assert.equal(s.calls.length, 1);
    assert.equal(s.showAction.value, true);
    resolve(new ApiClientError());
    await first;
    checks.push(
      "Actual POST single-flight guard blocks duplicate and busy close without canceling request",
    );
    for (const [from, expected] of [
      ["/sourcing?record=one", "/sourcing?record=one"],
      ["//example.com", "/sourcing"],
      ["/sourcing-other", "/sourcing"],
      ["https://example.com", "/sourcing"],
    ]) {
      s = setup({}, { from });
      assert.equal(s.returnPath.value, expected);
    }
    s = setup({}, { rule: "r12" });
    s.replies.push(ok(Array.from({ length: 12 }, (_, i) => rule("r" + (i + 1)))));
    await s.load();
    await nextTick();
    assert.equal(s.selected.value.id, "r12");
    assert.equal(s.page.value, 2);
    s.search.value = "r1";
    await nextTick();
    assert.equal(s.page.value, 1);
    assert.equal(s.pagedRules.value.length, 4);
    checks.push(
      "Actual bounded safe from, initial rule selection on page2, search resets pagination; history/encoded query matrix unproven",
    );
    s = setup();
    s.openCreate();
    valid(s);
    const draft = rule("new");
    s.replies.push(ok(draft), ok([draft]));
    await s.create();
    assert.equal(s.selected.value.status, "draft");
    assert.match(s.notice.value, /草稿已创建/);
    assert.equal(s.showCreate.value, false);
    checks.push(
      "Actual successful creation remains draft then reloads; no automatic approval/publish",
    );
    s = setup();
    let late;
    s.replies.push(new Promise((r) => (late = r)), ok([rule("new-scope")]));
    const old = s.load();
    await s.load();
    late(ok([rule("old-scope")]));
    await old;
    assert.equal(s.rules.value[0].id, "old-scope");
    checks.push(
      "UNFIXED SC-G05: late earlier GET overwrites later list in actual setup; draft snapshot alone is not a Vue lifecycle fix",
    );
    return {
      checks,
      limits:
        "Actual Vue setup extracted with inert transport/router and modal hook. No mounted DOM, real auth, SQL, publish, rollback, audit, Worker, global lifecycle or approval proof.",
    };
  } finally {
    scopes.forEach((s) => s.stop());
  }
}
if (process.argv[1]?.endsWith("verify-ui-phase2-cost-rules-source.mjs"))
  console.log(JSON.stringify(await verifyCostRulesSource()));
