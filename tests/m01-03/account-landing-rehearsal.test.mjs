import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlPlatformAccountRepository } from "../../apps/api/dist/mysql-platform-account-repository.js";
import { MySqlAuthorizationRepository } from "../../apps/api/dist/mysql-authorization-repository.js";
import {
  AccountRehearsalAuthorizationService,
  requireAccountReadRehearsal,
} from "../../apps/api/dist/account-read-rehearsal.js";
import { AuthorizationService, InMemoryAuthorizationRepository } from "@scoutops/authorization";
import { AuthError } from "@scoutops/auth";

test("account authorization never opens legacy membership or session tables and keeps platform roles", async () => {
  let reads = 0;
  const repo = new MySqlAuthorizationRepository(
    {
      async query(sql, values) {
        reads++;
        assert.match(sql, /FROM platform_role_assignments/);
        assert.deepEqual(values, ["actor"]);
        return [[{ role_code: "platform_admin", capability_code: "platform:operate" }]];
      },
    },
    true,
  );
  assert.equal(await repo.resourcesBelongToOrganization("org", {}), false);
  assert.equal(
    await repo.resourcesBelongToOrganization(undefined, { workspaceId: "workspace" }),
    false,
  );
  assert.equal(await repo.resourcesBelongToOrganization(undefined, { teamId: "team" }), false);
  assert.equal(await repo.resourcesBelongToOrganization(undefined, {}), true);
  assert.equal(await repo.findSessionContext("session", "actor"), null);
  assert.equal(await repo.hasActiveMembership("actor"), false);
  const subject = await repo.loadSubject("actor", "org");
  assert.equal(subject.membership_id, null);
  assert.equal(subject.membership_active, false);
  assert.deepEqual(subject.capabilities, []);
  assert.deepEqual(subject.platform_capabilities, ["platform:operate"]);
  assert.deepEqual(subject.scopes, [{ scope: "platform" }]);
  assert.equal(reads, 1);
});

test("account-mode platform checks reject old coordinates before any legacy lookup, even for a platform admin", async () => {
  const audit = [];
  const repo = new MySqlAuthorizationRepository(
    {
      async query(sql) {
        assert.match(sql, /FROM platform_role_assignments/);
        return [[{ role_code: "platform_admin", capability_code: "platform:operate" }]];
      },
    },
    true,
  );
  repo.appendDecision = async (event) => audit.push(event);
  const service = new AccountRehearsalAuthorizationService(repo);
  const check = {
    actorId: "admin",
    capability: "platform:operate",
    surface: "api",
    requestId: "r",
    traceId: "t",
  };
  assert.equal((await service.authorize(check)).reason, "allowed_platform");
  for (const scope of [{ organizationId: "org" }, { workspaceId: "ws" }, { teamId: "team" }])
    await assert.rejects(service.authorize({ ...check, ...scope }), { code: "permission_denied" });
  assert.deepEqual(
    audit.map((event) => event.reason),
    ["allowed_platform", "scope_mismatch", "scope_mismatch", "scope_mismatch"],
  );
});

