import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  changeCollectionClaimPause,
  createCollectionClaimFence,
  withCollectionClaimFence,
} from "../../packages/database/dist/index.js";
import { processCollectionTaskOnce } from "../../apps/worker/dist/collection-task-worker.js";
import { MySqlCrawlerRuntimeRepository } from "../../apps/api/dist/mysql-crawler-runtime-repository.js";
import { CrawlerRuntimeError } from "../../apps/api/dist/crawler-runtime-service.js";
import { ProviderAdapterService } from "../../apps/api/dist/provider-adapter-service.js";

const operation = "12345678-1234-4234-8234-123456789abc";
const other = "12345678-1234-4234-8234-123456789abd";
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "scoutops-claim-fence-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let tail = Promise.resolve();
  let locks = 0;
  const connect = (query = () => [[]]) => {
    let acquired;
    return {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
      destroy() {
        acquired?.resolve();
      },
      async query(sql, params) {
        if (sql.includes("GET_LOCK")) {
          locks++;
          const before = tail;
          acquired = deferred();
          tail = acquired.promise;
          await before;
          return [[{ acquired: 1 }]];
        }
        if (sql.includes("RELEASE_LOCK")) {
          acquired.resolve();
          return [[{ released: 1 }]];
        }
        return query(sql, params);
      },
    };
  };
  return { connect, marker: join(directory, "claims.pause"), lockCount: () => locks };
}

test("hot pause waits for the admission transaction, then leaves the acquired task heartbeat and writeback running", async (t) => {
  const f = await fixture(t);
  const claimEntered = deferred(),
    finishClaim = deferred(),
    started = deferred(),
    finishWork = deferred();
  const calls = [];
  let admissionSession;
  const worker = {
    workerId: "worker",
    leaseSeconds: 120,
    claimFence: createCollectionClaimFence(f.marker, async () => f.connect()),
    repository: {
      recoverExpired: async (_now, _actor, connection) => {
        assert.ok(connection);
        admissionSession = connection;
        calls.push("recover");
        return 0;
      },
      queueReady: async (_now, _actor, connection) => {
        assert.equal(connection, admissionSession);
        calls.push("queue");
        return null;
      },
      claim: async (_worker, _now, _ttl, connection) => {
        assert.equal(connection, admissionSession);
        calls.push("claim");
        claimEntered.resolve();
        await finishClaim.promise;
        return { id: "owned-before-pause" };
      },
      start: async () => started.resolve(),
      heartbeat: async () => calls.push("heartbeat"),
      complete: async () => {
        calls.push("complete");
        return { terminalStatus: "succeeded", coverageStatus: "complete" };
      },
    },
    coordinator: { acquire: async () => true, release: async () => calls.push("release") },
    executor: {
      async execute(_task, heartbeat) {
        await finishWork.promise;
        await heartbeat();
        return [];
      },
    },
  };
  const existing = processCollectionTaskOnce(worker);
  await claimEntered.promise;
  const pause = changeCollectionClaimPause(f.connect(), f.marker, "pause", operation);
  await assert.rejects(stat(f.marker), { code: "ENOENT" });
  finishClaim.resolve();
  assert.deepEqual(await pause, { paused: true, maintenanceId: operation });
  await started.promise;
  assert.deepEqual(await processCollectionTaskOnce(worker), {
    status: "idle",
    recovered: 0,
    claim_paused: true,
  });
  assert.deepEqual(calls, ["recover", "queue", "claim"]);
  finishWork.resolve();
  assert.equal((await existing).status, "succeeded");
  assert.deepEqual(calls.slice(-3), ["heartbeat", "complete", "release"]);
  await assert.rejects(
    changeCollectionClaimPause(f.connect(), f.marker, "resume", other),
    /owner_mismatch/,
  );
  assert.equal((await changeCollectionClaimPause(f.connect(), f.marker, "status")).paused, true);
  assert.equal(
    (await changeCollectionClaimPause(f.connect(), f.marker, "resume", operation)).paused,
    false,
  );
  await processCollectionTaskOnce(worker);
  assert.equal(calls.filter((x) => x === "claim").length, 2);
});

