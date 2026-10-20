import assert from "node:assert/strict";
import test from "node:test";
import {
  PublicRssRecovery,
  publicRssRecoveryCandidatesSql,
} from "../../apps/api/dist/public-rss-recovery.js";
import { CrawlerSchedulerRepository } from "../../apps/api/dist/crawler-scheduler-repository.js";

const now = new Date("2026-10-18T03:00:00Z");
const openedAt = new Date("2026-10-18T02:30:00Z");
const candidate = { id: "00000000-0000-4000-8000-000000000015", version: 2, opened_at: openedAt };
const options = {
  enabled: true,
  actorId: "00000000-0000-4000-8000-000000000016",
  pollMs: 60000,
  cooldownMs: 300000,
};
function fixture({ rows = [candidate], status = "ready", probe } = {}) {
  const calls = [];
  const worker = new PublicRssRecovery(
    {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return [rows];
      },
    },
    {
      probe: async (...args) => {
        calls.push({ probe: args });
        return probe ? probe(...args) : { health_status: status };
      },
    },
    {
      recoverProvider: async (input) => {
        calls.push({ recover: input });
        return { recovered: true };
      },
    },
    options,
    () => now,
  );
  return { worker, calls };
}

test("RSS recovery binds cooldown, active actor and existing approved source policy", async () => {
  const f = fixture();
  assert.equal((await f.worker.processOnce()).status, "recovered");
  const query = f.calls[0];
  assert.equal(query.sql, publicRssRecoveryCandidatesSql);
  assert.equal(query.params[0], options.actorId);
  assert.deepEqual(query.params.slice(-2), [new Date(now - 300000), new Date(now - 300000)]);
  assert.match(query.sql, /p\.terms_review_status='approved'/);
  assert.match(query.sql, /c\.last_error_code IN \('network_error','timeout','rate_limited'\)/);
  const recovery = f.calls.at(-1).recover;
  assert.deepEqual(recovery.automaticRecovery, { providerVersion: 2, openedAt });
  assert.equal(recovery.actorId, options.actorId);
  assert.equal(recovery.requestId, f.calls[1].probe[1].requestId);
});

for (const status of ["blocked", "degraded", "unknown"])
  test(`RSS recovery never closes a source after ${status} health`, async () => {
    const f = fixture({ status });
    assert.equal((await f.worker.processOnce()).status, status);
    assert.equal(
      f.calls.some((call) => call.recover),
      false,
    );
  });

test("RSS recovery idle and disabled states perform no health or recovery writes", async () => {
  const f = fixture({ rows: [] });
  assert.equal((await f.worker.processOnce()).status, "idle");
  assert.equal(f.calls.length, 1);
  for (const override of [{ enabled: false }, { actorId: "" }]) {
    const worker = new PublicRssRecovery(
      { query: () => assert.fail("disabled query") },
      {},
      {},
      { ...options, ...override },
    );
    assert.equal((await worker.processOnce()).status, "disabled");
    worker.start();
    await worker.stop();
  }
});

test("RSS recovery does not overlap probes and shutdown waits for the active probe", async () => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture({ probe: () => pending });
  const first = f.worker.processOnce();
  await Promise.resolve();
  assert.equal((await f.worker.processOnce()).status, "busy");
  let stopped = false;
  const stop = f.worker.stop().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  assert.equal(stopped, false);
  release({ health_status: "blocked" });
  await first;
  await stop;
  assert.equal(stopped, true);
  assert.equal((await f.worker.processOnce()).status, "disabled");
  assert.equal(f.calls.filter((call) => call.sql).length, 1);
});

