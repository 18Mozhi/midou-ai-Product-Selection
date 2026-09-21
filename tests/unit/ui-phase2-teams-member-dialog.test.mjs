import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  previewTeamsMemberParent,
  previewTeamsMemberDialog,
  previewTeamsMemberPanel,
  teamsMemberParentChanges,
  teamsMemberDialogChanges,
  teamsMemberPanelChanges,
  teamsMemberDialogFile,
} from "../../scripts/lib/ui-phase2-teams-member-dialog-preview.mjs";
import { previewTeamsRecoveryFocus } from "../../scripts/lib/ui-phase2-teams-recovery-focus-preview.mjs";
import { previewTeamsCreateStates } from "../../scripts/lib/ui-phase2-teams-create-states-preview.mjs";
import { teamsParentFile } from "../../scripts/lib/ui-phase2-teams-read-result-preview.mjs";
import { teamsVueFile } from "../../scripts/lib/ui-phase2-teams-vue-preview.mjs";
import { assertOrganizationReasonContract } from "../../scripts/lib/ui-phase2-organization-reason-contract.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const parent = read(teamsParentFile),
  dialog = read(teamsMemberDialogFile),
  panel = read(teamsVueFile);
const updatedParent = previewTeamsMemberParent(parent),
  updatedDialog = previewTeamsMemberDialog(dialog),
  updatedPanel = previewTeamsMemberPanel(panel);
