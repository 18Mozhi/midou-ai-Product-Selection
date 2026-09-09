import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { buildApprovalDesignData } from "./lib/ui-phase2-approval-design-data.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";

// Actual function composition at inert boundaries, not mounted Vue or server evidence.
const plain = (value) => JSON.parse(JSON.stringify(value));
const ref = (value) => ({ value });
export async function verifyApprovalReview() {
  const shared = await buildApprovalDesignData(process.cwd());
  const file = "apps/web/src/components/ApprovalWorkspace.vue";
  const source = await readFile(file, "utf8");
  const ast = ts.createSourceFile(
    "ApprovalWorkspace.ts",
    source.split('<script setup lang="ts">')[1].split("</script>")[0],
    ts.ScriptTarget.Latest,
    true,
  );
  function extract(name) {
    const nodes = ast.statements.filter(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    assert.equal(nodes.length, 1, name);
    return nodes[0].getText(ast);
  }
  function run(name, bindings, args = [], helpers = []) {
    const box = { exports: {}, args, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(
        `${[...helpers, name].map(extract).join("\n")}; export const result=${name}(...args);`,
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
      ).outputText,
      box,
    );
    return box.exports.result;
  }
  function deferred() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    return { promise, resolve, reject };
  }
  function environment() {
    const navigation = [],
      route = { query: { from: "/notifications?unread=1" } };
    return {
      navigation,
      route,
      selected: ref(null),
      reason: ref(""),
      detailBusy: ref(false),
      detailNotice: ref(""),
      decisionNotice: ref(""),
      notice: ref(""),
      busy: ref(false),
      router: {
        replace: async ({ query }) => {
          route.query = plain(query);
          navigation.push(plain(query));
        },
      },
      ApiClientError: class extends Error {},
      rethrowUnexpectedError: (error) => {
        throw error;
      },
    };
  }
  const detailA = shared.detail,
    detailB = { ...plain(shared.detail), id: "synthetic-B" };
  const checks = [];
  for (const outcome of ["success", "failure"]) {
    const a = deferred(),
      b = deferred(),
      env = environment();
    env.api = async (url) => (url.endsWith("synthetic-B") ? b.promise : a.promise);
    const first = run("openById", env, [detailA.id]);
    const second = run("openById", env, [detailB.id]);
    b.resolve(detailB);
    await second;
    assert.equal(env.selected.value.id, detailB.id);
    // First request is still pending although the shared detailBusy has been released by B.
    assert.equal(env.detailBusy.value, false);
    if (outcome === "success") {
      a.resolve(detailA);
      await first;
      assert.equal(env.selected.value.id, detailA.id);
      assert.equal(env.route.query.approval, detailA.id);
    } else {
      a.reject(Error("isolated stale read failure"));
      await assert.rejects(first, /isolated stale read failure/);
      assert.equal(env.selected.value, null);
      assert.equal(env.route.query.approval, detailB.id);
      assert.equal(env.detailNotice.value, "审批详情读取失败，请重试。");
    }
  }
  checks.push(
    "UNFIXED same-instance reads: B resolves first and releases shared loading; late A success replaces B and URL, late A failure clears B while URL still names B. Inert response order, not cross-tenant leakage proof",
  );

  {
    const gate = deferred(),
      env = environment();
    env.api = async () => gate.promise;
    const pending = run("openById", env, [detailA.id]);
    await run("closeDetail", env);
    assert.equal(env.route.query.approval, undefined);
    gate.resolve(detailA);
    await pending;
    assert.equal(env.selected.value.id, detailA.id);
    assert.equal(env.route.query.approval, detailA.id);
  }
  checks.push(
    "UNFIXED pending read then closeDetail: successful original response restores selected and approval query; no cancellation/intent token in local functions",
  );

  {
    const write = deferred(),
      env = environment(),
      requests = [];
    env.selected.value = detailA;
    env.reason.value = " 核对A的证据 ";
    env.api = async (url, options) => {
      requests.push(plain({ url, ...options }));
      return write.promise;
    };
    let reloads = 0;
    env.load = async () => {
      reloads += 1;
    };
    const pending = run("decide", env, ["approve"], ["closeDetail"]);
    await run("closeDetail", env);
    // Closing is allowed while busy; another row read is not disabled by this shared busy flag.
    await run("openById", { ...env, api: async () => detailB }, [detailB.id]);
    env.reason.value = "B的新原因";
    write.resolve({});
    await pending;
    assert.deepEqual(requests, [
      {
        url: `/tasks/approvals/${detailA.id}/actions`,
        method: "POST",
        body: { action: "approve", reason: " 核对A的证据 ", expected_version: detailA.version },
      },
    ]);
    assert.equal(env.selected.value, null);
    assert.equal(env.route.query.approval, undefined);
    assert.equal(env.reason.value, "B的新原因");
    assert.equal(reloads, 1);
    assert.equal(env.busy.value, false);
  }
  checks.push(
    "UNFIXED approve A in flight then close/open B: request remains A/version/reason, but old success closes current B and clears B URL. Source composition only; no server decision or browser-history proof",
  );

  const candidates = scanSource(source, file).candidates;
  const returned = candidates.find((c) => c.events?.["@click"] === "publishTarget = null");
  assert.ok(returned);
  const publishTarget = ref(shared.templates[1]),
    publishReason = ref("未提交原因");
  vm.runInNewContext(returned.events["@click"], {
    set publishTarget(value) {
      publishTarget.value = value;
    },
  });
  assert.equal(publishTarget.value, null);
  assert.equal(publishReason.value, "未提交原因");
  const closeCallbacks = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(ast) === "useModalDialog" &&
      node.arguments[0]?.getText(ast).includes("Boolean(publishTarget.value)")
    )
      closeCallbacks.push(node.arguments[1].getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(closeCallbacks.length, 1);
  publishTarget.value = shared.templates[1];
  vm.runInNewContext(`(${closeCallbacks[0]})();`, { publishTarget, publishReason });
  assert.equal(publishTarget.value, null);
  assert.equal(publishReason.value, "");
  checks.push(
    "Publish closing is not identical: Return clears only target; actual Escape callback clears target and reason. openPublish clears reason on next opening, so retained closed draft is not claimed as visible reuse",
  );

  for (const name of ["decide", "createTemplate", "createRequest"]) {
    // A source-level distinction only; do not claim that a disabled browser button can be clicked.
    assert.ok(!extract(name).includes("if (busy.value"));
  }
  assert.ok(extract("publish").includes("if (busy.value"));
  checks.push(
    "Function busy guards differ: publish has one; decide/template/request do not. DOM buttons still disable, so this is not a reproduced browser double-submit",
  );
  return {
    shared: {
      writeBodies: Object.keys(shared.contracts).length,
      routeCases: Object.keys(shared.routeCases).length,
      sqlScopes: Object.keys(shared.scopeCases).length,
    },
    checks,
    limits:
      "Uses actual source functions/validators/diff/SQL construction with inert boundaries. No mounted DOM, authorization, MySQL/transaction, Worker, complete lifecycle, cross-scope breach or production proof. Known-defect expectations must change when approved fixes land.",
  };
}
if (process.argv[1]?.endsWith("verify-ui-phase2-approval-review.mjs"))
  console.log(JSON.stringify(await verifyApprovalReview()));
