import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { verifyIdentitySource } from "./verify-ui-phase2-identity-source.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const file = "apps/web/src/components/LocalIdentity.vue";

// Source-audited finite mode graph, not authorization or mounted-browser reachability.
export function identityModeContract(source) {
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const ast = ts.createSourceFile("identity.ts", script, ts.ScriptTarget.Latest, true);
  const declarations = new Map();
  for (const node of ast.statements)
    if (ts.isVariableStatement(node))
      for (const d of node.declarationList.declarations)
        if (ts.isIdentifier(d.name)) declarations.set(d.name.text, d.initializer);
  const paths = declarations.get("pathModes");
  assert.ok(paths && ts.isObjectLiteralExpression(paths));
  const pathModes = Object.fromEntries(
    paths.properties.map((p) => {
      assert.ok(
        ts.isPropertyAssignment(p) &&
          ts.isStringLiteral(p.name) &&
          ts.isStringLiteral(p.initializer),
      );
      return [p.name.text, p.initializer.text];
    }),
  );
  const query = declarations.get("publicQueryModes");
  assert.ok(query && ts.isNewExpression(query) && query.expression.getText(ast) === "Set");
  const values = query.arguments?.[0];
  assert.ok(values && ts.isArrayLiteralExpression(values));
  const publicQueryModes = values.elements.map((e) => {
    assert.ok(ts.isStringLiteral(e));
    return e.text;
  });
  assert.deepEqual(publicQueryModes, ["login", "register", "forgot", "verify", "reset"]);
  const template = source.split("<template>")[1];
  assert.ok(template);
  const switches = [...template.matchAll(/@click="switchMode\('([^']+)'\)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(switches)].sort(), ["forgot", "login", "register"]);
  for (const fragment of [
    'mode.value = "mfa-challenge"',
    'mode.value = "security-setup"',
    'mode.value = "verify"',
    'if (mode.value === "verify" && params.get("token")) void confirmEmail()',
    'if (next === "mfa") void loadMfa()',
  ])
    assert.ok(script.includes(fragment), "mode flow changed: " + fragment);
  return {
    pathModes,
    publicQueryModes,
    reachable: [...publicQueryModes, "mfa-challenge", "security-setup"],
  };
}

export function validateIdentityModeReview(review, contract, candidates) {
  const mode = review.modeReachability;
  assert.ok(mode);
  assert.equal(mode.initialMode, contract.pathModes[review.route], "initial route mode mismatch");
  assert.deepEqual(mode.publicQueryModes, contract.publicQueryModes);
  const management = mode.initialMode === "mfa";
  assert.deepEqual(
    mode.reachableModes,
    management ? [...contract.reachable, "mfa"] : contract.reachable,
  );
  assert.deepEqual(mode.excludedModes, management ? ["sessions"] : ["mfa", "sessions"]);
  assert.equal(
    mode.scope,
    "one-mounted-path-plus-local-mode-transitions-not-authorized-security-state",
  );
  assert.equal(mode.automaticActions.length, 1);
  assert.equal(mode.automaticActions[0].actionId, "ID-EMAIL-CONFIRM");
  assert.equal(mode.automaticActions[0].handler, "confirmEmail");
  assert.ok(
    !review.actions.some((a) => a.actionId === "ID-EMAIL-CONFIRM"),
    "automatic action is not a button",
  );
  const seen = new Set();
  for (const a of review.actions) {
    assert.deepEqual(
      a.sourceCandidateApplicability.map((v) => v.candidateId),
      a.sourceCandidateIds,
    );
    for (const item of a.sourceCandidateApplicability) {
      assert.ok(!seen.has(item.candidateId), "duplicate applicability");
      seen.add(item.candidateId);
      const c = candidates.find((v) => v.candidateId === item.candidateId);
      assert.ok(c, "unknown candidate");
      const legacy = c.events["@click"] === "revoke(session.id)";
      const regularMfa = c.conditions.some((v) => v.expression === "mode === 'mfa'");
      assert.equal(
        item.classification,
        legacy
          ? "no-public-entry"
          : regularMfa && !management
            ? "cross-route-reference-only"
            : "route-mode-family",
      );
      assert.ok(item.reason);
    }
    if (a.actionId === "ID-LEGACY-SESSION-REVOKE") assert.equal(a.kind, "excluded");
    if (a.actionId === "ID-MFA-DISABLE") assert.equal(a.kind, management ? "write" : "excluded");
    // No action-specific state capture was added by this semantic review.
    assert.ok(
      Object.values(a.visualStates).every(
        (v) => v === (a.kind === "excluded" ? "not-applicable-excluded" : "not-mapped"),
      ),
    );
  }
  assert.equal(seen.size, candidates.length, "mode review omitted source controls");
  return { pageId: review.pageId, initialMode: mode.initialMode, sourceSites: seen.size };
}

export async function verifyIdentityReview() {
  const source = read(file),
    contract = identityModeContract(source);
  const candidates = scanSource(source, file).candidates;
  const app = read("apps/web/src/App.vue");
  assert.match(
    app,
    /<LocalIdentity\s+v-else-if="selectedView === 'local-identity'"\s+:key="routePath"/,
  );
  const catalog = JSON.parse(read("config/route-catalog.json"));
  const modes = [];
  for (let i = 2; i <= 7; i++) {
    const review = JSON.parse(read(`${base}/action-reviews/P0${i}.json`));
    assert.equal(review.pageId, `P0${i}`);
    const route = catalog.routes.find((r) => r.path === review.route);
    assert.ok(route);
    assert.equal(route.view, "local-identity");
    assert.equal(route.sessionRequired === true, i === 7);
    modes.push(validateIdentityModeReview(review, contract, candidates));
  }
  const sourceChecks = await verifyIdentitySource();
  return {
    modeReviews: modes,
    sourceChecks: sourceChecks.count,
    scope:
      "literal-source mode graph and actual setup with isolated transport; not mounted Vue, authorization, lifecycle races, screenshots or production",
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await verifyIdentityReview(), null, 2));