function fn(source, name) {
  const ast = ts.createSourceFile(
    "component.ts",
    parse(source).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  return ast.statements
    .find((n) => ts.isFunctionDeclaration(n) && n.name.text === name)
    .getText(ast);
}
const js = (code) =>
  ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("all three actual Vue compositions compile and reverse exactly", () => {
  for (const [file, changed, previous, changes] of [
    [teamsParentFile, updatedParent, previewTeamsRecoveryFocus(parent), teamsMemberParentChanges],
    [teamsMemberDialogFile, updatedDialog, dialog, teamsMemberDialogChanges],
    [teamsVueFile, updatedPanel, previewTeamsCreateStates(panel), teamsMemberPanelChanges],
  ]) {
    const d = parse(changed).descriptor;
    compileScript(d, { id: "member-dialog" });
    assert.deepEqual(
      compileTemplate({ source: d.template.content, filename: file, id: "member-dialog" }).errors,
      [],
    );
    let reversed = changed;
    for (const [before, after] of [...changes].reverse()) {
      assert.equal(reversed.split(after).length, 2);
      reversed = reversed.replace(after, before);
    }
    assert.equal(reversed, previous);
  }
  for (const name of ["submit", "handleTab"])
    assert.equal(fn(updatedDialog, name), fn(dialog, name));
});

test("generic dialog reason limits remain optional in actual SSR", async () => {
  assert.deepEqual(await assertOrganizationReasonContract(updatedDialog, updatedParent), {
    defaultMaximum: null,
    explicitMaximum: 500,
    minimum: 2,
    required: true,
  });
});

function parentHarness() {
  const gate = deferred(),
    context = { value: null },
    calls = [],
    notice = { value: "" };
  const data = {
    value: { members: [{ id: "member-1", display_name: "采购", email: "buyer@example.test" }] },
  };
  const auditedReason = (action) => {
    calls.push({ reasonAction: action });
    return gate.promise;
  };
  const submit = async (...args) => {
    calls.push({ submit: args });
    return false;
  };
  const action = new Function(
    "data",
    "teamMemberReason",
    "auditedReason",
    "submit",
    "notice",
    js(fn(updatedParent, "teamMemberAction")) + ";return teamMemberAction;",
  )(data, context, auditedReason, submit, notice);
  return { gate, context, calls, data, action };
}
test("confirmation identity is a snapshot, while API target/body stay unchanged", async () => {
  const h = parentHarness(),
    item = { id: "team-1", name: "采购团队" };
  const pending = h.action(item, "assign", "member-1");
  assert.deepEqual(h.context.value, {
    teamName: "采购团队",
    memberLabel: "采购 · buyer@example.test",
    action: "assign",
  });
  h.data.value.members[0].display_name = "后来名称";
  item.name = "后来团队名称";
  assert.equal(h.context.value.teamName, "采购团队");
  assert.equal(h.context.value.memberLabel, "采购 · buyer@example.test");
  h.gate.resolve("加入协作");
  assert.equal(await pending, false);
  assert.deepEqual(h.calls, [
    { reasonAction: "分配团队成员" },
    {
      submit: [
        "/org/admin/teams/team-1/members",
        { action: "assign", membership_id: "member-1", reason: "加入协作" },
        "POST",
        { preserveForm: true },
      ],
    },
  ]);
  assert.equal(h.context.value, null);
});
test("cancel performs no write and old completion cannot clear a replacement context", async () => {
  const h = parentHarness(),
    pending = h.action({ id: "team", name: "团队" }, "remove", "missing-member");
  assert.equal(h.context.value.memberLabel, "当前选择的成员");
  const replacement = { teamName: "其他上下文" };
  h.context.value = replacement;
  h.gate.resolve("");
  assert.equal(await pending, false);
  assert.equal(h.context.value, replacement);
  assert.equal(h.calls.length, 1);
});

function focusHarness(options = {}) {
  const gate = deferred(),
    started = deferred(),
    listeners = new Set();
  const document = {
    activeElement: null,
    body: null,
    addEventListener(_t, fn) {
      listeners.add(fn);
    },
    removeEventListener(_t, fn) {
      listeners.delete(fn);
    },
  };
  class Element {
    constructor(parent = null) {
      this.parent = parent;
      this.isConnected = true;
      this.disabled = false;
      this.visible = true;
      this.open = false;
      this.focusCount = 0;
    }
    contains(node) {
      return node === this || Boolean(node?.parent && this.contains(node.parent));
    }
    hasAttribute(name) {
      return name === "open" && this.open;
    }
    getClientRects() {
      return this.visible ? [{}] : [];
    }
    matches() {
      return this.disabled;
    }
    closest() {
      return { querySelector: () => modal };
    }
    focus() {
      this.focusCount++;
      document.activeElement = this;
      for (const fn of listeners) fn({ target: this });
    }
  }
  const trigger = new Element(),
    modal = new Element(),
    input = new Element(modal),
    external = new Element();
  document.body = new Element();
  document.activeElement = trigger;
  const busy = { value: false },
    feedback = { value: "" },
    selectedTeam = { value: { id: "team", name: "团队" } },
    selectedMembershipId = { value: "member" },
    selectedMember = { value: { email: "buyer@example.test" } };
  const props = {
    busy: false,
    performMemberAction: async () => {
      input.focus();
      started.resolve();
      await gate.promise;
      if (options.throw) throw Error("failed");
      return options.success ?? false;
    },
  };
  const run = new Function(
    "selectedTeam",
    "props",
    "memberBusy",
    "selectedMembershipId",
    "memberFeedback",
    "selectedMember",
    "document",
    "HTMLElement",
    "Node",
    "window",
    "nextTick",
    js(fn(updatedPanel, "memberLabel")) +
      js(fn(updatedPanel, "performMemberAction")) +
      ";return performMemberAction;",
  )(
    selectedTeam,
    props,
    busy,
    selectedMembershipId,
    feedback,
    selectedMember,
    document,
    Element,
    Element,
    { requestAnimationFrame: (done) => queueMicrotask(done) },
    () => Promise.resolve(),
  );
  return {
    run,
    gate,
    started,
    listeners,
    document,
    trigger,
    modal,
    input,
    external,
    busy,
    feedback,
    selectedMembershipId,
    props,
  };
}
test("cancel/failed action restores from BODY or a closed dialog descendant after busy clears", async () => {
  for (const body of [true, false]) {
    const h = focusHarness(),
      pending = h.run("assign");
    await h.started.promise;
    if (body) h.document.activeElement = h.document.body;
    h.gate.resolve();
    await pending;
    assert.equal(h.document.activeElement, h.trigger);
    assert.equal(h.busy.value, false);
    assert.equal(h.listeners.size, 0);
  }
});
test("external focus, still-open modal and unusable triggers prevent recovery focus", async () => {
  for (const change of [
    (h) => h.external.focus(),
    (h) => {
      h.external.focus();
      h.document.activeElement = h.document.body;
    },
    (h) => {
      h.modal.open = true;
    },
    (h) => {
      h.trigger.visible = false;
    },
    (h) => {
      h.trigger.isConnected = false;
    },
    (h) => {
      h.trigger.disabled = true;
    },
  ]) {
    const h = focusHarness(),
      pending = h.run("remove");
    await h.started.promise;
    change(h);
    h.gate.resolve();
    await pending;
    assert.equal(h.trigger.focusCount, 0);
    assert.equal(h.listeners.size, 0);
  }
});
test("success feedback is unchanged and success focus strategy is not silently introduced", async () => {
  const h = focusHarness({ success: true }),
    pending = h.run("assign");
  await h.started.promise;
  h.gate.resolve();
  await pending;
  assert.equal(h.feedback.value, "buyer@example.test已分配到团队。");
  assert.equal(h.trigger.focusCount, 0);
  assert.equal(h.listeners.size, 0);
});
test("unexpected errors remove the listener; missing member remains a local guard", async () => {
  const h = focusHarness({ throw: true }),
    pending = h.run("assign");
  await h.started.promise;
  h.gate.resolve();
  await assert.rejects(pending, /failed/);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.busy.value, false);
  const empty = focusHarness();
  empty.selectedMembershipId.value = "";
  await empty.run("assign");
  assert.equal(empty.listeners.size, 0);
  assert.equal(empty.feedback.value, "请先选择一位当前组织的活动成员。");
});

