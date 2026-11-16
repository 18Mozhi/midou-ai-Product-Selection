import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyLegacyWorkspaces,
  previewAccountScopeRetirement,
  resolveAccountOwner,
} from "../../scripts/preview-account-scope-retirement.mjs";

const primaryId = "primary";
const scope = {
  workspace_id: "space",
  organization_id: "org",
  organization_creator: "alice",
  slug: "personal-alice",
  member_id: "alice",
  member_status: "active",
};

test("preserves an exclusive account, but shared and unassigned data go to the primary account", () => {
  assert.deepEqual(resolveAccountOwner({ primaryId, exclusiveOwnerId: "alice", shared: false }), {
    account_id: "alice",
    reason: "exclusive_owner",
  });
  assert.deepEqual(resolveAccountOwner({ primaryId, exclusiveOwnerId: "alice", shared: true }), {
    account_id: primaryId,
    reason: "shared",
  });
  assert.deepEqual(resolveAccountOwner({ primaryId, shared: false }), {
    account_id: primaryId,
    reason: "unassigned",
  });
  assert.throws(() => resolveAccountOwner({ shared: false }), /invalid_ownership_input/);
});

test("groups legacy scopes without treating a creator or a single remaining member as ownership proof", () => {
  const rows = [
    scope,
    { ...scope, workspace_id: "shared" },
    { ...scope, workspace_id: "shared", member_id: "bob", member_status: "disabled" },
    { ...scope, organization_id: "org-2", workspace_id: "space-2", slug: "team" },
    { ...scope, organization_id: "org-3", workspace_id: "space-3", member_status: "disabled" },
  ];
  assert.deepEqual(
    classifyLegacyWorkspaces(rows, primaryId).map((row) => [row.account_id, row.reason]),
    [
      ["alice", "exclusive_owner"],
      [primaryId, "shared"],
      [primaryId, "unassigned"],
      ["alice", "exclusive_owner"],
    ],
  );
});

function fixture(principals = [{ id: primaryId }], tableName = "opportunities") {
  const commands = [];
  const connection = {
    async query(sql) {
      commands.push(sql);
      if (/^(SET TRANSACTION|START TRANSACTION)/.test(sql)) return [[]];
      if (sql.includes("FROM workspaces")) return [[scope]];
      if (sql.includes("information_schema.COLUMNS")) {
        return [
          [
            { table_name: tableName, column_name: "organization_id" },
            { table_name: tableName, column_name: "workspace_id" },
            { table_name: "audit_events", column_name: "organization_id" },
          ],
        ];
      }
      if (sql.includes("information_schema.KEY_COLUMN_USAGE")) {
        return [[{ table_name: "opportunities", parent_table: "workspaces" }]];
      }
      if (sql.includes("FROM `opportunities`")) {
        return [[{ organization_id: "org", workspace_id: "space", row_count: "37" }]];
      }
      if (sql.includes("FROM `audit_events`")) {
        assert.match(sql, /NULL workspace_id/);
        return [[{ organization_id: null, workspace_id: null, row_count: "9" }]];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
    async execute(sql, parameters) {
      commands.push(sql);
      assert.deepEqual(parameters, ["2313645627@qq.com"]);
      assert.match(sql, /status='active' AND email_verified_at IS NOT NULL/);
      return [principals];
    },
    async rollback() {
      commands.push("ROLLBACK");
    },
  };
  return { connection, commands };
}

test("runs a consistent read-only census without changing business rows", async () => {
  const { connection, commands } = fixture();
  const report = await previewAccountScopeRetirement(connection);
  assert.equal(report.primary_approval_account_id, primaryId);
  assert.equal(report.scope_defaults[0].account_id, "alice");
  assert.deepEqual(
    report.tables.map((entry) => entry.scopes[0].row_count),
    ["37", "9"],
  );
  assert.deepEqual(
    report.tables.map((entry) => entry.scopes[0].source_scope),
    ["known_workspace", "no_scope_ids"],
  );
  assert.equal(report.foreign_keys[0].parent_table, "workspaces");
  assert.match(commands[1], /CONSISTENT SNAPSHOT, READ ONLY$/);
  assert.equal(commands.at(-1), "ROLLBACK");
  assert.ok(
    commands.every((sql) => /^(SET TRANSACTION|START TRANSACTION|SELECT|ROLLBACK)/.test(sql)),
  );
});

test("missing/ambiguous primary and unsafe identifiers stop the preview and release the snapshot", async () => {
  for (const principals of [[], [{ id: "1" }, { id: "2" }]]) {
    const { connection, commands } = fixture(principals);
    await assert.rejects(
      previewAccountScopeRetirement(connection),
      /active_verified_primary_account_required/,
    );
    assert.equal(commands.length, 4);
    assert.equal(commands.at(-1), "ROLLBACK");
  }
  const { connection, commands } = fixture([{ id: primaryId }], "x`; DROP TABLE users; --");
  await assert.rejects(previewAccountScopeRetirement(connection), /unexpected_schema_identifier/);
  assert.equal(commands.at(-1), "ROLLBACK");
});
