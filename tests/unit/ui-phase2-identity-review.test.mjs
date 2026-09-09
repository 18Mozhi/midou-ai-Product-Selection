import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  identityModeContract,
  validateIdentityModeReview,
} from "../../scripts/verify-ui-phase2-identity-review.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
const source = readFileSync("apps/web/src/components/LocalIdentity.vue", "utf8");
const contract = identityModeContract(source);
const candidates = scanSource(source, "apps/web/src/components/LocalIdentity.vue").candidates;
const review = (id = "P02") =>
  JSON.parse(readFileSync(`design-plans/ui-phase-2-2026-09-07/action-reviews/${id}.json`, "utf8"));
for (const id of ["P02", "P03", "P04", "P05", "P06", "P07"])
  test(`${id}: initial path and reachable local modes remain distinct`, () => {
    assert.equal(validateIdentityModeReview(review(id), contract, candidates).sourceSites, 18);
  });
for (const [label, mutate] of [
  [
    "wrong initial",
    (r) => {
      r.modeReachability.initialMode = "mfa";
    },
  ],
  [
    "hide shared login",
    (r) => {
      r.modeReachability.reachableModes = ["register"];
    },
  ],
  [
    "invent local mfa",
    (r) => {
      r.modeReachability.reachableModes.push("mfa");
    },
  ],
  [
    "invent legacy entry",
    (r) => {
      r.actions.find((a) => a.actionId === "ID-LEGACY-SESSION-REVOKE").kind = "write";
    },
  ],
  [
    "wrong management scope",
    (r) => {
      r.actions.find(
        (a) => a.actionId === "ID-MFA-DISABLE",
      ).sourceCandidateApplicability[0].classification = "route-mode-family";
    },
  ],
  [
    "omit automatic verify",
    (r) => {
      r.modeReachability.automaticActions = [];
    },
  ],
  [
    "pretend captured states",
    (r) => {
      r.actions[0].visualStates.hover = "scene-reference-not-acceptance";
    },
  ],
  [
    "omit candidate",
    (r) => {
      r.actions.pop();
    },
  ],
])
  test(`reject ${label}`, () => {
    const r = review();
    mutate(r);
    assert.throws(() => validateIdentityModeReview(r, contract, candidates));
  });
test("reject public MFA query capability drift", () => {
  assert.throws(() =>
    identityModeContract(
      source.replace(
        '["login", "register", "forgot", "verify", "reset"]',
        '["login", "register", "forgot", "verify", "reset", "mfa"]',
      ),
    ),
  );
});