test("unknown arguments fail before a service starts", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-teams-member-dialog.mjs", "--unknown"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
});

test("actual four-width packet binds every current source, transform, request and image", () => {
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const folder = "output/playwright/p33-member-dialog-c-r1",
    e = JSON.parse(read(`${folder}/evidence.json`));
  assert.equal(e.kind, "P33-MEMBER-DIALOG-C-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(Object.keys(e.sourceHashes).length, 189);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  for (const [file, changed] of [
    [teamsParentFile, updatedParent],
    [teamsMemberDialogFile, updatedDialog],
    [teamsVueFile, updatedPanel],
  ])
    assert.equal(e.transformedHashes[file], hash(changed));
  assert.deepEqual(
    e.runs.map((r) => r.width),
    [390, 840, 841, 1440],
  );
  assert.equal(
    e.runs.reduce((n, r) => n + r.checks.length, 0),
    324,
  );
  for (const run of e.runs) {
    assert.equal(run.requests.filter((r) => r.key.startsWith("POST ")).length, 2);
    assert.equal(run.requests.filter((r) => r.key.startsWith("GET ")).length, 5);
    for (const action of ["assign", "remove"]) {
      assert.equal(
        run.checks.find((c) => c.name === action + " Escape restores operation trigger").actual,
        true,
      );
      assert.equal(run.checks.find((c) => c.name === action + " no invented maximum").actual, null);
      assert.equal(
        run.checks.find((c) => c.name === action + " rejected write restores enabled trigger")
          .actual,
        true,
      );
    }
  }
  assert.equal(e.screenshots.length, 40);
  for (const image of e.screenshots) {
    const bytes = readFileSync(`${folder}/${image.file}`);
    assert.equal(hash(bytes), image.sha256);
    assert.equal(bytes.readUInt32BE(16), image.width);
    assert.equal(bytes.readUInt32BE(20), image.scene.endsWith("short-screen") ? 560 : 1000);
  }
});

test("capture refuses to replace the existing review packet before opening a service", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-teams-member-dialog.mjs", "--capture"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /EEXIST/);
});
