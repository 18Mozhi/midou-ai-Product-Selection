import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  previewTeamsReadResult,
  teamsParentFile,
} from "../../scripts/lib/ui-phase2-teams-read-result-preview.mjs";
import {
  previewTeamsRecoveryFocus,
  teamsRecoveryFocusChanges,
  teamsRecoveryFocusStyle,
} from "../../scripts/lib/ui-phase2-teams-recovery-focus-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const original = read(teamsParentFile),
  revised = previewTeamsRecoveryFocus(original);
const descriptor = parse(revised).descriptor;
const ast = ts.createSourceFile(
  "parent.ts",
  descriptor.scriptSetup.content,
  ts.ScriptTarget.Latest,
  true,
);
const reloadSource = ast.statements
  .find((n) => ts.isFunctionDeclaration(n) && n.name.text === "reloadTeamCreateResult")
  .getText(ast);
const javascript = ts.transpileModule(reloadSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function harness(options = {}) {
  const doc = {
    activeElement: null,
    listeners: new Set(),
    addEventListener(type, fn, capture) {
      assert.equal(type, "focusin");
      assert.equal(capture, true);
      this.listeners.add(fn);
    },
    removeEventListener(type, fn, capture) {
      assert.equal(type, "focusin");
      assert.equal(capture, true);
      this.listeners.delete(fn);
    },
  };
  class Element {
    constructor(parent = null) {
      this.parent = parent;
      this.isConnected = true;
      this.focusCount = 0;
    }
    contains(node) {
      return node === this || Boolean(node?.parent && this.contains(node.parent));
    }
    focus() {
      this.focusCount++;
      doc.activeElement = this;
      for (const listener of doc.listeners) listener({ target: this });
    }
  }
  doc.body = new Element();
  const root = new Element(),
    button = new Element(root),
    external = new Element();
  doc.activeElement = options.initialExternal ? external : button;
  const state = { owns: true, generation: 1, loadCount: 0 };
  const busy = { value: false },
    refreshing = { value: false },
    notice = { value: "failed" },
    noticeKind = { value: "error" },
    teamCreateNotice = { value: root };
  const started = deferred(),
    gate = deferred();
  const load = async (opts) => {
    state.loadCount++;
    started.resolve();
    if (options.hold) await gate.promise;
    if (options.throw) throw new Error("unexpected read");
    opts.onResult(options.failed ? "failed" : "ready");
    if (!options.failed && root.contains(doc.activeElement)) doc.activeElement = doc.body;
  };
  const reload = new Function(
    "busy",
    "refreshing",
    "teamCreateGeneration",
    "ownsTeamCreateResult",
    "teamCreateNotice",
    "document",
    "Node",
    "load",
    "noticeKind",
    "notice",
    "nextTick",
    `${javascript}\n return reloadTeamCreateResult;`,
  )(
    busy,
    refreshing,
    1,
    (generation) => state.owns && generation === state.generation,
    teamCreateNotice,
    doc,
    Element,
    load,
    noticeKind,
    notice,
    options.nextTick ?? (() => Promise.resolve()),
  );
  return {
    reload,
    root,
    button,
    external,
    doc,
    state,
    busy,
    refreshing,
    notice,
    noticeKind,
    teamCreateNotice,
    started,
    gate,
  };
}

test("recovery focus preview compiles and reverses to exact reviewed r2 parent", () => {
  compileScript(descriptor, { id: "recovery-focus" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: teamsParentFile,
      id: "recovery-focus",
    }).errors,
    [],
  );
  let reverse = revised.slice(0, -teamsRecoveryFocusStyle.length);
  for (const [before, after] of [...teamsRecoveryFocusChanges].reverse()) {
    assert.equal(reverse.split(after).length, 2);
    reverse = reverse.replace(after, before);
  }
  assert.equal(reverse, previewTeamsReadResult(original));
  assert.doesNotMatch(original, /teamCreateNotice/);
});

test("ready recovery restores its result after the old button disappears and removes its listener", async () => {
  const h = harness();
  await h.reload();
  assert.equal(h.doc.activeElement, h.root);
  assert.equal(h.root.focusCount, 1);
  assert.equal(h.notice.value, "团队列表已更新。");
  assert.equal(h.doc.listeners.size, 0);
});

test("external focus before or during reading is not stolen", async () => {
  for (const initialExternal of [true, false]) {
    const h = harness({ initialExternal, hold: true });
    const pending = h.reload();
    await h.started.promise;
    if (!initialExternal) h.external.focus();
    h.gate.resolve();
    await pending;
    assert.equal(h.doc.activeElement, h.external);
    assert.equal(h.root.focusCount, 0);
    assert.equal(h.doc.listeners.size, 0);
  }
});

test("focus moved out and then removed is not mistaken for a lost recovery button", async () => {
  const h = harness({ hold: true }),
    pending = h.reload();
  await h.started.promise;
  h.external.focus();
  h.doc.activeElement = h.doc.body;
  h.gate.resolve();
  await pending;
  assert.equal(h.doc.activeElement, h.doc.body);
  assert.equal(h.root.focusCount, 0);
});

