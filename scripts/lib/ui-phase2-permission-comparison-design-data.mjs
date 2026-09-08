import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildPermissionComparisonDesignData(repo) {
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const run = (s, bindings = {}) => {
    const box = { ...bindings };
    vm.runInNewContext(
      ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
      box,
    );
    return box.result;
  };
  const script = (s) => s.split(/<script setup[^>]*>/)[1].split("</script>")[0];
  const noImports = (ast) =>
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast).replace(/^\s*export /, "\n"))
      .join("\n");
  const fixture = parse(await read("tests/e2e/m06-01-platform-accounts.spec.ts"));
  const declaration = fixture.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => [...n.declarationList.declarations])
    .filter((n) => n.name.getText(fixture) === "platformRoles");
  assert.equal(declaration.length, 1);
  const roles = plain(run(`globalThis.result=${declaration[0].initializer.getText(fixture)};`));
  assert.equal(roles.length, 3);
  assert.equal(new Set(roles.flatMap((r) => r.capabilities)).size, 7);
  const ast = parse(script(await read("apps/web/src/components/PlatformRoleComparison.vue")));
  const ref = (value) => ({ value }),
    computed = (fn) => ({
      get value() {
        return fn();
      },
    });
  function mount(inputRoles = roles, query = {}, persistSelection = true) {
    const props = { roles: plain(inputRoles), persistSelection },
      route = { query: plain(query) },
      watchers = [],
      replaces = [];
    const c = run(
      noImports(ast) +
        "globalThis.result={compareLeft,compareRight,differencesOnly,capabilityQuery,capabilityGroup,capabilityGroups,comparison,comparedRoles,activeFilterCount,resetComparison,capabilityText,groupText};",
      {
        ref,
        computed,
        defineProps: () => props,
        withDefaults: (v) => v,
        useRoute: () => route,
        useRouter: () => ({
          replace: (v) => {
            replaces.push(plain(v));
            route.query = plain(v.query);
          },
        }),
        watch: (source, cb, options) => {
          watchers.push(cb);
          if (options?.immediate) cb(source());
        },
      },
    );
    return { c, props, route, watchers, replaces };
  }
  const controls = [
    "compareLeft",
    "compareRight",
    "differencesOnly",
    "capabilityQuery",
    "capabilityGroup",
  ];
  const cases = [];
  const op = roles[0].code,
    security = roles[1].code,
    superRole = roles[2].code;
  const scenarios = [
    ["default", {}, 6],
    ["all", { differencesOnly: false }, 6],
    ["same-differences", { compareRight: op }, 0],
    ["same-all", { compareRight: op, differencesOnly: false }, 3],
    ["super-operations", { compareLeft: superRole, compareRight: op }, 4],
    [
      "super-operations-all",
      { compareLeft: superRole, compareRight: op, differencesOnly: false },
      7,
    ],
    ["reverse", { compareLeft: security, compareRight: op }, 6],
    ["code-search", { capabilityQuery: "  PLATFORM:  " }, 2],
    ["name-search", { capabilityQuery: "管理" }, 3],
    ["group-security", { capabilityGroup: "安全治理" }, 2],
    ["group-collection", { capabilityGroup: "采集治理" }, 1],
    ["group-reports", { capabilityGroup: "通知与报表" }, 1],
    ["combined", { capabilityQuery: "会话", capabilityGroup: "安全治理" }, 1],
    ["no-match", { capabilityQuery: "不存在的能力" }, 0],
    ["unknown-group", { capabilityGroup: "旧目录分组" }, 0],
  ];
  for (const [key, values, count] of scenarios) {
    const { c } = mount();
    for (const [k, v] of Object.entries(values)) c[k].value = v;
    assert.equal(c.comparison.value.length, count, key);
    cases.push({
      key,
      controls: Object.fromEntries(controls.map((k) => [k, c[k].value])),
      rows: plain(c.comparison.value),
    });
  }
  const { c, watchers, route, replaces } = mount(roles, { keep: "untouched", show_all: "1" });
  assert.equal(c.differencesOnly.value, false);
  assert.equal(c.activeFilterCount.value, 0); // Reset remains disabled when only roles/show_all change.
  c.compareLeft.value = superRole;
  c.capabilityQuery.value = " 会话 ";
  c.capabilityGroup.value = "安全治理";
  watchers[1]();
  assert.deepEqual(route.query, {
    keep: "untouched",
    show_all: "1",
    left_role: superRole,
    capability_query: "会话",
    capability_group: "安全治理",
  });
  c.resetComparison();
  watchers[1]();
  assert.deepEqual(route.query, { keep: "untouched" });
  assert.equal(c.compareRight.value, security);
  route.query = { left_role: superRole }; // Actual component has no reverse route-query watcher.
  assert.equal(c.compareLeft.value, op);
  assert.equal(watchers.length, 2);
  assert.equal(replaces.length, 2);
  const embedded = mount(roles, { left_role: superRole }, false);
  assert.equal(embedded.c.compareLeft.value, op);
  embedded.c.capabilityQuery.value = "会话";
  embedded.watchers[1]();
  assert.deepEqual(embedded.replaces, []);
  const truncated = mount(roles, {
    capability_query: "字".repeat(100),
    capability_group: "组".repeat(60),
    left_role: [superRole],
  });
  assert.equal(truncated.c.capabilityQuery.value.length, 80);
  assert.equal(truncated.c.capabilityGroup.value.length, 40);
  assert.equal(truncated.c.compareLeft.value, op);
  const invalid = mount(roles, { left_role: "retired", right_role: "retired" });
  assert.equal(invalid.c.compareLeft.value, op);
  assert.equal(invalid.c.compareRight.value, security);
  const zero = mount([]);
  assert.equal(zero.c.compareLeft.value, "");
  assert.equal(zero.c.compareRight.value, "");
  zero.props.roles = roles;
  zero.watchers[0](roles);
  assert.equal(zero.c.compareLeft.value, op);
  const single = mount([roles[2]]);
  assert.equal(single.c.compareLeft.value, superRole);
  assert.equal(single.c.compareRight.value, superRole);
  assert.equal(single.c.comparison.value.length, 0);
  single.c.capabilityQuery.value = "管理";
  single.c.resetComparison();
  assert.equal(single.c.comparedRoles.value.left, undefined); // No roles-array change means no fallback rerun.
  assert.equal(single.c.comparedRoles.value.right, undefined);
  const capabilityLabels = Object.fromEntries(
    [...new Set(roles.flatMap((r) => r.capabilities))].map((code) => [
      code,
      { label: c.capabilityText(code), group: c.groupText(code) },
    ]),
  );
  assert.equal(c.capabilityText("synthetic:unknown"), "其他平台权限");
  assert.equal(c.groupText("synthetic:unknown"), "其他能力");
  // Execute the actual read method with inert requests and its real abort callback, not a real 12s network wait.
  const parent = parse(script(await read("apps/web/src/components/PlatformAccountCenter.vue")));
  const method = parent.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name.text === "loadPlatformRoles",
  );
  assert.ok(method);
  class ApiClientError extends Error {
    constructor(hint) {
      super(hint);
      this.actionHint = hint;
    }
  }
  const reads = [],
    timers = [],
    cleared = [],
    platformRoles = ref([]),
    rolesLoading = ref(false),
    rolesError = ref(""),
    lastUpdatedAt = ref(null),
    permissionsRoute = ref(true),
    message = ref("");
  const load = run(method.getFullText(parent) + "globalThis.result=loadPlatformRoles;", {
    platformRoles,
    rolesLoading,
    rolesError,
    lastUpdatedAt,
    permissionsRoute,
    message,
    ApiClientError,
    AbortController,
    DOMException,
    window: {
      setTimeout: (cb, ms) => {
        timers.push({ cb, ms });
        return timers.length;
      },
      clearTimeout: (id) => cleared.push(id),
    },
    request: (url, options) =>
      new Promise((resolve, reject) => {
        reads.push({ url, options, resolve, reject });
        options.signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  });
  const first = load();
  assert.equal(await load(), false);
  assert.equal(reads.length, 1);
  assert.equal(reads[0].url, "/platform/roles");
  assert.equal(timers[0].ms, 12000);
  timers[0].cb();
  assert.equal(await first, false);
  assert.match(rolesError.value, /超过 12 秒/);
  assert.doesNotMatch(rolesError.value, /已保留/);
  const second = load();
  reads[1].resolve({ data: roles });
  assert.equal(await second, true);
  const stamp = lastUpdatedAt.value;
  for (const hint of ["读取失败", "无权限读取（合成403）", "会话已过期（合成401）"]) {
    const attempt = load();
    reads.at(-1).reject(new ApiClientError(hint));
    assert.equal(await attempt, false);
    assert.deepEqual(plain(platformRoles.value), roles);
    assert.equal(lastUpdatedAt.value, stamp);
    assert.match(rolesError.value, /已保留上次/);
  }
  const empty = load();
  reads.at(-1).resolve({ data: [] });
  assert.equal(await empty, true);
  assert.equal(platformRoles.value.length, 0);
  assert.equal(cleared.length, 6);
  assert.equal(rolesLoading.value, false);
  // Actual repository projection and parameterized query, with supplied rows instead of MySQL.
  const repositorySource = parse(await read("apps/api/src/mysql-authorization-repository.ts"));
  const Repository = run(
    noImports(repositorySource) + "globalThis.result=MySqlAuthorizationRepository;",
  );
  const queries = [],
    rows = roles.flatMap((r) =>
      r.capabilities.map((capability_code) => ({ ...r, capability_code })),
    );
  rows.push({
    code: "synthetic-empty",
    name: "合成空能力角色",
    category: "platform",
    description: "边界夹具",
    capability_code: null,
  });
  const repository = new Repository({
    query: async (sql, params) => {
      queries.push({ sql, params: plain(params) });
      return [rows];
    },
  });
  const projected = plain(await repository.listRoles("platform"));
  assert.deepEqual(projected.slice(0, 3), roles);
  assert.deepEqual(projected[3].capabilities, []);
  assert.deepEqual(queries[0].params, ["platform"]);
  assert.match(queries[0].sql, /WHERE r.category=\? AND r.status='active'/);
  assert.match(queries[0].sql, /LEFT JOIN role_capabilities/);
  return {
    roles,
    capabilityLabels,
    cases,
    checks: [
      "Original three-role/seven-capability fixture extracted unchanged; 15 actual computed full-row comparison cases",
      "Actual refs/watch callbacks: URL five keys, preserve unrelated keys, omit defaults, 80/40 bounds, invalid/zero/single roles, P44 no persistence; not mounted Vue",
      "Actual reset: enabled only by query/group; single non-default role reset leaves both selectors unresolved until roles array changes",
      "No reverse route-query watch; same-instance browser history synchronization not established",
      "Actual loadPlatformRoles: one in-flight GET, real 12000ms abort callback invoked inertly, first failure versus retained matrix including supplied 401/403 hints, timestamp and empty success",
      "Actual MySQL repository method run against inert rows: active platform parameter, left join, grouped projection and empty capabilities; no SQL executed",
      "No production API, authentication, authorization, database, audit, Vue lifecycle or deployment verification",
    ],
    sourcePaths: [
      "apps/web/src/components/PlatformRoleComparison.vue",
      "apps/web/src/components/PlatformAccountCenter.vue",
      "apps/api/src/authorization-routes.ts",
      "apps/api/src/mysql-authorization-repository.ts",
      "packages/authorization/src/index.ts",
      "tests/e2e/m06-01-platform-accounts.spec.ts",
    ],
  };
}
