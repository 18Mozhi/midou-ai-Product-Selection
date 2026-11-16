import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

const primaryEmail = "2313645627@qq.com";
const primaryLookup = `SELECT id FROM users
  WHERE email_normalized=? AND status='active' AND email_verified_at IS NOT NULL`;

export function resolveAccountOwner({ primaryId, exclusiveOwnerId, shared }) {
  if (!primaryId || typeof shared !== "boolean") throw new Error("invalid_ownership_input");
  if (shared) return { account_id: primaryId, reason: "shared" };
  if (exclusiveOwnerId) return { account_id: exclusiveOwnerId, reason: "exclusive_owner" };
  return { account_id: primaryId, reason: "unassigned" };
}

const workspacesSql = `SELECT w.id workspace_id,w.organization_id,
  o.slug,o.created_by organization_creator,
  m.user_id member_id
  FROM workspaces w JOIN organizations o ON o.id=w.organization_id
  LEFT JOIN memberships m ON m.organization_id=w.organization_id
  ORDER BY w.organization_id,w.id,m.user_id`;

export function classifyLegacyWorkspaces(rows, primaryId) {
  const scopes = new Map();
  for (const row of rows) {
    const key = `${row.organization_id}/${row.workspace_id}`;
    let scope = scopes.get(key);
    if (!scope) {
      scope = { row, members: new Set() };
      scopes.set(key, scope);
    }
    if (row.member_id) scope.members.add(row.member_id);
  }
  return [...scopes.values()].map(({ row, members }) => {
    // The slug and creator pair is the actual personal-space provisioning signature.
    // Historical membership counts, not just today's active members, detect sharing.
    const creator = row.organization_creator;
    const isPersonal = creator && row.slug === `personal-${creator.replaceAll("-", "")}`;
    const shared = members.size > 1;
    const exclusiveOwnerId = !shared && isPersonal && members.has(creator) ? creator : null;
    return {
      organization_id: row.organization_id,
      workspace_id: row.workspace_id,
      ...resolveAccountOwner({ primaryId, exclusiveOwnerId, shared }),
      historical_member_count: members.size,
    };
  });
}

const identifier = (name) => {
  if (!/^[a-z][a-z0-9_]*$/i.test(name)) throw new Error("unexpected_schema_identifier");
  return `\`${name}\``;
};

export async function readLegacyAccountScopeDefaults(connection) {
  const [principals] = await connection.execute(primaryLookup, [primaryEmail]);
  if (principals.length !== 1) throw new Error("active_verified_primary_account_required");
  const [workspaces] = await connection.query(workspacesSql);
  return {
    primaryId: principals[0].id,
    scopeDefaults: classifyLegacyWorkspaces(workspaces, principals[0].id),
  };
}

export async function previewAccountScopeRetirement(connection, summarize) {
  await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
  try {
    const { primaryId, scopeDefaults } = await readLegacyAccountScopeDefaults(connection);
    const [schema] =
      await connection.query(`SELECT c.TABLE_NAME table_name,c.COLUMN_NAME column_name
      FROM information_schema.COLUMNS c JOIN information_schema.TABLES t
        ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME
      WHERE c.TABLE_SCHEMA=DATABASE() AND t.TABLE_TYPE='BASE TABLE'
        AND c.COLUMN_NAME IN ('organization_id','workspace_id')
      ORDER BY c.TABLE_NAME,c.COLUMN_NAME`);
    const [foreignKeys] = await connection.query(`SELECT TABLE_NAME table_name,
      CONSTRAINT_NAME constraint_name,COLUMN_NAME column_name,
      REFERENCED_TABLE_NAME parent_table,REFERENCED_COLUMN_NAME parent_column,
      ORDINAL_POSITION ordinal_position FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_SCHEMA=DATABASE()
      ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION`);
    const inventory = new Map();
    for (const { table_name, column_name } of schema) {
      if (!inventory.has(table_name)) inventory.set(table_name, new Set());
      inventory.get(table_name).add(column_name);
    }
    const scopeKeys = new Set(
      scopeDefaults.map((row) => `${row.organization_id}/${row.workspace_id}`),
    );
    const tables = [];
    for (const [table, columns] of inventory) {
      const org = columns.has("organization_id"),
        workspace = columns.has("workspace_id");
      const [rows] = await connection.query(`SELECT
        ${org ? "t.organization_id" : "NULL"} organization_id,
        ${workspace ? "t.workspace_id" : "NULL"} workspace_id, COUNT(*) row_count
        FROM ${identifier(table)} t GROUP BY 1,2`);
      tables.push({
        table,
        scope_columns: [...columns].sort(),
        scopes: rows.map((row) => ({
          ...row,
          source_scope:
            row.workspace_id == null
              ? row.organization_id == null
                ? "no_scope_ids"
                : "organization_only"
              : !org
                ? "workspace_column_only"
                : scopeKeys.has(`${row.organization_id}/${row.workspace_id}`)
                  ? "known_workspace"
                  : "unmatched_workspace",
        })),
      });
    }
    const report = {
      mode: "read_only_preview",
      primary_approval_account_id: primaryId,
      scope_defaults: scopeDefaults,
      foreign_keys: foreignKeys,
      tables,
    };
    return summarize ? await summarize(report) : report;
  } finally {
    await connection.rollback();
  }
}

async function main() {
  if (process.argv.length !== 2) throw new Error("unexpected_arguments");
  for (const name of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
    if (!process.env[name]) throw new Error(`missing_${name.toLowerCase()}`);
  }
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: "utf8mb4",
    multipleStatements: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  try {
    console.log(JSON.stringify(await previewAccountScopeRetirement(connection), null, 2));
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(
      error.code ?? (error.message.match(/^[a-z_]+$/) ? error.message : "preview_failed"),
    );
    process.exitCode = 1;
  });
}
