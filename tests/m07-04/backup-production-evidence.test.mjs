import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("synthetic recovery evidence must prove CRC, replay, cleanup and bounded numeric observations", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-recovery-evidence-test-"));
  const gitDirectory = execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
    encoding: "utf8",
  }).trim();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  try {
    await mkdir(join(root, "infra/baota"), { recursive: true });
    await mkdir(join(root, ".artifacts/verification"), { recursive: true });
    await writeFile(
      join(root, "infra/baota/backup-recovery-manifest.json"),
      await readFile("infra/baota/backup-recovery-manifest.json"),
    );
    const evidence = {
      schemaVersion: 1,
      releaseCommit: head,
      manager: "baota",
      primaryRegion: "惠州",
      recoveryRegion: "惠州",
      hostFailureProtected: false,
      capturedAt: new Date().toISOString(),
      backup: {
        encrypted: true,
        integrityVerified: true,
        pitrVerified: true,
        coordinatesEmbedded: true,
        binlogRetentionDays: 1,
        rpoMinutes: 1,
        postSnapshotProbeVerified: true,
        replayBoundary: {
          rowEvents: 1,
          mapEvents: 1,
          targetDatabase: "product_scout_restore_m0704_0123456789ab",
          eventChecksumsVerified: true,
        },
      },
      recoveryCopy: {
        region: "惠州",
        sameHost: true,
        separateEncryptedRoot: true,
        integrityVerified: true,
      },
      restoreDrill: {
        isolated: true,
        rtoMinutes: 1,
        businessDataVerified: true,
        auditChainVerified: true,
        evidenceHashVerified: true,
        permissionBoundaryVerified: true,
      },
      cleanup: { sourceProbeRemoved: true, isolatedDatabaseRemoved: true, plaintextRemoved: true },
    };
    const run = async (value) => {
      await writeFile(
        join(root, ".artifacts/verification/backup-recovery-production-evidence.json"),
        JSON.stringify(value),
      );
      return spawnSync(
        process.execPath,
        [resolve("scripts/verify-backup-recovery-production.mjs"), "--production"],
        { cwd: root, env: { ...process.env, GIT_DIR: gitDirectory }, encoding: "utf8" },
      );
    };
    assert.equal((await run(evidence)).status, 0);
    const mutations = [
      (e) => {
        delete e.backup.replayBoundary.eventChecksumsVerified;
      },
      (e) => {
        delete e.backup.replayBoundary.rowEvents;
      },
      (e) => {
        e.backup.rpoMinutes = null;
      },
      (e) => {
        e.restoreDrill.rtoMinutes = -1;
      },
      (e) => {
        e.restoreDrill.auditChainVerified = "true";
      },
      (e) => {
        e.cleanup.plaintextRemoved = false;
      },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(evidence);
      mutate(changed);
      const result = await run(changed);
      assert.equal(result.status, 2, result.stderr);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
