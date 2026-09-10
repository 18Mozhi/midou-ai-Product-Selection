import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { historicalOrganizationActionSource } from "./ui-phase2-organization-action-baseline.mjs";
export async function buildPlatformOrganizationsDesignData(repo) {
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const execute = (source, bindings = {}) => {
    const box = { ...bindings };
    vm.runInNewContext(
      ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
        .outputText,
      box,
    );
    return box.result;
  };
  const parse = (text) => ts.createSourceFile("input.ts", text, ts.ScriptTarget.Latest, true);
  const fixture = parse(await read("tests/e2e/m06-01-platform-accounts.spec.ts"));
  const declarations = fixture.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => [...n.declarationList.declarations]);
  const names = ["user", "org", "overview"];
  const overview = plain(
    execute(
      names
        .map((name) => {
          const matches = declarations.filter((n) => n.name.getText(fixture) === name);
          assert.equal(matches.length, 1);
          return `const ${name} = ${matches[0].initializer.getText(fixture)};`;
        })
        .join("\n") + "globalThis.result = overview;",
    ),
  );
  const sourcePaths = [
    "apps/web/src/components/PlatformAccountCenter.vue",
    "apps/web/src/components/OrganizationCreationWizard.vue",
    "apps/web/src/components/PlatformOrganizationDetailDialog.vue",
    "apps/web/src/components/PlatformAccountDialogs.vue",
    "apps/web/src/components/PlatformOrganizationRecords.vue",
    "apps/api/src/platform-account-service.ts",
    "apps/api/src/mysql-platform-account-repository.ts",
    "tests/e2e/m06-01-platform-accounts.spec.ts",
  ];
  const service = parse(await read(sourcePaths[5]));
  const Service = execute(
    service.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(service).replace(/^\s*export /, "\n"))
      .join("\n") + "\nglobalThis.result = PlatformAccountService;",
    { createHmac, ApiError: class extends Error {} },
  );
  const calls = [];
  const repository = Object.fromEntries(
    ["createOrganization", "updateOrganization", "setOrganizationStatus", "overview"].map((key) => [
      key,
      (v) => {
        calls.push({ key, value: plain(v) });
        return v;
      },
    ]),
  );
  const svc = new Service(
    repository,
    () => new Date("2026-09-09T00:00:00Z"),
    undefined,
    12,
    128,
    "synthetic-inert-only",
  );
  const context = {
    actorId: "00000000-0000-4000-8000-000000000621",
    idempotencyKey: "synthetic",
    requestId: "synthetic",
    traceId: "synthetic",
  };
  const id = overview.organizations[0].id;
  const create = svc.createOrganization({ name: " 示例组织 ", slug: "TEAM-" }, context);
  assert.equal(create.slug, "team-");
  assert.equal(create.initialAdminUserId, context.actorId);
  assert.equal(create.name, "示例组织");
  for (const slug of ["a", "-ab", "a_b", "a".repeat(64)])
    assert.throws(() => svc.createOrganization({ name: "团队", slug }, context));
  for (const count of [29, 3651, 30.5])
    assert.throws(() =>
      svc.updateOrganization(
        id,
        { name: "团队", timezone: "Asia/Shanghai", data_retention_days: count, reason: "核对修改" },
        context,
      ),
    );
  for (const count of [30, 3650])
    assert.equal(
      svc.updateOrganization(
        id,
        {
          name: "团队",
          timezone: "not-an-iana-zone",
          data_retention_days: count,
          reason: " 核对修改 ",
        },
        context,
      ).dataRetentionDays,
      count,
    );
  for (const reason of ["a", " ", "a".repeat(301)])
    assert.throws(() => svc.organizationStatus(id, { status: "archived", reason }, context));
  for (const status of ["active", "archived"])
    assert.equal(
      svc.organizationStatus(id, { status, reason: " 核对修改 " }, context).reason,
      "核对修改",
    );
  assert.throws(() =>
    svc.organizationStatus(id, { status: "disabled", reason: "核对修改" }, context),
  );
  const parentText = historicalOrganizationActionSource(sourcePaths[0], await read(sourcePaths[0]))
    .split(/<script setup[^>]*>/)[1]
    .split("</script>")[0];
  const parent = parse(parentText);
  const functions = parent.statements.filter(ts.isFunctionDeclaration);
  const getFn = (name, bindings) => {
    const matches = functions.filter((n) => n.name?.text === name);
    assert.equal(matches.length, 1);
    return execute(matches[0].getFullText(parent) + `\nglobalThis.result=${name};`, bindings);
  };
  // Execute actual parent functions with inert refs/adapters. This is not a mounted Vue test.
  const selected = { value: overview.organizations[0] },
    organizationForm = { name: "修改前", timezone: "Asia/Shanghai", data_retention_days: 365 };
  let reasonAction;
  const writes = [];
  const update = getFn("updateOrganization", {
    selected,
    organizationForm,
    clearOrganizationFeedback() {},
    askReason(title, action) {
      reasonAction = action;
    },
    write: async (...args) => {
      writes.push(plain(args.slice(0, 3)));
      return null;
    },
  });
  await update();
  selected.value = { id: "synthetic-other-id" };
  organizationForm.name = "修改后";
  await reasonAction("核对修改");
  assert.equal(writes[0][0], "/platform/accounts/organizations/synthetic-other-id");
  assert.equal(writes[0][1].name, "修改后");
  const detail = { value: false },
    missing = { value: false },
    form = {};
  const show = getFn("showOrganization", {
    selected,
    organizationMissing: missing,
    organizationForm: form,
    organizationDetailOpen: detail,
  });
  show({ id, name: "最小返回", slug: "minimal", status: "active" });
  assert.equal(selected.value.member_count, undefined);
  assert.equal(form.timezone, "Asia/Shanghai");
  assert.equal(form.data_retention_days, 365);
  return {
    overview,
    sourcePaths,
    checks: [
      "Original overview fixture: global organizations 3, returned rows 1; not a complete list",
      "Actual service: name/slug normalization, trailing hyphen allowed, omitted admin resolves to actor",
      "Actual service: retention 30..3650 integer; timezone nonempty/max64, not IANA validation",
      "Actual service: active/archived only; trimmed reason 2..300",
      "Actual parent updateOrganization: confirmation uses current selected id and current form; target drift reproduced with inert refs",
      "Actual parent showOrganization: missing counts remain missing; form defaults Asia/Shanghai and 365",
      "No mounted Vue, HTTP, SQL, real audit, MFA or production execution",
    ],
  };
}
