import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";

test("crawler preserves historical reads and removes standalone legacy leases in retired mode", async () => {
  const runtime = "/api/v1/internal/crawler-runtime";
  const platformRuntime = "/api/v1/platform/crawler-runtime";
  const scheduler = "/api/v1/platform/operations/crawler-scheduler";
  const webOrigin = "http://127.0.0.1:5173";
  const paths = [
    `${runtime}/acquire`,
    `${runtime}/run/heartbeat`,
    `${runtime}/run/complete`,
    `${runtime}/jobs/acquire`,
    `${runtime}/jobs/job/heartbeat`,
    `${runtime}/jobs/job/complete`,
    `${platformRuntime}/recover-expired`,
    `${scheduler}/recover-expired`,
    `${scheduler}/providers/provider/recover`,
  ];
  for (const mode of ["legacy", "rehearsal", "retired"]) {
    const accountReadRehearsal = mode === "rehearsal";
    const retiredAccountMode = mode === "retired";
    const touched = [];
    const service = new Proxy(
      {},
      {
        get: (_target, key) => async () => {
          touched.push(key);
          return { recorded: true };
        },
      },
    );
    const common = {
      auth: {
        async authenticate() {
          return { user: { id: "actor" } };
        },
      },
      authorization: { async authorize() {} },
      secureCookie: false,
      webOrigin,
      accountReadRehearsal,
      service,
    };
    const app = buildApp({
      crawlerRuntime: {
        ...common,
        retiredAccountMode,
        serviceToken: "local-fixture-token",
        serviceActorId: "crawler-fixture",
        ...(accountReadRehearsal || retiredAccountMode
          ? { handoff: { root: "unused", isLive: assert.fail, audit: assert.fail } }
          : {}),
      },
      crawlerScheduler: common,
    });
    try {
      const headers = {
        authorization: "Bearer local-fixture-token",
        cookie: "scoutops_session=fixture",
        origin: webOrigin,
        "idempotency-key": "fixture-crawler-key",
      };
      for (const [index, url] of paths.entries()) {
        const retiredStandalone = retiredAccountMode && index < 3;
        const reply = await app.inject({ method: "POST", url, headers, payload: {} });
        assert.equal(
          reply.statusCode,
          retiredStandalone ? 404 : accountReadRehearsal ? 403 : 200,
          `${mode} ${url}: ${reply.body}`,
        );
        if (accountReadRehearsal)
          assert.equal(reply.json().error.code, "crawler_writes_disabled_in_account_rehearsal");
      }
      const rejected = await app.inject({
        method: "POST",
        url: `${runtime}/jobs/acquire`,
        payload: {},
      });
      assert.equal(rejected.statusCode, 401);
      if (accountReadRehearsal || retiredAccountMode) {
        assert.equal(
          app.hasRoute({ method: "GET", url: "/api/v1/platform/crawler-handoffs" }),
          false,
        );
      }
      if (accountReadRehearsal) assert.deepEqual(touched, []);
      else if (retiredAccountMode) {
        assert.deepEqual(touched, [
          "acquireJob",
          "heartbeatJob",
          "finishJob",
          "recoverExpired",
          "recoverExpired",
          "recoverProvider",
        ]);
      } else assert.equal(touched.length, paths.length);
      for (const url of [platformRuntime, scheduler]) {
        const reply = await app.inject({ url, headers });
        assert.equal(reply.statusCode, 200, reply.body);
      }
      assert.deepEqual(touched.slice(-2), ["list", "read"]);
    } finally {
      await app.close();
    }
  }
});
