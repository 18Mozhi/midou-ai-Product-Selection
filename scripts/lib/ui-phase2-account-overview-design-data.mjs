import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildAccountOverviewDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8"),
    parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  function find(ast, predicate) {
    const out = [];
    function visit(n) {
      if (predicate(n)) out.push(n);
      ts.forEachChild(n, visit);
    }
    visit(ast);
    return out;
  }
  function run(source, bindings = {}) {
    const box = { ...bindings };
    vm.runInNewContext(
      ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
        .outputText,
      box,
    );
    return box.__result;
  }
  const fixture = parse(await read("tests/e2e/m06-01-platform-accounts.spec.ts"));
  const vars = ["user", "org", "overview"]
    .map((name) => {
      const n = find(
        fixture,
        (n) => ts.isVariableDeclaration(n) && n.name.getText(fixture) === name,
      );
      assert.equal(n.length, 1);
      return `const ${name}=${n[0].initializer.getText(fixture)};`;
    })
    .join("\n");
  const overview = plain(run(vars + "globalThis.__result=overview;"));
  assert.equal(overview.organizations.length, 1);
  assert.equal(overview.summary.organizations, 3);
  const vue = await read("apps/web/src/components/PlatformAccountCenter.vue"),
    ast = parse(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const script = ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n");
  class ApiClientError extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
      this.actionHint = "synthetic " + kind;
    }
  }
  const keys =
    "query status data rows state message refreshing busy createUserOpen createUserError userForm createOpen form organizationDetailOpen selected organizationForm accountOverviewRoute organizationListRoute organizationEmptyState activeFilterCount load applyFilters resetFilters openCreateUser closeCreateUser createUser openOrganizationWizard closeOrganizationWizard openOrganization closeOrganizationDetail createOrganization".split(
      " ",
    );
  function harness(query = {}) {
    const calls = [],
      watchers = [],
      timers = new Map(),
      route = { query },
      pushes = [],
      replaces = [],
      props = {
        apiBaseUrl: "fixture",
        routePath: "/platform-admin/accounts",
        initialTab: "organizations",
        organizationId: "",
      };
    let mode = "success",
      resolveRead,
      resolveWrite,
      clock = 0;
    const h = run(script + "\nglobalThis.__result={" + keys.join(",") + "};", {
      defineProps: () => props,
      withDefaults: (v) => v,
      ref: (value) => ({ value }),
      reactive: (v) => v,
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      onMounted: () => {},
      watch: (s, cb) => watchers.push({ s, cb }),
      nextTick: async () => {},
      useRoute: () => route,
      useRouter: () => ({
        push: async (v) => pushes.push(plain(v)),
        replace: async (v) => {
          replaces.push(plain(v));
          if (v.query) route.query = v.query;
        },
      }),
      usePlatformUserDetail: () => ({
        detailOpen: { value: false },
        detail: { value: null },
        detailError: { value: "" },
        detailSuccess: { value: "" },
        captureDetailAction: () => () => true,
        closeUserDetail: () => {},
        openUserDetail: async () => {},
      }),
      URLSearchParams,
      AbortController,
      DOMException,
      ApiClientError,
      window: {
        setTimeout: (f, ms) => {
          assert.equal(ms, 12000);
          timers.set(++clock, f);
          return clock;
        },
        clearTimeout: (id) => timers.delete(id),
      },
      createApiClient:
        () =>
        (url, options = {}) => {
          calls.push({
            path: url,
            ...plain(Object.fromEntries(Object.entries(options).filter(([k]) => k !== "signal"))),
          });
          if (options.method) {
            if (mode === "hold-write")
              return new Promise((r) => {
                resolveWrite = r;
              });
            return Promise.resolve({ data: { id: "synthetic-created" } });
          }
          if (mode === "hold-read")
            return new Promise((res, rej) => {
              resolveRead = res;
              options.signal.addEventListener("abort", () =>
                rej(new DOMException("fixture", "AbortError")),
              );
            });
          if (mode.startsWith("error")) return Promise.reject(new ApiClientError(mode));
          return Promise.resolve({ data: plain(overview) });
        },
    });
    return {
      h,
      calls,
      watchers,
      route,
      pushes,
      replaces,
      timers,
      mode: (v) => {
        mode = v;
      },
      resolveRead: (data = overview) => resolveRead({ data: plain(data) }),
      resolveWrite: () => resolveWrite({ data: { id: "synthetic-created" } }),
    };
  }
  const a = harness({ keep: "yes" });
  await a.h.load();
  assert.equal(a.calls.length, 1);
  assert.equal(a.h.accountOverviewRoute.value, true);
  assert.equal(a.h.organizationListRoute.value, false);
  assert.equal(a.h.rows.value.length, 1);
  a.h.query.value = " buyer@example.test ";
  a.h.status.value = "disabled";
  await a.h.applyFilters();
  assert.deepEqual(a.replaces[0], {
    query: { keep: "yes", query: "buyer@example.test", status: "disabled" },
  });
  a.watchers[2].cb([a.route.query.query, a.route.query.status]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    a.calls.at(-1).path,
    "/platform/accounts?query=buyer%40example.test&status=disabled",
  );
  assert.equal(a.h.rows.value[0].name, overview.organizations[0].name); // This original mock ignores query; not a SQL-filter result.
  await a.h.resetFilters();
  assert.deepEqual(a.replaces.at(-1), { query: { keep: "yes" } });
  assert.equal(
    harness({ query: "x".repeat(150), status: "s".repeat(50) }).h.query.value.length,
    120,
  );
  const sourcePaths = {};
  await a.h.openOrganizationWizard();
  sourcePaths.create = a.pushes.at(-1);
  await a.h.closeOrganizationWizard();
  sourcePaths.cancelCreate = a.replaces.at(-1);
  await a.h.openOrganization(overview.organizations[0]);
  sourcePaths.detail = a.pushes.at(-1);
  await a.h.closeOrganizationDetail();
  sourcePaths.closeDetail = a.replaces.at(-1);
  assert.equal(sourcePaths.cancelCreate, "/platform-admin/organizations");
  assert.equal(sourcePaths.closeDetail, "/platform-admin/organizations");
  const b = harness();
  await b.h.load();
  b.mode("hold-read");
  const first = b.h.load();
  b.route.query = { query: "new-query" };
  b.watchers[2].cb(["new-query", ""]);
  assert.equal(b.calls.length, 2);
  b.resolveRead();
  await first;
  assert.equal(b.h.query.value, "new-query");
  assert.equal(b.h.data.value.organizations[0].name, overview.organizations[0].name);
  assert.equal(b.calls.length, 2);
  for (const kind of ["error-forbidden", "error-expired", "error-network"]) {
    b.mode(kind);
    await b.h.load();
    assert.equal(b.h.state.value, "ready");
  }
  const timeout = harness();
  timeout.mode("hold-read");
  const wait = timeout.h.load();
  [...timeout.timers.values()][0]();
  await wait;
  assert.equal(timeout.h.state.value, "error");
  assert.equal(timeout.timers.size, 0);
  const c = harness();
  await c.h.load();
  c.h.openCreateUser();
  c.h.userForm.email = "synthetic@example.test";
  c.h.userForm.temporary_password = "SyntheticOnly-12";
  await c.h.createUser();
  const createBody = c.calls.find((r) => r.method === "POST").body;
  assert.deepEqual(createBody, {
    email: "synthetic@example.test",
    temporary_password: "SyntheticOnly-12",
    platform_role_code: null,
    organization_id: null,
    organization_role_code: "member",
  });
  c.h.openCreateUser();
  c.h.userForm.temporary_password = "SyntheticOnly-12";
  c.h.closeCreateUser();
  assert.equal(c.h.userForm.temporary_password, "SyntheticOnly-12");
  c.h.openCreateUser();
  c.h.userForm.email = "old@example.test";
  c.h.userForm.temporary_password = "SyntheticOnly-12";
  c.mode("hold-write");
  const pending = c.h.createUser();
  c.h.closeCreateUser();
  c.h.openCreateUser();
  c.h.userForm.email = "new@example.test";
  c.mode("success");
  c.resolveWrite();
  await pending;
  assert.equal(c.h.createUserOpen.value, false);
  assert.equal(c.h.userForm.email, "new@example.test");
  const d = harness();
  await d.h.load();
  d.h.openCreateUser();
  d.h.userForm.email = "synthetic@example.test";
  d.h.userForm.temporary_password = "SyntheticOnly-12";
  d.mode("error-read");
  await d.h.createUser();
  assert.equal(d.h.createUserOpen.value, false);
  assert.match(d.h.message.value, /账号已创建/);
  assert.doesNotMatch(d.h.message.value, /读取/);
  const service = parse(await read("apps/api/src/platform-account-service.ts"));
  const method = find(
    service,
    (n) => ts.isMethodDeclaration(n) && n.name.getText(service) === "overview",
  )[0];
  const serviceRead = run(
    "const obj={" + method.getText(service) + "};globalThis.__result=obj.overview;",
    {},
  );
  const serviceArgs = serviceRead.call(
    { repository: { overview: (v) => plain(v) } },
    " x " + "a".repeat(200),
    "active" + "s".repeat(50),
  );
  assert.equal(serviceArgs.limit, 200);
  assert.equal(serviceArgs.query.length, 120);
  assert.equal(serviceArgs.status.length, 30);
  const repository = parse(await read("apps/api/src/mysql-platform-account-repository.ts"));
  const repoMethod = find(
    repository,
    (n) => ts.isMethodDeclaration(n) && n.name.getText(repository) === "overview",
  )[0];
  const repoRead = run(
    "const obj={" + repoMethod.getText(repository) + "};globalThis.__result=obj.overview;",
    { iso: (v) => (v ? new Date(v).toISOString() : null) },
  );
  const queries = [];
  await repoRead.call(
    {
      pool: {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [[]];
        },
      },
    },
    { query: "%_\\", status: "disabled", limit: 200 },
  );
  assert.equal(queries.length, 4);
  assert.equal(queries[0].params[1], "%\\%\\_\\\\%");
  assert.deepEqual(plain(queries[3].params), []);
  assert.match(queries[0].sql, /o\.name LIKE/);
  assert.match(queries[0].sql, /o\.slug/);
  assert.doesNotMatch(queries[0].sql, /u\.email/);
  assert.match(queries[0].sql, /COUNT\(DISTINCT m\.id\)/);
  assert.doesNotMatch(queries[0].sql, /m\.status/);
  const expanded = Array.from({ length: 12 }, (_, i) => ({
    ...overview.organizations[0],
    id: "synthetic-org-" + (i + 1),
    name: i === 0 ? "跨境新品联合研究与供应链协作团队（长名称合成样本）" : "合成组织 " + (i + 1),
    slug: "synthetic-org-" + (i + 1),
    status: i % 4 === 0 ? "archived" : "active",
    member_count: i * 3,
    workspace_count: i % 3,
  }));
  return {
    overview,
    expanded,
    sourcePaths,
    createBody,
    sourceChecks: {
      fixture:
        "Original summary 3/2 organizations, 18/16 users and 2 admins with only one row each preserved; the 12-row variant is synthetic, not a SQL result. The limit200 contract is verified separately in the service and inert query construction.",
      functions:
        "Inert real Vue functions/computed/manual watcher callbacks verify query/status limits, URL replacement, four cross-page paths, null creation fields, pending-read skip and 12000ms abort callback. Service trims 120/30 and fixes limit200; repository construction verifies escaped LIKE, independent arrays and unfiltered summary; no SQL executed.",
      reproduced:
        "Pending read skips changed query; existing data retained on all failures; create write followed by failed reread overwrites failure message; old create completion closes a newly opened create dialog; cancelled password remains in memory until next open.",
      limits:
        "Not mounted Vue, real authorization/API/SQL/transaction/MFA/mail/password hashing or production proof. P41/P42 destination designs remain separate work.",
    },
  };
}
