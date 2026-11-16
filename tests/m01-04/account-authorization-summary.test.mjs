import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlAuthorizationRepository } from "../../apps/api/dist/mysql-authorization-repository.js";
import {
  AccountRehearsalAuthorizationService,
  requireAccountReadRehearsal,
} from "../../apps/api/dist/account-read-rehearsal.js";

test("account authorization summary verifies readiness and returns only real platform grants", async () => {
  let ready = false;
  const reads = [];
  const repository = new MySqlAuthorizationRepository({
    async query(sql, values) {
      assert.match(sql, /FROM platform_role_assignments/);
      reads.push(values[0]);
      return [values[0] === "operator" ? [{role_code:"platform_admin",capability_code:"platform:operate"}] : []];
    },
  }, true);
  const app = buildApp({ authorization: {
    service: new AccountRehearsalAuthorizationService(repository),
    auth: { async authenticate(token) { return {
      user:{id:token,email_verified_at:token === "unverified" ? null : new Date()},session:{id:"retired-context"},
    }; }},
    secureCookie:false,
    accountRehearsalReady: () => requireAccountReadRehearsal({async query(){return [ready ? [{slot:"current"}] : []];}}),
  } });
  const get=(actor)=> app.inject({url:"/api/v1/me/authorization",headers:{cookie:`scoutops_session=${actor}`}});
  try {
    assert.equal((await get("unverified")).statusCode,403);
    assert.equal((await get("member")).statusCode,503);
    assert.deepEqual(reads,[]);
    ready=true;
    for (const actor of ["member","operator"]) {
      const response=await get(actor);
      assert.equal(response.statusCode,200,response.body);
      assert.equal(response.headers["cache-control"],"private, no-store");
      assert.deepEqual(response.json().data,{
        organization_id:null,workspace_id:null,roles:[],data_scopes:[],
        capabilities:["opportunity:read","trend:read","sourcing:read"],
        platform_roles:actor === "operator" ? ["platform_admin"] : [],
        platform_capabilities:actor === "operator" ? ["platform:operate"] : [],
      });
    }
    assert.deepEqual(reads,["member","operator"]);
  } finally { await app.close(); }
});