test("paused API rejects standalone claims but leases only a browser child with a still-valid parent", async (t) => {
  const f = await fixture(t);
  await changeCollectionClaimPause(f.connect(), f.marker, "pause", operation);
  let validParent = false;
  const calls = [];
  const repo = new MySqlCrawlerRuntimeRepository(
    {
      getConnection: async () =>
        f.connect((sql, params) => {
          calls.push(sql);
          if (sql.includes("SELECT j.*")) {
            assert.match(sql, /t\.id=j\.collection_task_id/);
            assert.match(sql, /owner\.lease_token_hash=t\.lease_token_hash/);
            return [
              [
                {
                  id: "browser-job",
                  collection_task_id: "owned",
                  organization_id: "org",
                  workspace_id: "ws",
                  payload_ciphertext: Buffer.alloc(1),
                  payload_nonce: Buffer.alloc(1),
                  payload_auth_tag: Buffer.alloc(1),
                },
              ],
            ];
          }
          if (sql.startsWith("SELECT t.id")) {
            assert.match(sql, /owner\.expires_at>NOW\(3\).*FOR UPDATE/);
            assert.deepEqual(params, ["owned", "org", "ws"]);
            return [validParent ? [{ id: "owned" }] : []];
          }
          if (sql.startsWith("SELECT j.organization_id,j.workspace_id"))
            return [
              [
                {
                  collection_task_id: "owned",
                  status: "leased",
                  organization_id: "org",
                  workspace_id: "ws",
                },
              ],
            ];
          if (sql.startsWith("SELECT organization_id,workspace_id"))
            return [[{ organization_id: "org", workspace_id: "ws" }]];
          if (/^(INSERT|UPDATE|DELETE)/.test(sql)) return [{ affectedRows: 1 }];
          return [[]];
        }),
    },
    "",
    "",
    f.marker,
  );
  const now = new Date();
  const input = {
    actorId: "actor",
    idempotencyKey: "key",
    now,
    expiresAt: now,
    completionSpool: {},
    leaseOwner: "crawler",
    leaseTokenHash: "token",
    leaseId: "lease",
    runId: "run",
  };
  await assert.rejects(repo.acquire(input), { code: "crawler_claims_paused" });
  assert.equal(
    calls.some((sql) => /^(INSERT|UPDATE|DELETE)/.test(sql)),
    false,
  );
  assert.equal(await repo.acquireJob(input), null);
  assert.equal(
    calls.some((sql) => /INSERT INTO crawler_browser_runs/.test(sql)),
    false,
  );
  validParent = true;
  assert.equal((await repo.acquireJob(input)).job.collection_task_id, "owned");
  assert.ok(calls.some((sql) => /SET status='leased'/.test(sql)));
  const locks = f.lockCount();
  await repo.heartbeatJob({ ...input, jobId: "browser-job", profileId: "profile" });
  await repo.finishJob({
    ...input,
    jobId: "browser-job",
    profileId: "profile",
    status: "succeeded",
    result: { kept: true },
  });
  assert.equal(f.lockCount(), locks);
  assert.ok(calls.some((sql) => /SET heartbeat_at=/.test(sql)));
  assert.ok(calls.some((sql) => /SET status=\?,result_json=\?/.test(sql)));
});

test("uncertain SQL session is discarded without losing the committed admission result", async (t) => {
  const { marker } = await fixture(t);
  let discarded = 0;
  const result = await withCollectionClaimFence(
    {
      destroy: () => discarded++,
      async query(sql) {
        if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
        throw new Error("lost session");
      },
    },
    marker,
    async () => "committed",
  );
  assert.equal(result, "committed");
  assert.equal(discarded, 1);
});

test("maintenance denial is not persisted as a failed Amazon provider health observation", async () => {
  let writes = 0;
  const service = new ProviderAdapterService(
    {
      getProvider: async () => ({ code: "amazon_product", accessMode: "public_page" }),
      findReplay: async () => null,
      recordHealth: async () => writes++,
    },
    { has: () => true, describe: () => [] },
    undefined,
    async () => {
      throw new CrawlerRuntimeError("crawler_claims_paused", 409, "maintenance");
    },
  );
  await assert.rejects(
    service.probe(operation, { actorId: "operator", idempotencyKey: "pause-check" }),
    { code: "crawler_claims_paused", statusCode: 409 },
  );
  assert.equal(writes, 0);
});
