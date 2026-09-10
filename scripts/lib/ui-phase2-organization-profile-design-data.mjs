import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildOrganizationProfileDesignData(repo) {
  const read = (f) => readFile(path.join(repo, f), "utf8");
  function extract(source, name, kind = "variable") {
    const ast = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true),
      found = [];
    function visit(n) {
      if (kind === "variable" && ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
        found.push(n.initializer.getText(ast));
      if (kind === "function" && ts.isFunctionDeclaration(n) && n.name?.text === name)
        found.push(n.getText(ast));
      if (kind === "method" && ts.isMethodDeclaration(n) && n.name.getText(ast) === name)
        found.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(found.length, 1, name);
    return found[0];
  }
  function run(code, bindings = {}) {
    const box = { exports: {}, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    return box.exports;
  }
  const fixture = await read("tests/e2e/m06-01-organization-admin.spec.ts"),
    values = run(
      `${["org", "ws", "summary", "profile", "workspaces"].map((n) => `const ${n}=${extract(fixture, n)};`).join("\n")} export const values={summary,profile,workspaces};`,
    ).values,
    { summary, profile, workspaces } = plain(values),
    vue = await read("apps/web/src/components/OrganizationAdminCenter.vue"),
    functions = [
      "readView",
      "load",
      "submit",
      "applyFailure",
      "validateHttps",
      "clearFieldValidity",
    ]
      .map((n) => extract(vue, n, "function"))
      .join("\n");
  class Failure extends Error {
    constructor(kind = "blocked") {
      super("synthetic failure");
      this.kind = kind;
      this.requestId = "synthetic-read-failed";
      this.userMessage = "合成服务错误";
      this.actionHint = "请重试";
    }
  }
  function component(mode = "success") {
    const calls = [],
      refs = Object.fromEntries(
        [
          "data",
          "summary",
          "form",
          "state",
          "notice",
          "noticeKind",
          "requestId",
          "busy",
          "refreshing",
          "lastReadFailureStatus",
          "secret",
        ].map((k) => [
          k,
          {
            value: ["busy", "refreshing"].includes(k)
              ? false
              : k === "form"
                ? { reason: "" }
                : null,
          },
        ]),
      );
    let wrote = false;
    const h = run(
      `let loadSequence=0,tokenSecretGeneration=0,surfaceActive=true; const view={value:'summary'}; ${functions}\nexport const h={load,submit,validateHttps,clearFieldValidity};`,
      {
        ...refs,
        ApiClientError: Failure,
        rethrowUnexpectedError: (e) => {
          if (!(e instanceof Failure)) throw e;
        },
        api: async (url, options = {}) => {
          calls.push(
            plain({ url, ...options, ...(options.body ? { body: JSON.parse(options.body) } : {}) }),
          );
          if (options.method === "PATCH") {
            if (mode === "conflict") throw new Failure("conflict");
            if (mode === "forbidden") throw new Failure("forbidden");
            wrote = true;
            return { data: { id: profile.id, version: 4 }, request_id: "synthetic-write-accepted" };
          }
          if (mode === "read_failed" && wrote) throw new Failure();
          return { data: cloneResponse(url), request_id: "synthetic-read-ok" };
        },
      },
    ).h;
    function cloneResponse(url) {
      return plain(
        url.endsWith("/summary") ? summary : url.endsWith("/workspaces") ? workspaces : profile,
      );
    }
    return { ...refs, ...h, calls };
  }
  const c = component();
  await c.load();
  assert.deepEqual(c.calls.map((v) => v.url).sort(), [
    "/org/admin/profile",
    "/org/admin/summary",
    "/org/admin/workspaces",
  ]);
  const initialForm = plain(c.form.value);
  c.form.value.reason = "核验组织资料";
  const body = plain({ ...c.form.value, expected_version: c.data.value.version });
  assert.equal(await c.submit("/org/admin/profile", body, "PATCH"), true);
  const contract = c.calls.find((v) => v.method === "PATCH");
  assert.deepEqual(contract, { url: "/org/admin/profile", method: "PATCH", body });
  assert.equal(c.requestId.value, "synthetic-write-accepted");
  c.form.value.name = "未提交的名称";
  await c.load({ background: true });
  assert.equal(c.form.value.name, profile.name, "source refresh replaces unsaved draft");
  for (const kind of ["conflict", "forbidden"]) {
    const instance = component(kind);
    await instance.load();
    instance.form.value.reason = "保留失败输入";
    const prior = plain(instance.form.value);
    assert.equal(
      await instance.submit("/org/admin/profile", { ...prior, expected_version: 3 }, "PATCH"),
      false,
    );
    assert.deepEqual(plain(instance.form.value), prior);
    assert.equal(instance.state.value, kind === "conflict" ? "ready" : "forbidden");
  }
  const failedRead = component("read_failed");
  await failedRead.load();
  failedRead.form.value.reason = "合成写后重读";
  assert.equal(
    await failedRead.submit(
      "/org/admin/profile",
      { ...failedRead.form.value, expected_version: 3 },
      "PATCH",
    ),
    true,
  );
  assert.equal(
    failedRead.noticeKind.value,
    "success",
    "source OG-G02 falsely overwrites read-failure feedback",
  );
  assert.equal(failedRead.notice.value, "操作已完成并写入审计。");
  assert.deepEqual(plain(failedRead.form.value), { reason: "" });
  let validity = "";
  c.validateHttps({
    currentTarget: {
      setCustomValidity: (v) => {
        validity = v;
      },
    },
  });
  assert.match(validity, /https/);
  c.clearFieldValidity({
    currentTarget: {
      setCustomValidity: (v) => {
        validity = v;
      },
    },
  });
  assert.equal(validity, "");
  const service = await read("apps/api/src/organization-admin-service.ts"),
    ast = ts.createSourceFile("service.ts", service, ts.ScriptTarget.Latest, true),
    module = run(
      ast.statements
        .filter((n) => !ts.isImportDeclaration(n))
        .map((n) => n.getFullText(ast))
        .join("\n"),
      { randomUUID: () => "synthetic-write-id" },
    ),
    validated = [],
    server = new module.OrganizationAdminService({
      updateProfile: (v) => {
        validated.push(plain(v));
        return v;
      },
    });
  server.updateProfile({ value: body });
  assert.deepEqual(validated[0].value, body);
  server.updateProfile({ value: { ...body, logo_url: "" } });
  assert.equal(validated.at(-1).value.logo_url, null);
  for (const days of [30, 3650])
    server.updateProfile({ value: { ...body, data_retention_days: days } });
  for (const [change, code] of [
    [{ name: " " }, "organization_name_invalid"],
    [{ name: "名".repeat(121) }, "organization_name_invalid"],
    [{ logo_url: "http://example.test/logo.png" }, "logo_url_invalid"],
    [{ timezone: " " }, "timezone_invalid"],
    [{ timezone: "x".repeat(65) }, "timezone_invalid"],
    [{ data_retention_days: 29 }, "retention_invalid"],
    [{ data_retention_days: 3651 }, "retention_invalid"],
    [{ data_retention_days: 30.5 }, "retention_invalid"],
    [{ default_workspace_id: "not-a-uuid" }, "workspace_id_invalid"],
    [{ reason: " " }, "reason_invalid"],
    [{ reason: "因".repeat(501) }, "reason_invalid"],
  ])
    assert.throws(
      () => server.updateProfile({ value: { ...body, ...change } }),
      (e) => e.code === code,
    );
  server.updateProfile({ value: { ...body, timezone: "synthetic-zone" } });
  assert.equal(validated.at(-1).value.timezone, "synthetic-zone", "do not invent a timezone enum");
  const repository = await read("apps/api/src/mysql-organization-admin-repository.ts"),
    sql = [],
    SourceSummary = run(
      `export class SourceSummary { ${extract(repository, "summary", "method")} }`,
      { OrganizationAdminError: module.OrganizationAdminError },
    ).SourceSummary,
    db = new SourceSummary();
  db.now = () => new Date("2026-09-08T00:00:00Z");
  db.org = (row) => row;
  db.pool = {
    query: async (query, params) => {
      sql.push({ query, params });
      return [
        query.includes("FROM organizations ")
          ? [profile]
          : [{ total: 0, active: 0, pending: 0, recent: 0 }],
      ];
    },
  };
  const zero = await db.summary({ organizationId: profile.id });
  assert.equal(zero.members.total, 0);
  assert.equal(zero.recent_audit_events, 0);
  assert.equal(sql.length, 7);
  assert.ok(sql.every((v) => v.params[0] === profile.id));
  assert.match(sql.at(-1).query, /FROM audit_logs.*INTERVAL 7 DAY/);
  assert.ok(sql.every((v) => !v.query.includes("platform_audit_events")));
  const updateSource = extract(repository, "updateProfile", "method");
  assert.match(updateSource, /SELECT id FROM workspaces WHERE id=\? AND organization_id=\?/);
  assert.doesNotMatch(updateSource, /status='active'/);
  return {
    provenance:
      "Original M06-01 E2E profile, summary and workspace fixtures; synthetic review states are labeled separately.",
    profile,
    summary,
    workspaces,
    initialForm,
    contract,
    sourceChecks: [
      "Three source read paths and exact versioned profile PATCH",
      "Source success keeps write ID; conflict keeps form; forbidden replaces page",
      "Source refresh overwrites draft and write-read failure is swallowed (OG-G02 reproduced)",
      "Source HTTPS custom validity and actual service field validators",
      "Source summary via inert SQL pool, zero counts and audit_logs seven-day scope",
      "No active-only workspace or timezone enum invented",
    ],
  };
}
