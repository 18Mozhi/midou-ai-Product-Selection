import assert from "node:assert/strict";
import test from "node:test";
import { AuthorizationError } from "@scoutops/authorization";
import { buildApp } from "../../apps/api/dist/app.js";
import { ProfitService } from "../../apps/api/dist/profit-service.js";

const origin = "http://127.0.0.1:5173";
const ruleId = "00000000-0000-4000-8000-000000000445";
const primaryEmail = "2313645627@qq.com";

test("only the verified primary can use the historical cost approval slot and scope still applies", async () => {
  const users = {
    primary: [primaryEmail, true, [], true],
    oldAdmin: ["admin@example.invalid", true, ["organization_admin"], true],
    unverified: [primaryEmail, false, ["organization_admin"], true],
    noCapability: [primaryEmail, true, [], false],
    manager: ["manager@example.invalid", true, ["selection_manager"], true],
  };
  const decisions = [];
  const app = buildApp({
    profit: {
      secureCookie: false,
      webOrigin: origin,
      auth: {
        async authenticate(id) {
          const [email_normalized, verified] = users[id];
          return {
            user: { id, email_normalized, email_verified_at: verified ? new Date() : null },
            session: { id: "session" },
          };
        },
      },
      authorization: {
        async resolveSession(actor) {
          return {
            context: { organization_id: "org", workspace_id: "scope" },
            subject: { role_codes: users[actor][2] },
          };
        },
        async authorize(check) {
          assert.equal(check.organizationId, "org");
          assert.equal(check.workspaceId, "scope");
          if (check.capability === "opportunity:approve" && !users[check.actorId][3]) {
            throw new AuthorizationError("capability_missing", 403, "Denied");
          }
        },
      },
      service: new ProfitService({
        async listRules() {
          return [];
        },
        async actRule(input) {
          decisions.push([input.actorId, input.approvalRole, input.action]);
          return { id: input.ruleId };
        },
      }),
    },
  });
  const headers = (actor) => ({
    cookie: `scoutops_session=${actor}`,
    origin,
    "idempotency-key": `test-${actor}-cost-rule-key`,
  });
  const action = (actor, approval_role, verb = "approve", extras = {}) =>
    app.inject({
      method: "POST",
      url: `/api/v1/cost-rules/${ruleId}/actions`,
      headers: headers(actor),
      payload: {
        action: verb,
        approval_role,
        reason: "approved fixture",
        expected_revision: 1,
        ...extras,
      },
    });
  try {
    for (const [actor, expected] of [
      ["primary", true],
      ["oldAdmin", false],
      ["unverified", false],
    ]) {
      const response = await app.inject({ url: "/api/v1/cost-rules", headers: headers(actor) });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.headers["cache-control"], "private, no-store");
      assert.deepEqual(response.json().data, []);
      assert.deepEqual(response.json().meta, { is_primary_approver: expected });
    }
    for (const verb of ["approve", "reject"]) {
      const allowed = await action("primary", "primary_account", verb);
      assert.equal(allowed.statusCode, 200, allowed.body);
      assert.equal((await action("primary", "organization_admin", verb)).statusCode, 403);
      for (const actor of ["oldAdmin", "unverified", "manager", "noCapability"]) {
        const denied = await action(actor, "primary_account", verb, { isPrimaryApprover: true });
        assert.equal(denied.statusCode, 403, denied.body);
      }
    }
    assert.equal((await action("manager", "selection_manager")).statusCode, 200);
    assert.equal((await action("primary", "selection_manager")).statusCode, 403);
    assert.deepEqual(decisions, [
      ["primary", "primary_account", "approve"],
      ["primary", "primary_account", "reject"],
      ["manager", "selection_manager", "approve"],
    ]);
  } finally {
    await app.close();
  }
});
