import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { historicalTokenCopySource } from "./ui-phase2-token-copy-baseline.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildOrgTokenDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8"),
    parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  function find(ast, predicate) {
    const out = [];
    function visit(n) {
      if (predicate(n)) out.push(n);
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(out.length, 1);
    return out[0];
  }
  function variable(ast, name) {
    return find(
      ast,
      (n) => ts.isVariableDeclaration(n) && n.name.getText(ast) === name,
    ).initializer.getText(ast);
  }
  function fn(ast, name) {
    return find(ast, (n) => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(ast);
  }
  function run(s, bindings = {}) {
    const box = { ...bindings };
    vm.runInNewContext(
      ts.transpileModule(s, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText,
      box,
    );
    return box.__result;
  }
  const fixture = parse(await read("tests/e2e/m06-01-organization-admin.spec.ts"));
  const tokens = plain(run("globalThis.__result=" + variable(fixture, "organizationTokens")));
  const fixedTime = "2026-08-26T10:00:00.000Z";
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [fixedTime]));
    }
    static now() {
      return Date.parse(fixedTime);
    }
  }
  // Preserve the original OG-G05 reproduction and proposal data, not current acceptance.
  const child = historicalTokenCopySource(
      "apps/web/src/components/OrganizationTokenPanel.vue",
      await read("apps/web/src/components/OrganizationTokenPanel.vue"),
    ),
    ast = parse(child.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const script = ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n");
  const keys =
    "tokenQuery statusFilter scopeFilter tokenSort tokenPage createForm scopeError copyState scopeOptions activeTokens expiringTokens neverUsedTokens inactiveTokens expiryPreview filteredTokens visibleTokens statusLabel scopeLabel daysUntil isExpiring expiryHint toggleScope resetFilters submitCreate copySecret".split(
      " ",
    );
  function harness(query = {}) {
    const props = { tokens: plain(tokens), secret: "synthetic-old-no-authority", busy: false },
      route = { query },
      watches = [],
      replacements = [],
      creates = [],
      clipboard = [];
    let createResult = false,
      resolveCopy;
    props.createToken = async (v) => {
      creates.push(plain(v));
      return createResult;
    };
    const h = run(script + "\nglobalThis.__result={" + keys.join(",") + "};", {
      Date: FixedDate,
      defineProps: () => props,
      useRoute: () => route,
      useRouter: () => ({
        replace: (v) => {
          replacements.push(plain(v));
          return Promise.resolve();
        },
      }),
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      watch: (s, cb) => watches.push({ s, cb }),
      navigator: {
        clipboard: {
          writeText: (value) => {
            clipboard.push(value);
            return new Promise((r) => {
              resolveCopy = r;
            });
          },
        },
      },
    });
    return {
      h,
      props,
      route,
      watches,
      replacements,
      creates,
      clipboard,
      setCreate: (v) => {
        createResult = v;
      },
      resolveCopy: () => resolveCopy(),
    };
  }
  const { h, props, route, watches, replacements, creates, setCreate, resolveCopy, clipboard } =
    harness();
  assert.equal(tokens.length, 8);
  assert.equal(h.activeTokens.value.length, 6);
  assert.equal(h.expiringTokens.value.length, 1);
  assert.equal(h.neverUsedTokens.value.length, 1);
  assert.equal(h.inactiveTokens.value.length, 2);
  assert.equal(h.visibleTokens.value.length, 6);
  h.tokenPage.value = 2;
  assert.equal(h.visibleTokens.value.length, 2);
  h.tokenQuery.value = "报表只读";
  watches[0].cb();
  assert.equal(h.tokenPage.value, 1);
  assert.equal(h.filteredTokens.value.length, 4);
  h.resetFilters();
  h.statusFilter.value = "expiring";
  assert.equal(h.filteredTokens.value[0].id, tokens[0].id);
  h.statusFilter.value = "never_used";
  assert.equal(h.filteredTokens.value[0].id, tokens[1].id);
  h.resetFilters();
  const oracle = {};
  for (const sort of ["created_desc", "expires_asc", "last_used_desc", "name_asc", "status_asc"]) {
    h.tokenSort.value = sort;
    oracle[sort] = plain(h.filteredTokens.value.map((r) => r.id));
  }
  h.resetFilters();
  h.tokenPage.value = 1;
  h.scopeFilter.value = "task:read";
  assert.equal(h.filteredTokens.value.length, 4);
  route.query.keep = "retained";
  watches[2].cb();
  assert.equal(replacements[0].query.org_token_scope, "task:read");
  assert.equal(replacements[0].query.keep, "retained");
  assert.equal(replacements[0].query.org_token_page, undefined);
  route.query.org_token_scope = "report:read";
  assert.equal(h.scopeFilter.value, "task:read");
  const invalid = harness({
    org_token_query: "x".repeat(220),
    org_token_page: "2.5",
    org_token_scope: ["task:read"],
  }).h;
  assert.equal(invalid.tokenQuery.value.length, 200);
  assert.equal(invalid.tokenPage.value, 1);
  assert.equal(invalid.scopeFilter.value, "all");
  await h.submitCreate();
  assert.equal(creates.length, 0);
  assert.match(h.scopeError.value, /至少/);
  h.toggleScope("task:read");
  assert.equal(h.scopeError.value, "");
  h.toggleScope("task:read");
  assert.equal(h.createForm.value.scopes.length, 0);
  const body = {
    name: "隔离生命周期测试",
    scopes: ["task:read"],
    ttl_days: 90,
    reason: "验证一次性展示边界",
  };
  h.createForm.value = {
    ...plain(body),
    name: " " + body.name + " ",
    ttl_days: "90",
    reason: " " + body.reason + " ",
  };
  await h.submitCreate();
  assert.deepEqual(creates[0], body);
  assert.equal(h.createForm.value.name, " " + body.name + " ");
  setCreate(true);
  await h.submitCreate();
  assert.deepEqual(plain(h.createForm.value), { name: "", scopes: [], ttl_days: 90, reason: "" });
  h.createForm.value.ttl_days = 0;
  assert.match(h.expiryPreview.value, /1–365/);
  h.createForm.value.ttl_days = 365;
  assert.doesNotMatch(h.expiryPreview.value, /有效期需/);
  const expiredYesterday = { ...tokens[0], expires_at: "2026-08-25T10:00:00.000Z" };
  assert.equal(h.isExpiring(expiredYesterday), false);
  assert.equal(h.expiryHint(expiredYesterday), "今天到期");
  const expiredHourAgo = { ...tokens[0], expires_at: "2026-08-26T09:00:00.000Z" };
  assert.equal(h.daysUntil(expiredHourAgo.expires_at), -0);
  assert.equal(h.isExpiring(expiredHourAgo), true);
  const copyPending = h.copySecret();
  assert.equal(clipboard[0], "synthetic-old-no-authority");
  props.secret = "synthetic-new-no-authority";
  watches[3].cb();
  assert.equal(h.copyState.value, "");
  resolveCopy();
  await copyPending;
  assert.equal(h.copyState.value, "copied");
  const parent = parse(
    (await read("apps/web/src/components/OrganizationAdminCenter.vue"))
      .split(/<script setup[^>]*>/)[1]
      .split("</script>")[0],
  );
  const captured = [],
    reasons = [];
  const actions = run(
    fn(parent, "tokenAction") +
      "\n" +
      fn(parent, "createOrganizationToken") +
      "\nglobalThis.__result={tokenAction,createOrganizationToken};",
    {
      secret: { value: "" },
      askAuditedReason: async (v) => {
        reasons.push(plain(v));
        return "隔离操作原因";
      },
      submit: async (...args) => {
        captured.push(plain(args));
        return true;
      },
    },
  );
  await actions.createOrganizationToken(body);
  await actions.tokenAction(tokens[0], "rotate");
  await actions.tokenAction(tokens[0], "revoke");
  assert.deepEqual(captured[0], ["/org/admin/tokens", body, "POST", { preserveForm: true }]);
  for (let i = 1; i <= 2; i++) {
    assert.deepEqual(captured[i], [
      `/org/admin/tokens/${tokens[0].id}/actions`,
      { action: i === 1 ? "rotate" : "revoke", expected_version: 1, reason: "隔离操作原因" },
      "POST",
      { preserveForm: true },
    ]);
    assert.equal(reasons[i - 1].initialValue, "");
  }
  const submitSource = fn(parent, "submit"),
    dismiss = fn(parent, "dismissTokenSecret");
  async function secretCase(timing) {
    let resolveResponse, resolveLoad;
    const apiCalls = [],
      busy = { value: false },
      secret = { value: "" };
    const state = run(
      "let tokenSecretGeneration=0,surfaceActive=true;" +
        submitSource +
        "\n" +
        dismiss +
        "\nglobalThis.__result={submit,dismissTokenSecret,leave:()=>{surfaceActive=false;dismissTokenSecret();},activate:()=>{surfaceActive=true;}};",
      {
        busy,
        secret,
        view: { value: "tokens" },
        form: { value: {} },
        notice: { value: "" },
        noticeKind: { value: "" },
        requestId: { value: "" },
        api: (p, o) => {
          apiCalls.push({ path: p, body: JSON.parse(o.body) });
          return new Promise((r) => {
            resolveResponse = r;
          });
        },
        load: () =>
          new Promise((r) => {
            resolveLoad = r;
          }),
        applyFailure: () => {},
        rethrowUnexpectedError: () => {},
        ApiClientError: class extends Error {},
      },
    );
    const pending = state.submit("/org/admin/tokens", body);
    assert.equal(await state.submit("/org/admin/tokens", body), undefined);
    assert.equal(apiCalls.length, 1);
    if (timing === "late-response") {
      state.leave();
      state.activate();
    }
    resolveResponse({
      data: { secret: "synthetic-response-no-authority" },
      request_id: "synthetic-request",
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.ok(resolveLoad);
    if (timing === "dismiss-during-refresh") state.dismissTokenSecret();
    resolveLoad();
    assert.equal(await pending, true);
    if (timing === "completed") {
      assert.equal(secret.value, "synthetic-response-no-authority");
      state.leave();
      state.activate();
    }
    assert.equal(secret.value, "");
    assert.equal(busy.value, false);
  }
  for (const timing of ["completed", "late-response", "dismiss-during-refresh"])
    await secretCase(timing);
  return {
    tokens,
    fixedTime,
    scopeOptions: plain(h.scopeOptions),
    oracle,
    createBody: body,
    actionBodies: captured.slice(1).map((v) => ({ path: v[0], body: v[1] })),
    sourceChecks: [
      "Actual child computed and explicit watch callbacks: six-row pagination, five sort ID sequences, active/expiring/never-used/historical counts and URL defaults",
      "Actual scope toggle and create submit: no implicit scope, trimmed exact body, failed draft retained and success reset to 90 days/no scopes",
      "OG-G05 reproduced: old clipboard completion marks a replacement secret copied; active past-expiry hints retain today wording and ceil(-fraction) can enter expiring filter",
      "Actual parent create/rotate/revoke bodies and blank reasons; busy guards and three one-time secret generation cases run inertly, not mounted Vue or API proof",
    ],
  };
}
