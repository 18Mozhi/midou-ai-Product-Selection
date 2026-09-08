import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { buildPersonalDesignData } from "./ui-phase2-personal-design-data.mjs";

export async function buildPersonalSectionsData(repo) {
  const read = (file) => readFile(path.join(repo, file), "utf8");
  const evaluate = (source) => {
    const context = { exports: {} };
    vm.runInNewContext(
      ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
        .outputText,
      context,
    );
    return context.exports;
  };
  const extract = (source, name) => {
    const ast = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true),
      found = [];
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name)
        found.push(node.initializer.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(found.length, 1, name);
    return evaluate(`export const value = ${found[0]};`).value;
  };
  const fixture = await read("tests/e2e/ui-phase2-account-contracts.spec.ts");
  const preferences = extract(fixture, "initial");
  const source = (await read("apps/web/src/components/PersonalCenter.vue"))
    .split('<script setup lang="ts">')[1]
    .split("</script>")[0];
  const mappings = {
    roleName: ["member", "selection_manager", "procurement_member", "organization_admin", "custom"],
    scopeName: ["organization", "workspace", "team", "self", "custom"],
    capabilityName: [
      "task:read",
      "task:create",
      "task:update",
      "task:assign",
      "trend:read",
      "trend:follow",
      "opportunity:read",
      "opportunity:decide",
      "competitor:read",
      "sourcing:read",
      "report:read",
      "team:manage",
      "organization_token:manage",
    ],
    statusName: [
      "active",
      "revoked",
      "expired",
      "todo",
      "in_progress",
      "completed",
      "cancelled",
      "low",
      "normal",
      "high",
      "critical",
    ],
    decisionName: ["adopt", "observe", "reject", "custom"],
  };
  const labels = Object.fromEntries(
    Object.entries(mappings).map(([name, values]) => {
      const fn = extract(source, name);
      return [name, Object.fromEntries(values.map((value) => [value, fn(value)]))];
    }),
  );
  const service = await read("apps/api/src/notification-service.ts");
  const { validatePreferences } = evaluate(
    service.split("export interface NotificationRepository")[0],
  );
  const validInput = { ...preferences, expected_version: preferences.version };
  delete validInput.version;
  const validated = validatePreferences(validInput);
  let mailBlocked;
  try {
    validatePreferences({ ...validInput, email_enabled: true });
  } catch (error) {
    mailBlocked = { code: error.code, statusCode: error.statusCode, actionHint: error.actionHint };
  }
  assert.equal(mailBlocked?.code, "mail_provider_pending");
  const base = await buildPersonalDesignData(repo);
  // Explicit synthetic layout fixtures, fields grounded in sessionSummary and
  // MySqlPersonalCenterRepository.assets. No real person, device or permission claim.
  const sample = {
    authorization: {
      roles: ["member"],
      capabilities: ["task:read", "trend:read", "opportunity:read"],
      data_scopes: [{ scope: "self", scope_key: null }],
    },
    sessions: ["active", "revoked", "expired"].map((status, index) => ({
      id: `00000000-0000-4000-8000-00000000091${index}`,
      status,
      device_label: `隔离演示设备 ${index + 1}`,
      last_seen_at: "2026-09-07T00:00:00.000Z",
      created_at: "2026-09-06T00:00:00.000Z",
      expires_at: "2026-09-08T00:00:00.000Z",
    })),
    assets: {
      followed_trends: [
        {
          id: "00000000-0000-4000-8000-000000000920",
          title: "隔离关注主题",
          market: "US",
          created_at: "2026-09-07T00:00:00.000Z",
        },
      ],
      decisions: [
        {
          id: "00000000-0000-4000-8000-000000000921",
          opportunity_id: "00000000-0000-4000-8000-000000000922",
          opportunity_name: "隔离决策对象",
          action: "observe",
          created_at: "2026-09-07T00:00:00.000Z",
        },
      ],
      tasks: [
        {
          id: "00000000-0000-4000-8000-000000000923",
          title: "隔离本人任务",
          status: "in_progress",
          priority: "high",
          due_at: null,
        },
      ],
    },
  };
  return JSON.parse(
    JSON.stringify({
      sections: base.sections,
      profile: base.profile,
      preferences,
      labels,
      sample,
      validated,
      mailBlocked,
    }),
  );
}
