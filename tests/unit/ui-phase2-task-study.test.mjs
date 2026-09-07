import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve("design-plans/ui-phase-2-2026-09-07");
const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value.replace(/\r\n/g, "\n") : value)
    .digest("hex");
const readJson = async (file) => JSON.parse(await readFile(resolve(root, file), "utf8"));

test("task Vue evidence preserves fixture boundary and every expected modal open/cancel case", async () => {
  for (const directory of ["runtime/tasks", "design/tasks"]) {
    const evidence = await readJson(`${directory}/evidence.json`);
    const baseline = await readJson("baseline.json");
    assert.equal(evidence.sourceFingerprint, baseline.sourceFingerprint);
    if (evidence.proposal) {
      assert.equal(
        evidence.proposal.sha256,
        digest(await readFile(evidence.proposal.path, "utf8")),
      );
      assert.equal(evidence.proposal.productionImported, false);
      assert.equal(evidence.proposal.approval, "pending-user-review");
    }
    assert.match(
      evidence.kind,
      directory.startsWith("runtime") ? /not-production/ : /not-approved/,
    );
    assert.equal(evidence.fixtureSha256, digest(await readFile(evidence.fixturePath, "utf8")));
    assert.equal(evidence.screenshots.length, 18);
    assert.equal(evidence.cases.length, 14);
    const states = new Set();
    for (const shot of evidence.screenshots) {
      assert.equal(shot.sha256, digest(await readFile(resolve(root, shot.file))));
      assert.equal(shot.pageOverflow, false);
      assert.ok(["P23", "P24"].includes(shot.routeId));
      assert.ok([1440, 390].includes(shot.viewport.width));
      assert.ok(shot.concretePath.startsWith("/tasks"));
      assert.ok(!states.has(`${shot.viewport.width}/${shot.state}`));
      states.add(`${shot.viewport.width}/${shot.state}`);
    }
    for (const width of [1440, 390]) {
      for (const action of ["pause", "delay", "transfer", "cancel"]) {
        const result = evidence.cases.find(
          (item) => item.id === `task.detail.${action}.open` && item.viewport.width === width,
        );
        assert.ok(result);
        assert.equal(result.writeRequests, 0);
        assert.equal(result.focusReturn, "opener");
        assert.equal(result.escape, "closed");
      }
      const submit = evidence.cases.find(
        (item) => item.id === "task.detail.progress.submit" && item.viewport.width === width,
      );
      assert.equal(submit.requests, 1);
      assert.equal(submit.request.body.action, "progress");
      assert.equal(submit.request.body.expected_version, 2);
      assert.equal(submit.request.body.progress_percent, 45);
      assert.match(submit.status, /not-database-execution/);
    }
  }
});

test("independent structure proposals contain both directions and never claim Vue or user approval", async () => {
  const evidence = await readJson("design/directions/evidence.json");
  assert.match(evidence.kind, /not-vue-not-production/);
  assert.equal(evidence.approval, "pending-user-review");
  assert.equal(
    evidence.sourceSha256,
    digest(await readFile(resolve(root, evidence.source), "utf8")),
  );
  assert.equal(evidence.fixtureSha256, digest(await readFile(evidence.fixturePath, "utf8")));
  assert.equal(evidence.screenshots.length, 12);
  for (const width of [1440, 390]) {
    for (const direction of ["focus", "brief"]) {
      for (const state of ["list", "detail", "progress"]) {
        const matches = evidence.screenshots.filter(
          (item) =>
            item.viewport.width === width && item.direction === direction && item.state === state,
        );
        assert.equal(matches.length, 1);
        assert.equal(matches[0].sha256, digest(await readFile(resolve(root, matches[0].file))));
      }
    }
  }
});

test("review entry points resolve locally and prototype data cannot close a script tag", async () => {
  const review = await readFile(resolve(root, "review.html"), "utf8");
  assert.ok(review.includes('href="design/task-directions.html"'));
  assert.ok(review.includes('href="design/task-review.html"'));
  const data = await readFile(resolve(root, "design/task-concept-data.js"), "utf8");
  assert.ok(!data.includes("<"));
  const match = /^window\.SCOUTOPS_TASK_CONCEPT = (.*);\s*$/s.exec(data);
  assert.ok(match);
  const value = JSON.parse(match[1]);
  assert.equal(value.kind, "isolated-fixture-design-only");
  assert.equal(value.fixtureSha256, digest(await readFile(value.fixturePath, "utf8")));
});
