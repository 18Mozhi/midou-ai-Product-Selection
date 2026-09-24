import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { assertCaptureSourceRevision } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";

const folder = "output/playwright/p36-write-lifecycle";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const evidence = JSON.parse(read(`${folder}/evidence.json`));
test("P36 write diagnostic pins current production sources and all76 evidence images", () => {
  assert.equal(evidence.kind, "P36-WRITE-LIFECYCLE-r1");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.checks.length, 288);
  assert.equal(evidence.runs.length, 28);
  assert.equal(evidence.screenshots.length, 76);
  assert.match(evidence.scope, /Diagnostic findings are not acceptance passes/);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assertCaptureSourceRevision(file, read(file), sha);
  const scenarios = [
    "success",
    "write409",
    "write500",
    "read500",
    "read403",
    "reason-deactivate",
    "pending-deactivate",
  ];
  assert.deepEqual(
    evidence.screenshots.map((shot) => shot.file).sort(),
    [390, 1440]
      .flatMap((width) =>
        ["rotate", "revoke"].flatMap((action) =>
          scenarios.flatMap((scenario) =>
            (scenario === "reason-deactivate"
              ? ["restored-reason"]
              : ["pending", "notice", scenario === "read403" ? "page-failure" : "records"]
            ).map((state) => `${width}-${action}-${scenario}-${state}.png`),
          ),
        ),
      )
      .sort(),
  );
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["index.html", "evidence.json", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
});
test("P36 isolated successful and failed writes retain exact payload and no automatic replay", () => {
  for (const run of evidence.runs) {
    const posts = run.requests.filter((request) => request.method === "POST");
    assert.equal(posts.length, run.scenario === "reason-deactivate" ? 0 : 1);
    if (posts.length) {
      assert.equal(
        posts[0].path,
        "/api/v1/org/admin/tokens/00000000-0000-4000-8000-000000000900/actions",
      );
      assert.equal(posts[0].idempotency, true);
      assert.deepEqual(posts[0].body, {
        action: run.action,
        expected_version: 5,
        reason: "定期维护隔离测试",
      });
    }
    const names = evidence.checks
      .filter(
        (check) =>
          check.width === run.width &&
          check.action === run.action &&
          check.scenario === run.scenario,
      )
      .map((check) => check.name);
    for (const name of ["zero external requests", "zero browser errors", "zero storage"])
      assert.ok(names.includes(name), name);
    if (run.scenario.startsWith("write")) {
      assert.equal(run.observation.kind, "error");
      assert.deepEqual(run.observation.rowStates, ["active"]);
      assert.equal(run.observation.secret, 0);
      assert.ok(names.includes("manual retry reason is blank"));
    }
    if (run.scenario === "pending-deactivate") assert.equal(run.observation.secret, 0);
    if (run.scenario === "success")
      assert.equal(run.observation.secret, run.action === "rotate" ? 1 : 0);
  }
});
test("P36 diagnostic explicitly reproduces masked read failure and nonmodal restored draft, not product acceptance", () => {
  assert.equal(evidence.findings.length, 12);
  for (const width of [390, 1440])
    for (const action of ["rotate", "revoke"]) {
      const matching = evidence.findings.filter(
        (run) => run.width === width && run.action === action,
      );
      assert.deepEqual(
        matching.map((run) => run.scenario),
        ["read500", "read403", "reason-deactivate"],
      );
      for (const run of matching.filter((run) => run.scenario.startsWith("read"))) {
        assert.equal(run.observation.kind, "success");
        assert.equal(run.observation.role, "status");
        assert.equal(run.observation.notice.includes("隔离请求未完成"), false);
        if (run.scenario === "read500") assert.deepEqual(run.observation.rowStates, ["active"]);
        else {
          assert.deepEqual(run.observation.pageFailure, ["无权管理当前组织"]);
          assert.deepEqual(run.observation.rowStates, []);
          assert.equal(run.observation.secret, 0);
        }
      }
      assert.deepEqual(matching[2].observation, {
        open: true,
        modal: false,
        connected: true,
        value: "  定期维护隔离测试  ",
      });
    }
});