test("scope invalidation, detached or replaced result nodes prevent late focus", async () => {
  for (const change of [
    (h) => {
      h.state.owns = false;
    },
    (h) => {
      h.state.generation++;
    },
    (h) => {
      h.root.isConnected = false;
    },
    (h) => {
      h.teamCreateNotice.value = h.external;
    },
  ]) {
    const h = harness({ hold: true }),
      pending = h.reload();
    await h.started.promise;
    change(h);
    h.gate.resolve();
    await pending;
    assert.equal(h.root.focusCount, 0);
    assert.equal(h.doc.listeners.size, 0);
  }
});

test("failed or unexpected reads never move focus and always release tracking", async () => {
  const failed = harness({ failed: true });
  await failed.reload();
  assert.equal(failed.root.focusCount, 0);
  assert.equal(failed.notice.value, "failed");
  assert.equal(failed.doc.listeners.size, 0);
  const unexpected = harness({ throw: true });
  await assert.rejects(unexpected.reload(), /unexpected read/);
  assert.equal(unexpected.root.focusCount, 0);
  assert.equal(unexpected.doc.listeners.size, 0);
});

test("busy, refreshing and inactive entry points do not read or install listeners", async () => {
  for (const flag of ["busy", "refreshing", "inactive"]) {
    const h = harness();
    if (flag === "inactive") h.state.owns = false;
    else h[flag].value = true;
    await h.reload();
    assert.equal(h.state.loadCount, 0);
    assert.equal(h.doc.listeners.size, 0);
  }
});

test("user focus movement during Vue nextTick is respected", async () => {
  const tick = deferred(),
    entered = deferred();
  const h = harness({
      nextTick: () => {
        entered.resolve();
        return tick.promise;
      },
    }),
    pending = h.reload();
  await entered.promise;
  h.external.focus();
  tick.resolve();
  await pending;
  assert.equal(h.doc.activeElement, h.external);
  assert.equal(h.root.focusCount, 0);
  assert.equal(h.doc.listeners.size, 0);
});

test("invalid driver flags are rejected before browser startup", () => {
  for (const args of [
    ["--unknown"],
    ["--baseline", "--external"],
    ["--smoke", "--capture"],
    ["--smoke", "--smoke"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-teams-recovery-focus.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
  }
});

test("six current packets preserve the reviewed flow and prove scoped focus destinations", () => {
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  let groups = 0,
    checks = 0,
    pngs = 0,
    reads = 0,
    writes = 0;
  for (const mode of ["baseline", "revised", "external"]) {
    for (const status of [500, 403]) {
      const folder = `output/playwright/p33-recovery-focus-${mode}-${status}-r2`;
      const evidence = JSON.parse(read(`${folder}/evidence.json`));
      const previous = JSON.parse(
        read(`output/playwright/p33-read-result-${status}-r2/evidence.json`),
      );
      assert.equal(evidence.kind, `P33-C-RECOVERY-FOCUS-${mode}-r2`);
      assert.equal(evidence.reviewOnly, true);
      assert.equal(evidence.approval, "pending");
      assert.equal(evidence.processesClosed, true);
      assert.equal(evidence.readFailureStatus, status);
      assert.equal(Object.keys(evidence.sourceHashes).length, 188);
      for (const [file, expected] of Object.entries(evidence.sourceHashes))
        assert.equal(hash(read(file)), expected, file);
      assert.equal(
        evidence.transformedHashes[teamsParentFile],
        hash(mode === "baseline" ? previewTeamsReadResult(original) : revised),
      );
      assert.deepEqual(
        evidence.runs.map((run) => run.width),
        [390, 840, 841, 1440],
      );
      for (const run of evidence.runs) {
        groups++;
        checks += run.checks.length;
        for (const old of previous.runs
          .find((r) => r.width === run.width)
          .checks.filter((c) => !c.name.includes("screenshot region"))) {
          assert.deepEqual(
            run.checks.find((c) => c.name === old.name),
            old,
            `Retain r2 contract: ${old.name}`,
          );
        }
        assert.equal(
          run.checks.find((c) => c.name === `${mode} recovery focus destination`).actual,
          mode === "baseline" ? "body" : mode === "revised" ? "notice" : "brand",
        );
        const post = run.requests.filter((r) => r.key === "POST /api/v1/org/admin/teams");
        const get = run.requests.filter((r) => r.key.startsWith("GET "));
        assert.equal(post.length, 3);
        assert.equal(get.length, 14);
        writes += post.length;
        reads += get.length;
      }
      assert.equal(evidence.screenshots.length, 4);
      for (const shot of evidence.screenshots) {
        const bytes = readFileSync(`${folder}/${shot.file}`);
        assert.equal(hash(bytes), shot.sha256);
        assert.equal(bytes.readUInt32BE(16), shot.width);
        assert.equal(bytes.readUInt32BE(20), 1000);
        assert.equal(shot.captureViewport.height, 1000);
        pngs++;
      }
    }
  }
  assert.deepEqual(
    { groups, checks, pngs, reads, writes },
    { groups: 24, checks: 1176, pngs: 24, reads: 336, writes: 72 },
  );
});

test("all three capture modes refuse existing evidence before launching a service", () => {
  for (const mode of [[], ["--baseline"], ["--external"]]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-teams-recovery-focus.mjs", ...mode, "--capture"],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Refuse to overwrite/);
  }
});
