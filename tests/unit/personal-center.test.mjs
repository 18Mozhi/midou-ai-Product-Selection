import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PersonalCenterService } from "../../apps/api/dist/personal-center-service.js";

test("personal center validates versioned profile changes and preserves selected scope", async () => {
  const calls = [];
  const repository = {
    profile: async (input) => input,
    assets: async (input) => input,
    updateProfile: async (input) => (calls.push(input), input),
  };
  const service = new PersonalCenterService(
    repository,
    () => new Date("2026-08-18T12:00:00.000Z"),
  );
  await service.update(
    {
      display_name: "选品经理",
      avatar_url: "https://example.test/avatar.png",
      phone: "+86 138-0000-0000",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      expected_version: 2,
      reason: "完善个人资料",
    },
    {
      userId: "user",
      organizationId: "org",
      workspaceId: "workspace",
      idempotencyKey: "key",
      requestId: "request",
      traceId: "trace",
    },
  );
  assert.equal(calls[0].expectedVersion, 2);
  assert.equal(calls[0].organizationId, "org");
  assert.throws(
    () =>
      service.update(
        {
          display_name: "a",
          avatar_url: "http://unsafe.test",
          locale: "zh-CN",
          timezone: "Asia/Shanghai",
          expected_version: 0,
          reason: "修改",
        },
        {
          userId: "u",
          organizationId: "o",
          workspaceId: "w",
          idempotencyKey: "k",
          requestId: "r",
          traceId: "t",
        },
      ),
    /avatar_url_invalid/,
  );
});

test("personal center delivery contains real profile assets security preferences and route contracts", async () => {
  const [component, routes, repository, migration, openapi, map] =
    await Promise.all([
      readFile("apps/web/src/components/PersonalCenter.vue", "utf8"),
      readFile("apps/api/src/personal-center-routes.ts", "utf8"),
      readFile("apps/api/src/mysql-personal-center-repository.ts", "utf8"),
      readFile("database/migrations/0039_personal_center.up.sql", "utf8"),
      readFile("docs/openapi.yaml", "utf8"),
      readFile("docs/feature-map.json", "utf8"),
    ]);
  assert.match(component, /基本资料.*我的权限.*安全中心.*通知偏好.*我的资产/s);
  assert.match(component, /changePassword.*revokeSession.*savePreferences/s);
  assert.match(routes, /\/api\/v1\/me\/profile/);
  assert.match(routes, /\/api\/v1\/me\/assets/);
  assert.match(repository, /trend_topic_follows/);
  assert.match(repository, /opportunity_decisions/);
  assert.match(repository, /FROM tasks WHERE assignee_id/);
  assert.match(migration, /user_profiles/);
  assert.match(openapi, /\/me\/profile:/);
  assert.match(map, /"view": "PersonalCenter"/);
});