test("account rehearsal platform directory reads accounts without legacy tables and rejects scoped creation", async () => {
  const id = "10000000-0000-4000-8000-000000000001";
  const user = { id, email: "fixture@example.test", status: "active", organization_count: 0 };
  const queries = [];
  const repo = new MySqlPlatformAccountRepository(
    {
      async query(sql) {
        queries.push(sql);
        assert.doesNotMatch(
          sql,
          /\b(?:FROM|JOIN)\s+(?:organizations|workspaces|memberships|membership_role_assignments)\b/i,
        );
        return [[user]];
      },
    },
    true,
  );
  const overview = await repo.overview({ query: "", status: "", limit: 20 });
  assert.equal(overview.users[0].id, id);
  assert.deepEqual(overview.organizations, []);
  const detail = await repo.userDetail({ userId: id });
  assert.equal(detail.user.id, id);
  assert.deepEqual(detail.memberships, []);
  assert.equal(queries.length, 5);
  const origin = "http://127.0.0.1:5173";
  let creates = 0;
  const app = buildApp({
    platformAccounts: {
      accountReadRehearsal: true,
      webOrigin: origin,
      secureCookie: false,
      auth: {
        async authenticate() {
          return { user };
        },
      },
      authorization: { async authorize() {} },
      service: {
        async createUser() {
          creates++;
          return { id };
        },
      },
    },
  });
  try {
    const send = (payload) =>
      app.inject({
        method: "POST",
        url: "/api/v1/platform/accounts/users",
        payload,
        headers: { origin, cookie: "scoutops_session=fixture", "idempotency-key": "create" },
      });
    const forbidden = await send({ organization_id: id });
    assert.equal(forbidden.statusCode, 400);
    assert.equal(forbidden.json().error.code, "platform_account_legacy_scope_invalid");
    assert.equal(creates, 0);
    assert.equal((await send({ email: user.email })).statusCode, 201);
    assert.equal(creates, 1);
  } finally {
    await app.close();
  }
});

test("account landing and navigation need backfill but do not restore legacy tenancy", async () => {
  let ready = false;
  let readyChecks = 0;
  let legacyChecks = 0;
  class Repository extends InMemoryAuthorizationRepository {
    async findSessionContext() {
      legacyChecks++;
      return null;
    }
  }
  const repository = new Repository();
  const app = buildApp({
    authorization: {
      service: new AuthorizationService(repository),
      tenancy: {
        async restoreLandingContext() {
          assert.fail("legacy landing context was restored");
        },
      },
      auth: {
        async authenticate(token) {
          if (token === "invalid") throw new AuthError("session_invalid", 401, "重新登录。");
          return {
            user: { id: token, email_verified_at: token === "unverified" ? null : new Date() },
            session: { id: "no-legacy-context" },
          };
        },
      },
      secureCookie: false,
      accountRehearsalReady: () =>
        requireAccountReadRehearsal({
          async query(sql) {
            assert.match(sql, /contract_version=25/);
            readyChecks++;
            return [ready ? [{ slot: "current" }] : []];
          },
        }),
    },
  });
  const get = (path, token = "account-only") =>
    app.inject({
      url: `/api/v1/me/${path}`,
      headers: { cookie: `scoutops_session=${token}` },
    });
  try {
    assert.equal((await get("landing", "invalid")).statusCode, 401);
    assert.equal((await get("landing", "unverified")).statusCode, 403);
    assert.equal((await get("landing")).statusCode, 503);
    assert.equal((await get("navigation?shell=member")).statusCode, 503);
    ready = true;
    const landing = await get("landing");
    assert.equal(landing.statusCode, 200, landing.body);
    assert.deepEqual(landing.json().data, {
      shell: "member",
      route: "/opportunities",
      reason: "landing_account_rehearsal",
    });
    const navigation = await get("navigation?shell=member");
    assert.equal(navigation.statusCode, 200, navigation.body);
    assert.equal(navigation.headers["cache-control"], "private, no-store");
    assert.deepEqual(navigation.json().data, {
      shell: "member",
      organization_id: null,
      workspace_id: null,
      organization_name: null,
      workspace_name: null,
      roles: [],
      platform_roles: [],
      platform_capabilities: [],
      capabilities: ["opportunity:read", "trend:read", "sourcing:read"],
      guard_reason: "navigation_account_rehearsal",
    });
    assert.equal((await get("navigation?shell=organization_admin")).statusCode, 403);
    assert.equal(legacyChecks, 0);
    assert.equal(readyChecks, 4);
    assert.deepEqual(
      repository.decisions.map((x) => [x.reason, x.outcome]),
      [
        ["landing_account_rehearsal", "allowed"],
        ["navigation_account_rehearsal", "allowed"],
        ["navigation_organization_retired_in_rehearsal", "denied"],
      ],
    );
    assert.ok(
      repository.decisions.every((x) => x.organization_id === null && x.workspace_id === null),
    );
    assert.equal((await get("navigation?shell=platform_admin")).statusCode, 403);
    assert.equal(legacyChecks, 1);
  } finally {
    await app.close();
  }
});

