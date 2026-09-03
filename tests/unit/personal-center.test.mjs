import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Fastify from "fastify";
import { PersonalCenterService } from "../../apps/api/dist/personal-center-service.js";
import { registerPersonalCenterRoutes } from "../../apps/api/dist/personal-center-routes.js";

test("personal center validates versioned account-level profile changes", async () => {
  const calls = [];
  const repository = {
    profile: async (input) => input,
    assets: async (input) => input,
    updateProfile: async (input) => (calls.push(input), input),
  };
  const service = new PersonalCenterService(repository, () => new Date("2026-08-18T12:00:00.000Z"));
  await service.update(
    {
      username: "运营.Admin",
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
      idempotencyKey: "key",
      requestId: "request",
      traceId: "trace",
    },
  );
  assert.equal(calls[0].expectedVersion, 2);
  assert.equal("organizationId" in calls[0], false);
  assert.equal(calls[0].username, "运营.Admin");
  assert.equal(calls[0].usernameNormalized, "运营.admin");
  await service.update(
    {
      display_name: "兼容旧客户端",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      expected_version: 3,
      reason: "更新显示名称",
    },
    {
      userId: "user",
      idempotencyKey: "legacy-client",
      requestId: "request-legacy",
      traceId: "trace-legacy",
    },
  );
  assert.equal(calls[1].username, undefined);
  assert.equal(calls[1].usernameNormalized, undefined);
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
          idempotencyKey: "k",
          requestId: "r",
          traceId: "t",
        },
      ),
    /avatar_url_invalid/,
  );
  assert.throws(
    () =>
      service.update(
        {
          username: "-invalid-",
          display_name: "a",
          locale: "zh-CN",
          timezone: "Asia/Shanghai",
          expected_version: 0,
          reason: "修改",
        },
        {
          userId: "u",
          idempotencyKey: "username-invalid",
          requestId: "r",
          traceId: "t",
        },
      ),
    /invalid_username/,
  );
});

test("personal profile reads and writes do not resolve a tenant context", async () => {
  let authorizationCalls = 0;
  const app = Fastify({ logger: false });
  app.addHook("onRequest", async (request) => {
    request.headers["x-request-id"] ??= "personal-request";
    request.headers["x-trace-id"] ??= "personal-trace";
  });
  registerPersonalCenterRoutes(app, {
    service: {
      profile: async (userId) => ({ id: userId, display_name: "无组织账号" }),
      update: async (_body, context) => ({ id: context.userId, version: 2 }),
      assets: async () => ({ followed_trends: [], decisions: [], tasks: [] }),
    },
    authorization: {
      resolveSession: async () => {
        authorizationCalls += 1;
        throw new Error("tenant context must not be read for profile operations");
      },
    },
    auth: {
      authenticate: async () => ({ user: { id: "account-user" }, session: { id: "session" } }),
    },
    secureCookie: false,
    webOrigin: "https://app.example.test",
  });

  const profile = await app.inject({
    method: "GET",
    url: "/api/v1/me/profile",
    headers: { cookie: "scoutops_session=session-token" },
  });
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().data.display_name, "无组织账号");

  const update = await app.inject({
    method: "PATCH",
    url: "/api/v1/me/profile",
    headers: {
      cookie: "scoutops_session=session-token",
      origin: "https://app.example.test",
      "idempotency-key": "profile-update",
    },
    payload: {},
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().data.version, 2);
  assert.equal(authorizationCalls, 0);
  await app.close();
});

test("personal center delivery contains real profile assets security preferences and route contracts", async () => {
  const [component, routes, repository, migration, openapi, map] = await Promise.all([
    readFile("apps/web/src/components/PersonalCenter.vue", "utf8"),
    readFile("apps/api/src/personal-center-routes.ts", "utf8"),
    readFile("apps/api/src/mysql-personal-center-repository.ts", "utf8"),
    readFile("database/migrations/0039_personal_center.up.sql", "utf8"),
    readFile("docs/openapi.yaml", "utf8"),
    readFile("docs/feature-map.json", "utf8"),
  ]);
  assert.match(component, /基本资料.*我的权限.*安全中心.*通知偏好.*我的资产/s);
  assert.match(component, /changePassword.*revokeSession.*savePreferences/s);
  assert.match(component, /登录用户名[\s\S]*form\.username/);
  assert.match(component, /onMounted\(\(\) => void load\(\)\)/);
  assert.ok(
    component.indexOf('await call("/me/profile")') < component.indexOf("Promise.allSettled"),
    "profile must render before optional personal-center sections finish",
  );
  assert.match(component, /finally \{[\s\S]*window\.clearTimeout\(timeout\)/);
  assert.match(routes, /\/api\/v1\/me\/profile/);
  assert.match(routes, /const current = await identity\(request\)/);
  assert.match(routes, /\/api\/v1\/me\/assets/);
  assert.match(repository, /trend_topic_follows/);
  assert.match(repository, /opportunity_decisions/);
  assert.match(repository, /FROM tasks WHERE assignee_id/);
  assert.match(migration, /user_profiles/);
  assert.match(repository, /uq_users_username_normalized/);
  assert.match(repository, /platform_audit_events/);
  assert.match(openapi, /\/me\/profile:/);
  assert.match(map, /"view": "PersonalCenter"/);
});