function repositoryFixture({
  version = 2,
  review = "approved",
  permanent = 1,
  expires = null,
  circuitOpened = openedAt,
  error = "timeout",
  checked = now,
  state = "open",
  providerCode = "google_trends_rss",
  accessMode = "public_rss",
} = {}) {
  const writes = [],
    reads = [];
  let committed = false,
    rolledBack = false;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {
      committed = true;
    },
    rollback: async () => {
      rolledBack = true;
    },
    release() {},
    async query(sql, params) {
      if (sql.startsWith("SELECT")) reads.push(sql);
      if (sql.startsWith("SELECT result_json")) return [[]];
      if (sql.startsWith("SELECT id,status FROM providers"))
        return [[{ id: candidate.id, status: "enabled" }]];
      if (sql.startsWith("SELECT state,opened_at")) return [[{ state, opened_at: circuitOpened }]];
      if (sql.startsWith("SELECT version,terms_review_status"))
        return [
          [
            {
              version,
              terms_review_status: review,
              terms_version: "reviewed",
              terms_permanent: permanent,
              terms_expires_at: expires,
              code: providerCode,
              access_mode: accessMode,
            },
          ],
        ];
      if (sql.startsWith("SELECT last_error_code")) return [[{ last_error_code: error }]];
      if (sql.startsWith("SELECT health_status"))
        return [[{ health_status: "ready", last_checked_at: checked }]];
      writes.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };
  return {
    repository: new CrawlerSchedulerRepository({ getConnection: async () => connection }),
    writes,
    reads,
    state: () => ({ committed, rolledBack }),
  };
}
const recoveryInput = {
  actorId: options.actorId,
  providerId: candidate.id,
  requestId: "rss-auto",
  traceId: "rss-auto",
  idempotencyKey: "rss-auto",
  now,
  automaticRecovery: { providerVersion: 2, openedAt },
};
for (const [name, change, code] of [
  ["changed definition", { version: 3 }, "configuration_changed"],
  ["revoked review", { review: "pending" }, "configuration_changed"],
  ["expired review", { permanent: 0, expires: openedAt }, "configuration_changed"],
  ["new circuit incident", { circuitOpened: new Date(openedAt.getTime() + 1) }, "circuit_changed"],
  ["new policy denial", { error: "permission_denied" }, "circuit_changed"],
  ["already closed circuit", { state: "closed" }, "circuit_changed"],
  ["stale ready check", { checked: openedAt }, "evidence_required"],
])
  test(`automatic recovery atomically refuses ${name}`, async () => {
    const f = repositoryFixture(change);
    await assert.rejects(f.repository.recoverProvider(recoveryInput), (error) =>
      error.code.endsWith(code),
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.state(), { committed: false, rolledBack: true });
  });

test("automatic recovery retains existing operation and platform audit writes", async () => {
  const f = repositoryFixture();
  assert.equal((await f.repository.recoverProvider(recoveryInput)).recovered, true);
  assert.match(
    f.reads.find((sql) => sql.startsWith("SELECT version,terms_review_status")),
    /FOR UPDATE$/,
  );
  assert.match(
    f.reads.find((sql) => sql.startsWith("SELECT last_error_code")),
    /FOR UPDATE$/,
  );
  assert.deepEqual(f.state(), { committed: true, rolledBack: false });
  assert.equal(
    f.writes.filter((call) => call.sql.startsWith("UPDATE provider_runtime_circuits")).length,
    1,
  );
  assert.equal(
    f.writes.filter((call) => call.sql.startsWith("INSERT INTO crawler_scheduler_operations"))
      .length,
    1,
  );
  assert.equal(
    f.writes.filter((call) => call.sql.startsWith("INSERT INTO platform_audit_events")).length,
    1,
  );
});

test("CAPTCHA recovery remains atomic and exclusive to the opted-in public Amazon path", async () => {
  for (const error of ["captcha", "blocked_captcha"]) {
    const good = repositoryFixture({
      error,
      providerCode: "amazon_product",
      accessMode: "public_page",
    });
    assert.equal(
      (
        await good.repository.recoverProvider({
          ...recoveryInput,
          automaticRecovery: { ...recoveryInput.automaticRecovery, captchaHandoff: true },
        })
      ).recovered,
      true,
    );
  }
  for (const [change, enabled] of [
    [{ error: "captcha", providerCode: "amazon_product", accessMode: "public_page" }, false],
    [{ error: "captcha" }, true],
    [
      { error: "captcha", providerCode: "amazon_product", accessMode: "authenticated_browser" },
      true,
    ],
    [
      { error: "permission_denied", providerCode: "amazon_product", accessMode: "public_page" },
      true,
    ],
    [
      {
        error: "captcha",
        providerCode: "amazon_product",
        accessMode: "public_page",
        checked: openedAt,
      },
      true,
    ],
  ]) {
    const f = repositoryFixture(change);
    await assert.rejects(
      f.repository.recoverProvider({
        ...recoveryInput,
        automaticRecovery: {
          ...recoveryInput.automaticRecovery,
          ...(enabled ? { captchaHandoff: true } : {}),
        },
      }),
    );
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.state(), { committed: false, rolledBack: true });
  }
});
