import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  OrganizationAdminService,
  OrganizationAdminError,
} from "../../apps/api/dist/organization-admin-service.js";
import { MySqlOrganizationAdminRepository } from "../../apps/api/dist/mysql-organization-admin-repository.js";
const org = "00000000-0000-4000-8000-000000000601",
  ws = "00000000-0000-4000-8000-000000000602";
function fake() {
  const calls = [];
  return {
    calls,
    repo: new Proxy(
      {},
      {
        get: (_t, k) => async (i) => {
          calls.push([k, i]);
          return i;
        },
      },
    ),
  };
}
test("M06-01.A01/A02/A04/A12 validates scoped admin contracts", async () => {
  const f = fake(),
    s = new OrganizationAdminService(f.repo, 72, 90, 2, () => new Date("2026-08-08T00:00:00Z"));
  await s.updateProfile({
    organizationId: org,
    value: {
      name: "ScoutOps",
      timezone: "Asia/Shanghai",
      data_retention_days: 365,
      default_workspace_id: ws,
      expected_version: 1,
      reason: "approved change",
    },
  });
  assert.equal(f.calls[0][0], "updateProfile");
  assert.throws(
    () =>
      s.updateProfile({
        value: {
          name: "x",
          timezone: "UTC",
          data_retention_days: 1,
          default_workspace_id: ws,
          reason: "x",
        },
      }),
    (e) => e instanceof OrganizationAdminError && e.code === "retention_invalid",
  );
  assert.throws(
    () => s.invite({ value: { email: "bad", role_code: "member", reason: "x" } }),
    (e) => e.code === "invitation_email_invalid",
  );
  await s.invitationAction({
    invitationId: "00000000-0000-4000-8000-000000000699",
    value: { action: "revoke", expected_version: 1, reason: "撤销错误邀请" },
  });
  assert.equal(f.calls.at(-1)[0], "invitationAction");
  assert.equal(f.calls.at(-1)[1].value.action, "revoke");
  assert.throws(
    () =>
      s.invitationAction({
        invitationId: "00000000-0000-4000-8000-000000000699",
        value: { action: "resend", expected_version: 1, reason: "x" },
      }),
    (e) => e.code === "invitation_action_invalid",
  );
  await s.assignRole({
    membershipId: "00000000-0000-4000-8000-000000000698",
    value: { role_code: "auditor", expected_version: 7, reason: "并发角色回归" },
  });
  assert.equal(f.calls.at(-1)[0], "assignRole");
  assert.equal(f.calls.at(-1)[1].value.expected_version, 7);
  assert.throws(
    () => s.createToken({ value: { name: "write", scopes: ["organization:manage"], reason: "x" } }),
    (e) => e.code === "token_scope_invalid",
  );
  const validationError = new OrganizationAdminError(
    "retention_invalid",
    400,
    "数据保留天数必须为 30–3650。",
  );
  assert.equal(validationError.message, "数据保留天数必须为 30–3650。");
});
test("M06-01.A06/A09/A13 token is random, hashed and read-only scoped", async () => {
  const f = fake(),
    s = new OrganizationAdminService(f.repo);
  const x = await s.createToken({
      organizationId: org,
      value: { name: "reporting", scopes: ["report:read"], ttl_days: 30, reason: "integration" },
    }),
    input = f.calls[0][1];
  assert.match(input.value.secret, /^sco_org_/);
  assert.equal(input.value.token_hash.length, 64);
  assert.ok(!input.value.token_hash.includes(input.value.secret));
  assert.deepEqual(input.value.scopes, ["report:read"]);
  assert.equal(x.value.secret, input.value.secret);
});
test("M06-01.A03/A05/A11/A16 migration is MySQL57, auditable and reversible", async () => {
  const up = await readFile("database/migrations/0019_organization_admin_m06_01.up.sql", "utf8"),
    down = await readFile("database/migrations/0019_organization_admin_m06_01.down.sql", "utf8"),
    repo = await readFile("apps/api/src/mysql-organization-admin-repository.ts", "utf8");
  assert.match(up, /organization_invitations/);
  assert.match(up, /organization_api_tokens/);
  assert.match(up, /team_memberships/);
  assert.match(up, /DEFAULT CHARSET=utf8mb4/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|GENERATED ALWAYS/i);
  assert.match(down, /DROP TABLE IF EXISTS `organization_api_tokens`/);
  assert.match(repo, /last_admin_forbidden/);
  assert.match(repo, /default_workspace_archive_forbidden/);
  assert.match(repo, /LEFT JOIN user_profiles p ON p\.user_id=u\.id/);
  assert.match(repo, /u\.status account_status/);
  assert.match(repo, /async invitationAction\(i: any\)/);
  assert.match(repo, /SELECT id FROM organizations WHERE id=\? FOR UPDATE/);
  assert.match(
    repo,
    /SELECT \* FROM memberships WHERE id=\? AND organization_id=\? FOR UPDATE[\s\S]*this\.operation\(i, c, true\)[\s\S]*this\.version\(m\[0\], i\.value\.expected_version, "membership"\)/,
  );
  assert.match(repo, /INSERT INTO audit_logs/);
  assert.match(repo, /INSERT INTO outbox_events/);
  assert.match(repo, /delete stored\.secret/);
  assert.match(
    repo,
    /SELECT version FROM organizations WHERE id=\? FOR UPDATE[\s\S]*this\.operation\(i, c, true\)/,
  );
  assert.match(repo, /currentRead \? " FOR UPDATE" : ""/);
});
test("M06-01 organization pages use novice labels and keep UUIDs in technical details", async () => {
  const web = (
    await Promise.all(
      [
        "apps/web/src/components/OrganizationAdminCenter.vue",
        "apps/web/src/components/OrganizationMemberPanel.vue",
        "apps/web/src/components/OrganizationRolePanel.vue",
        "apps/web/src/components/OrganizationApprovalPanel.vue",
      ].map((path) => readFile(path, "utf8")),
    )
  ).join("\n");
  for (const copy of [
    "组织后台",
    "组织基本资料",
    "普通成员",
    "选品经理",
    "采购成员",
    "组织管理员",
    "审计员",
    "组织范围",
    "工作区范围",
    "等待邮件服务",
    "等待接受",
    "技术详情",
    "负责人（可选）",
    "选择团队成员",
    "邮箱（每行一个）",
    "撤销邀请",
    "重置筛选",
    "成员分页",
  ])
    assert.match(web, new RegExp(copy));
  assert.doesNotMatch(
    web,
    /ADMIN CONTROL|ORGANIZATION PROFILE|\{\{x\.status\}\}|\{\{x\.role_code\}\}|默认工作区 ID|负责人（成员 ID|aria-label="团队成员 ID"/,
  );
  assert.match(web, /workspaceName\(data\?\.default_workspace_id\)/);
  assert.match(
    web,
    /<details class="org-admin-technical">[\s\S]*成员 ID：\{\{ member\.id \}\}[\s\S]*<\/details>/,
  );
});
test("M06-01 organization governance exposes filters, matrix and factual comparisons", async () => {
  const [repo, routes, center, members, roles, approvals, map] = await Promise.all([
    readFile("apps/api/src/mysql-organization-admin-repository.ts", "utf8"),
    readFile("apps/api/src/organization-admin-routes.ts", "utf8"),
    readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8"),
    readFile("apps/web/src/components/OrganizationMemberPanel.vue", "utf8"),
    readFile("apps/web/src/components/OrganizationRolePanel.vue", "utf8"),
    readFile("apps/web/src/components/OrganizationApprovalPanel.vue", "utf8"),
    readFile("docs/feature-map.json", "utf8"),
  ]);
  const web = [center, members, roles, approvals].join("\n");
  assert.match(repo, /team_names/);
  assert.match(repo, /approval_templates/);
  assert.match(repo, /approval_template_versions[\s\S]*templateVersionDiff/);
  assert.match(repo, /async data\(i: any\)/);
  assert.match(repo, /current_node_ordinal/);
  assert.doesNotMatch(repo, /workflow_template_id|requested_at/);
  assert.match(routes, /org\/admin\/data[\s\S]*report:read/);
  assert.match(routes, /org\/admin\/invitations\/:id\/actions[\s\S]*membership:manage/);
  assert.match(center, /String\(item\.display_name \?\? ""\)/);
  assert.match(center, /effectiveMemberStatus/);
  assert.match(center, /memberPageSize = 10/);
  assert.match(center, /for \(const email of accepted\)/);
  assert.match(center, /role_code, expected_version: item\.version, reason/);
  assert.match(center, /api\("\/me\/authorization"\)/);
  assert.match(center, /resource-grants\?page=\$\{resourceGrantPage\.value\}&limit=20/);
  assert.match(center, /status=\$\{resourceGrantStatus\.value\}/);
  assert.match(center, /grant_counts/);
  assert.match(center, /resource-grant-targets/);
  assert.match(center, /createResourceGrant/);
  assert.match(center, /extendResourceGrant/);
  assert.match(center, /revokeResourceGrant/);
  for (const copy of [
    "邀请状态",
    "成员筛选",
    "角色能力矩阵",
    "角色模板与能力",
    "成员数据范围预览",
    "指定资源授权",
    "创建并写入审计",
    "延长授权",
    "撤销授权",
    "资源授权分页",
    "上一页",
    "下一页",
    "跨工作区数据比较",
    "只显示一次",
    "应用筛选",
  ])
    assert.match(web, new RegExp(copy));
  assert.match(map, /"\/org-admin\/teams"/);
});
test("M06-01 organization overview preserves facts and form context across refresh and write feedback", async () => {
  const [center, styles] = await Promise.all([
    readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8"),
    readFile("apps/web/src/organization-admin.css", "utf8"),
  ]);
  assert.match(center, /let loadSequence = 0/);
  assert.match(center, /sequence !== loadSequence/);
  assert.match(center, /load\(\{ background: true, preserveNotice: true \}\)/);
  assert.match(center, /noticeKind\.value = "success"/);
  assert.match(center, /if \(busy\.value\) return/);
  assert.match(center, /requestTimeoutMs = 12_000/);
  assert.match(center, /organization_request_timeout/);
  assert.match(center, /organization_network_unavailable/);
  assert.match(center, /网络连接不可用/);
  assert.match(center, /pattern="https:\/\/\.\*"/);
  assert.match(center, /Logo 地址必须以 https:\/\/ 开头/);
  assert.match(center, /数据已被其他操作更新/);
  assert.match(center, /'error', 'blocked', 'expired'/);
  assert.match(center, /组织数据暂不可用/);
  assert.match(center, /:aria-busy="state === 'loading' \|\| refreshing"/);
  assert.match(styles, /org-admin-notice\[data-kind="success"\]/);
  assert.match(styles, /org-admin-notice\[data-kind="error"\]/);
});
test("M06-01 compares the current approval template with its immediate previous version", async () => {
  const templateId = "00000000-0000-4000-8000-000000000618",
    pool = {
      query: async (sql) => {
        if (sql.includes("FROM approval_requests WHERE organization_id=? GROUP BY")) return [[]];
        if (sql.includes("FROM approval_requests WHERE organization_id=? ORDER BY")) return [[]];
        if (sql.includes("COUNT(n.id) node_count FROM approval_templates"))
          return [
            [
              {
                id: templateId,
                name: "选品复核模板",
                resource_type: "opportunity_decision",
                status: "published",
                current_version: 2,
                revision: 3,
                workspace_name: "新品决策工作区",
                node_count: 2,
              },
            ],
          ];
        if (sql.includes("FROM approval_template_versions v JOIN approval_templates"))
          return [
            [
              {
                template_id: templateId,
                version_number: 1,
                ordinal: 1,
                name: "选品经理复核",
                approver_name: "张经理",
                sla_minutes: 60,
                escalation_name: "组织管理员",
              },
              {
                template_id: templateId,
                version_number: 2,
                ordinal: 1,
                name: "选品经理复核",
                approver_name: "李经理",
                sla_minutes: 30,
                escalation_name: "组织管理员",
              },
              {
                template_id: templateId,
                version_number: 2,
                ordinal: 2,
                name: "采购确认",
                approver_name: "采购负责人",
                sla_minutes: 120,
                escalation_name: "组织管理员",
              },
            ],
          ];
        throw new Error(`unexpected query: ${sql}`);
      },
    },
    repository = new MySqlOrganizationAdminRepository(pool),
    result = await repository.approvals({ organizationId: org });
  assert.equal(result.templates[0].version_diff.from_version, 1);
  assert.equal(result.templates[0].version_diff.to_version, 2);
  assert.equal(result.templates[0].version_diff.change_count, 2);
  assert.deepEqual(
    result.templates[0].version_diff.changes[0].fields.map((item) => item.label),
    ["审批人", "处理时限（分钟）"],
  );
  assert.equal(result.templates[0].version_diff.changes[1].kind, "added");
});
