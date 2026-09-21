import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  previewTeamsReadResult,
  teamsReadResultChanges,
  teamsParentFile,
  teamsReadResultComponent,
} from "../../scripts/lib/ui-phase2-teams-read-result-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const original = read(teamsParentFile),
  revised = previewTeamsReadResult(original);
const script = parse(revised).descriptor.scriptSetup.content;
const ast = ts.createSourceFile("parent.ts", script, ts.ScriptTarget.Latest, true);
const getFunction = (name) =>
  ast.statements.find((n) => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast);

test("scoped parent correction and feedback component compile and reverse exactly", () => {
  for (const [file, text] of [
    [teamsParentFile, revised],
    [teamsReadResultComponent, read(teamsReadResultComponent)],
  ]) {
    const descriptor = parse(text).descriptor;
    compileScript(descriptor, { id: "read-result" });
    assert.deepEqual(
      compileTemplate({ id: "read-result", filename: file, source: descriptor.template.content })
        .errors,
      [],
    );
  }
  let reverse = revised;
  for (const [before, after] of [...teamsReadResultChanges(original)].reverse()) {
    assert.equal(reverse.split(after).length, 2);
    reverse = reverse.replace(after, before);
  }
  assert.equal(reverse, original);
  assert.doesNotMatch(original, /TeamCreateReadFailure|onRefreshResult|teamCreateGeneration/);
  assert.match(revised, /dismissTokenSecret\(\); clearTeamCreateFeedback\(\);/);
  assert.equal(revised.split("  clearTeamCreateFeedback();\n});").length, 3);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function harness(options = {}) {
  const calls = [],
    readStarted = deferred(),
    writeStarted = deferred();
  const config = { readStatus: 0, writeStatus: 0, ...options };
  class ApiClientError extends Error {
    constructor(status, phase) {
      super(phase);
      Object.assign(this, {
        status,
        kind: status === 403 ? "forbidden" : status === 401 ? "expired" : "error",
        userMessage: phase + "失败",
        actionHint: "",
        requestId: phase + "-trace",
      });
    }
  }
  const api = async (url, init = {}) => {
    calls.push({ url, init });
    if (init.method === "POST") {
      writeStarted.resolve();
      await config.holdWrite?.promise;
      if (config.writeStatus) throw new ApiClientError(config.writeStatus, "write");
      return {
        data: { id: "local-team", name: "团队", status: "active", version: 1 },
        request_id: "write-trace",
      };
    }
    if (url === "/org/admin/summary")
      return { data: { teams: { total: 1 } }, request_id: "summary-trace" };
    readStarted.resolve();
    await config.holdRead?.promise;
    if (config.readStatus) throw new ApiClientError(config.readStatus, "read");
    return {
      data: url.endsWith("members") ? { items: [] } : [{ id: "fresh-team" }],
      request_id: "read-trace",
    };
  };
  const body = ts.transpileModule(
    [
      "clearTeamCreateFeedback",
      "ownsTeamCreateResult",
      "reloadTeamCreateResult",
      "applyFailure",
      "readView",
      "load",
      "submit",
      "createTeam",
    ]
      .map(getFunction)
      .join("\n"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const values = new Function(
    "api",
    "ApiClientError",
    `
    let teamCreateGeneration = 0, surfaceActive = true, loadSequence = 0, tokenSecretGeneration = 0;
    const state={value:"ready"}, view={value:"teams"}, data={value:{teams:[{id:"old-team"}],members:[]}},
      summary={value:{}}, notice={value:""}, noticeKind={value:"info"}, requestId={value:""},
      busy={value:false}, refreshing={value:false}, lastReadFailureStatus={value:null},
      teamCreateWriteRequestId={value:""}, secret={value:""}, form={value:{reason:"preserved"}};
    const rethrowUnexpectedError = (error) => { if (!(error instanceof ApiClientError)) throw error; };
    ${body}
    return {createTeam,submit,reloadTeamCreateResult,load,state,view,data,notice,noticeKind,requestId,
      busy,refreshing,teamCreateWriteRequestId,form,
      leave(){surfaceActive=false;clearTeamCreateFeedback();},
      activate(){surfaceActive=true;}, changeScope(){clearTeamCreateFeedback();}};
  `,
  )(api, ApiClientError);
  return { ...values, calls, config, readStarted, writeStarted };
}
const value = { name: "团队", lead_membership_id: "", default_workflow_key: "", reason: "验证" };

test("201 plus read failure remains a successful creation with distinct read and write traces", async () => {
  const h = harness({ readStatus: 500 });
  assert.equal(await h.createTeam(value), true);
  assert.equal(h.teamCreateWriteRequestId.value, "write-trace");
  assert.equal(h.requestId.value, "read-trace");
  assert.equal(h.noticeKind.value, "error");
  assert.equal(h.notice.value, "read失败");
  assert.deepEqual(h.data.value.teams, [{ id: "old-team" }]);
  assert.deepEqual(JSON.parse(h.calls[0].init.body), value);
  assert.equal(h.calls.filter((c) => c.init.method === "POST").length, 1);
  assert.equal(h.busy.value, false);
});

test("explicit recovery only reads, clears the warning on success and keeps failure on another failed read", async () => {
  const h = harness({ readStatus: 500 });
  await h.createTeam(value);
  await h.reloadTeamCreateResult();
  assert.equal(h.teamCreateWriteRequestId.value, "write-trace");
  assert.equal(h.noticeKind.value, "error");
  h.config.readStatus = 0;
  await h.reloadTeamCreateResult();
  assert.equal(h.teamCreateWriteRequestId.value, "");
  assert.equal(h.notice.value, "团队列表已更新。");
  assert.equal(h.noticeKind.value, "success");
  assert.equal(h.calls.filter((c) => c.init.method === "POST").length, 1);
});

test("write rejection is not reported as created and performs no follow-up reads", async () => {
  const h = harness({ writeStatus: 500 });
  assert.equal(await h.createTeam(value), false);
  assert.equal(h.teamCreateWriteRequestId.value, "");
  assert.equal(h.notice.value, "write失败");
  assert.equal(h.calls.length, 1);
});

test("successful creation keeps original success notice and parent form preservation", async () => {
  const h = harness();
  assert.equal(await h.createTeam(value), true);
  assert.equal(h.notice.value, "团队已创建并写入审计。");
  assert.equal(h.requestId.value, "write-trace");
  assert.deepEqual(h.form.value, { reason: "preserved" });
  assert.equal(h.teamCreateWriteRequestId.value, "");
});

test("401 and 403 reads retain the existing page replacement semantics", async () => {
  for (const [status, expected] of [
    [401, "expired"],
    [403, "forbidden"],
  ]) {
    const h = harness({ readStatus: status });
    assert.equal(await h.createTeam(value), true);
    assert.equal(h.state.value, expected);
    assert.equal(h.noticeKind.value, "error");
    assert.equal(h.teamCreateWriteRequestId.value, "write-trace");
  }
});

test("departed or departed-and-returned creation cannot start a read or overwrite another page", async () => {
  for (const returnBeforeReply of [false, true]) {
    const gate = deferred(),
      h = harness({ holdWrite: gate });
    const pending = h.createTeam(value);
    await h.writeStarted.promise;
    h.leave();
    if (returnBeforeReply) h.activate();
    h.notice.value = "其他页面说明";
    gate.resolve();
    assert.equal(await pending, true);
    assert.equal(h.calls.length, 1);
    assert.equal(h.notice.value, "其他页面说明");
    assert.equal(h.teamCreateWriteRequestId.value, "");
  }
});

test("scope change during post-write reading discards both successful and failed obsolete reads", async () => {
  for (const readStatus of [0, 500]) {
    const gate = deferred(),
      h = harness({ holdRead: gate, readStatus });
    const pending = h.createTeam(value);
    await h.readStarted.promise;
    h.changeScope();
    h.notice.value = "新组织说明";
    gate.resolve();
    assert.equal(await pending, true);
    assert.deepEqual(h.data.value.teams, [{ id: "old-team" }]);
    assert.equal(h.notice.value, "新组织说明");
    assert.equal(h.teamCreateWriteRequestId.value, "");
  }
});

test("busy or inactive recovery has no effect, and legacy submit callers remain opt-out", async () => {
  const h = harness({ readStatus: 500 });
  h.busy.value = true;
  assert.equal(await h.createTeam(value), false);
  await h.reloadTeamCreateResult();
  assert.equal(h.calls.length, 0);
  h.busy.value = false;
  h.leave();
  await h.reloadTeamCreateResult();
  assert.equal(h.calls.length, 0);
  h.activate();
  h.view.value = "workspaces";
  assert.equal(
    await h.submit("/org/admin/workspaces", { name: "旧调用方", reason: "验证" }, "POST", {
      preserveForm: true,
    }),
    true,
  );
  assert.equal(h.noticeKind.value, "success"); // Existing non-P33 behavior intentionally unchanged.
  assert.equal(h.teamCreateWriteRequestId.value, "");
});

test("captured correction packets bind current sources and separate 500 from 403 permission states", () => {
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  for (const status of [500, 403]) {
    const folder = `output/playwright/p33-read-result-${status}-r2`,
      e = JSON.parse(read(`${folder}/evidence.json`));
    assert.equal(e.reviewOnly, true);
    assert.equal(e.approval, "pending");
    assert.equal(e.processesClosed, true);
    assert.equal(e.readFailureStatus, status);
    assert.deepEqual(
      e.runs.map((r) => r.width),
      [390, 840, 841, 1440],
    );
    for (const [file, expected] of Object.entries(e.sourceHashes))
      assert.equal(hash(read(file)), expected, file);
    assert.equal(e.transformedHashes[teamsParentFile], hash(revised));
    for (const shot of e.screenshots)
      assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256);
    for (const run of e.runs) {
      assert.equal(run.requests.filter((r) => r.key === "POST /api/v1/org/admin/teams").length, 3);
      assert.equal(run.requests.filter((r) => r.key === "GET /api/v1/org/admin/teams").length, 4);
    }
  }
});

test("correction capture and unknown flags fail without opening a service", () => {
  for (const arg of ["--capture", "--unknown"]) {
    const r = spawnSync(process.execPath, ["scripts/verify-ui-phase2-teams-read-result.mjs", arg], {
      encoding: "utf8",
    });
    assert.equal(r.status, 1);
    assert.equal(r.stdout, "");
    if (arg === "--capture") assert.match(r.stderr, /Refuse to overwrite/);
  }
});

test("r1 before-style-fix packets remain immutable evidence, not current source claims", () => {
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  for (const [status, expected] of [
    [500, "d89667604df1cf1d431b06ba0b35ce7815b63c41c777041fc0a65609f8d5069a"],
    [403, "0aa91695db3fdb79e8201f223568b8886ae99cdd011415e23db75e05651dd11f"],
  ]) {
    const folder = `output/playwright/p33-read-result-${status}-r1`,
      manifest = read(`${folder}/evidence.json`);
    assert.equal(hash(manifest), expected);
    const e = JSON.parse(manifest);
    assert.equal(e.screenshots.length, 40);
    for (const shot of e.screenshots)
      assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256);
  }
});