test("an old authenticated organization session cannot reopen legacy routes in account rehearsal", async () => {
  const organizationId = "10000000-0000-4000-8000-000000000001";
  const workspaceId = "10000000-0000-4000-8000-000000000002";
  const webOrigin = "http://127.0.0.1:5173";
  for (const rehearsal of [false, true]) {
    let legacyContextReads = 0;
    let legacyBusinessCalls = 0;
    let idempotencyCalls = 0;
    const tenancy = {
      async listOrganizations() {
        legacyBusinessCalls++;
        return [{ organization_id: organizationId }];
      },
      async listWorkspaces() {
        legacyBusinessCalls++;
        return [];
      },
      async listTeams() {
        legacyBusinessCalls++;
        return [];
      },
      async selectContext(context) {
        legacyBusinessCalls++;
        return context;
      },
      async provisionPersonalWorkspace() {
        legacyBusinessCalls++;
        return { organization_id: organizationId, workspace_id: workspaceId };
      },
    };
    class Repository extends InMemoryAuthorizationRepository {
      async findSessionContext() {
        legacyContextReads++;
        return { organization_id: organizationId, workspace_id: workspaceId };
      }
      async loadSubject(actorId, scope) {
        return {
          membership_active: Boolean(scope),
          role_codes: scope ? ["organization_admin"] : [],
          capabilities: scope ? ["task:assign", "organization:manage"] : [],
          platform_role_codes: actorId === "legacy-admin" ? ["platform_operator"] : [],
          platform_capabilities: actorId === "legacy-admin" ? ["platform:operate"] : [],
          scopes: scope ? [{ scope: "organization" }] : [],
        };
      }
      async resourcesBelongToOrganization() {
        return true;
      }
    }
    const repository = new Repository();
    const authorization = rehearsal
      ? new AccountRehearsalAuthorizationService(repository)
      : new AuthorizationService(repository);
    const auth = {
      async authenticate(token) {
        return {
          user: {
            id: token === "without-platform-role" ? "organization-only" : "legacy-admin",
            email_verified_at: new Date(),
          },
          session: { id: "legacy-session" },
        };
      },
    };
    const common = { auth, secureCookie: false, webOrigin };
    const app = buildApp({
      tenancy: {
        ...common,
        service: tenancy,
        accountReadRehearsal: rehearsal,
        idempotency: {
          async execute(_key, action) {
            idempotencyCalls++;
            return action();
          },
        },
      },
      authorization: {
        ...common,
        service: authorization,
        tenancy,
        ...(rehearsal ? { accountRehearsalReady: async () => {} } : {}),
      },
      audit: { ...common, authorization, service: {}, accountReadRehearsal: rehearsal },
      platformAccounts: { ...common, authorization, service: {}, accountReadRehearsal: rehearsal },
      ...(!rehearsal ? { homeDashboard: { ...common, authorization, service: {} } } : {}),
      resourceGrants: { ...common, authorization, service: {}, accountReadRehearsal: rehearsal },
      organizationAdmin: {
        ...common,
        accountReadRehearsal: rehearsal,
        authorization,
        service: {
          async summary() {
            legacyBusinessCalls++;
            return {};
          },
        },
      },
      approvals: {
        ...common,
        authorization,
        service: {
          async decide() {
            legacyBusinessCalls++;
            return {};
          },
        },
      },
    });
    try {
      const headers = {
        cookie: "scoutops_session=old-cookie",
        origin: webOrigin,
        "idempotency-key": "old-action-key",
      };
      for (const [method, url, payload] of [
        ["GET", "/api/v1/org/memberships"],
        [
          "POST",
          "/api/v1/auth/context",
          { organization_id: organizationId, workspace_id: workspaceId },
        ],
        ["POST", "/api/v1/me/personal-workspace"],
        ["GET", `/api/v1/org/${organizationId}/workspaces`],
        ["GET", `/api/v1/org/${organizationId}/teams`],
        ["GET", "/api/v1/org/admin/summary"],
        ["POST", `/api/v1/tasks/approvals/${workspaceId}/actions`, { action: "approve" }],
      ]) {
        const business = url.startsWith("/api/v1/tasks/approvals/");
        if (!business)
          assert.equal(
            app.hasRoute({
              method,
              url: url.replace(organizationId, ":organizationId"),
            }),
            !rehearsal,
          );
        const result = await app.inject({ method, url, headers, payload });
        assert.equal(
          result.statusCode,
          rehearsal ? (business ? 403 : 404) : url.endsWith("personal-workspace") ? 201 : 200,
          result.body,
        );
        if (rehearsal && business)
          assert.equal(result.json().error.code, "legacy_tenancy_retired_in_rehearsal");
      }
      assert.equal(legacyContextReads, rehearsal ? 0 : 2);
      assert.equal(legacyBusinessCalls, rehearsal ? 0 : 7);
      assert.equal(idempotencyCalls, rehearsal ? 0 : 2);
      for (const [method, url] of [
        ["POST", "/api/v1/platform/accounts/organizations"],
        ["PATCH", "/api/v1/platform/accounts/organizations/:organizationId"],
        ["POST", "/api/v1/platform/accounts/organizations/:organizationId/status"],
        ["POST", "/api/v1/platform/accounts/users/:userId/memberships"],
        ["GET", "/api/v1/organizations/:organizationId/audit-events"],
        ["GET", "/api/v1/me/home-dashboard"],
        ["GET", "/api/v1/me/resource-grants"],
        ["GET", "/api/v1/org/:organizationId/resource-grants"],
        ["GET", "/api/v1/org/:organizationId/roles"],
        ["GET", "/api/v1/org/admin/teams"],
        ["POST", "/api/v1/org/admin/teams"],
        ["POST", "/api/v1/org/admin/teams/:id/members"],
      ]) {
        assert.equal(app.hasRoute({ method, url }), !rehearsal, url);
        if (rehearsal)
          assert.equal(
            (
              await app.inject({
                method,
                url: url.replace(/:(?:organizationId|userId|id)/g, organizationId),
                headers,
              })
            ).statusCode,
            404,
          );
      }
      assert.equal(app.hasRoute({ method: "GET", url: "/api/v1/platform/audit-events" }), true);
      assert.equal(app.hasRoute({ method: "POST", url: "/api/v1/platform/accounts/users" }), true);
      const platform = await app.inject({
        url: "/api/v1/me/navigation?shell=platform_admin",
        headers,
      });
      assert.equal(platform.statusCode, 200, platform.body);
      assert.equal(platform.json().data.account_rehearsal, rehearsal ? true : undefined);
      assert.deepEqual(platform.json().data.platform_capabilities, ["platform:operate"]);
      assert.equal(platform.json().data.organization_id, rehearsal ? null : organizationId);
      assert.equal(platform.json().data.workspace_id, rehearsal ? null : workspaceId);
      assert.deepEqual(platform.json().data.roles, rehearsal ? [] : ["organization_admin"]);
      const denied = await app.inject({
        url: "/api/v1/me/navigation?shell=platform_admin",
        headers: { ...headers, cookie: "scoutops_session=without-platform-role" },
      });
      assert.equal(denied.statusCode, 403, denied.body);
      assert.equal(legacyContextReads, rehearsal ? 0 : 4);
      const decisions = repository.decisions.slice(-2);
      assert.deepEqual(
        decisions.map((decision) => decision.outcome),
        ["allowed", "denied"],
      );
      assert.ok(
        decisions.every(
          (decision) =>
            decision.organization_id === (rehearsal ? null : organizationId) &&
            decision.workspace_id === (rehearsal ? null : workspaceId),
        ),
      );
    } finally {
      await app.close();
    }
  }
});
