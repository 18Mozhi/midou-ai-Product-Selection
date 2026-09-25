import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { verifyPlatformAccountContract } from "../../scripts/verify-ui-phase2-platform-account-contract.mjs";

const folder = "design-plans/ui-phase-2-2026-09-07/";
const current = `${folder}platform-account-current-contract.md`;
const historical = `${folder}platform-account-contract-review.md`;
const responsive = `${folder}responsive-detail-focus-contract-review.md`;
const component = (name) => `apps/web/src/components/${name}.vue`;
const cache = new Map();
function read(file) {
  if (!cache.has(file)) cache.set(file, readFileSync(file, "utf8").replaceAll("\r\n", "\n"));
  return cache.get(file);
}
function replaced(source, before, after) {
  assert(source.includes(before), `negative fixture no longer matches: ${before}`);
  return source.replace(before, after);
}
function rejectsChange(file, mutate, pattern) {
  let used = false;
  assert.throws(
    () =>
      verifyPlatformAccountContract((absolute) => {
        const key = relative(process.cwd(), absolute).replaceAll("\\", "/");
        if (key !== file) return read(absolute);
        used = true;
        const original = read(absolute),
          changed = mutate(original);
        assert.notEqual(changed, original, "negative fixture must change input");
        return changed;
      }),
    pattern,
  );
  assert(used, `missing negative read: ${file}`);
}

test("platform current contract separates its historical inventory from all 38 current sources", () => {
  const result = verifyPlatformAccountContract(read);
  assert.deepEqual(
    { ...result, links: undefined },
    {
      pages: 8,
      candidates: 118,
      bindings: 24,
      sources: 38,
      historicalSources: 32,
      revisedSources: 7,
      links: undefined,
    },
  );
  assert(result.links >= 60);
});

for (const name of [
  "PlatformDashboard",
  "PlatformAccountCenter",
  "PlatformRoleComparison",
  "ResponsiveDataView",
  "ResponsiveFilterDrawer",
  "PlatformAccountDialogs",
  "NavigationShell",
]) {
  test(`rejects current source drift, including script-only: ${name}`, () => {
    rejectsChange(component(name), (s) => s + "\n<!-- unregistered revision -->\n", /hash drift/);
  });
}
for (const file of [
  "apps/api/src/platform-account-service.ts",
  "apps/web/src/use-platform-organization-actions.ts",
  "apps/web/src/use-user-creation-owner.ts",
  "apps/web/src/components/PlatformAdminComparisonMobile.css",
  "apps/web/src/components/PlatformAdminDirectoryMobile.css",
  "apps/web/src/use-modal-dialog.ts",
  "apps/web/src/design/platform-overlay-tokens.css",
  "apps/web/src/design/platform-admin-mobile-tokens.css",
]) {
  test(`rejects producer/dependency drift: ${file}`, () => {
    rejectsChange(file, (s) => s + "\n// unregistered revision\n", /hash drift/);
  });
}
test("rejects candidate mutation in a non-superseded component", () => {
  rejectsChange(
    component("PlatformAccountDialogs"),
    (s) => replaced(s, "<button", '<button data-contract-negative="true"'),
    /candidates: source\/contract drift/,
  );
});
test("rejects original binding changes", () => {
  rejectsChange(
    historical,
    (s) => replaced(s, "| windowCode |", "| incorrectBinding |"),
    /v-model bindings: source\/contract drift/,
  );
});
test("rejects tampering with historical responsive identities", () => {
  rejectsChange(
    historical,
    (s) => replaced(s, "4fa7deb3456a41ae.1", "0000000000000000.1"),
    /historical responsive candidates: source\/contract drift/,
  );
});
test("rejects missing and duplicate current responsive candidates", () => {
  rejectsChange(
    responsive,
    (s) => s.replace(/^\| .*#c182428cb2c0ed66\.1.*\n/m, ""),
    /current responsive candidates required/,
  );
  rejectsChange(
    responsive,
    (s) => replaced(s, "c182428cb2c0ed66.1", "988131834dc4bd6f.1"),
    /candidates: duplicate records/,
  );
});
test("rejects a missing, duplicated or unrelated supersession", () => {
  rejectsChange(
    current,
    (s) => s.replace(/^\| apps\/web\/src\/components\/PlatformDashboard.vue.*\n/m, ""),
    /explicit source revisions: source\/contract drift/,
  );
  rejectsChange(
    current,
    (s) => s.replace(/^(\| apps\/web\/src\/components\/PlatformDashboard.vue.*)$/m, "$1\n$1"),
    /explicit source revisions: duplicate records/,
  );
  rejectsChange(
    current,
    (s) => replaced(s, "components/PlatformDashboard.vue", "components/Unrelated.vue"),
    /explicit source revisions: source\/contract drift/,
  );
});
test("rejects historical, current and cross-document fingerprint mismatches", () => {
  rejectsChange(current, (s) => replaced(s, "7935e4c", "0935e4c"), /historical hash drift/);
  rejectsChange(current, (s) => replaced(s, "902ade12", "002ade12"), /current hash drift/);
  rejectsChange(
    responsive,
    (s) => replaced(s, "b9e635a", "09e635a"),
    /responsive supplement hash drift/,
  );
});
test("rejects omitting the extracted organization action dependency", () => {
  rejectsChange(
    current,
    (s) => s.replace(/^\| apps\/web\/src\/use-platform-organization-actions.ts.*\n/m, ""),
    /additional source files: source\/contract drift/,
  );
});
test("retains page sections and link gates", () => {
  rejectsChange(
    `${folder}page-specs/P43.md`,
    (s) => replaced(s, "## 10.", "## 11."),
    /ten sections required/,
  );
  rejectsChange(
    current,
    (s) => s + "\n[negative link](definitely-missing-contract-file.md)\n",
    /broken link/,
  );
});
test("normalizes Windows CRLF without treating it as a new source revision", () => {
  assert.equal(
    verifyPlatformAccountContract((file) => read(file).replaceAll("\n", "\r\n")).sources,
    38,
  );
});

test("preserves documented filter identities while applying the explicit current supersession", () => {
  rejectsChange(
    historical,
    (s) => replaced(s, "beb5f8d5846aa028.1", "0000000000000000.1"),
    /documented filter candidates: source\/contract drift/,
  );
  rejectsChange(
    historical,
    (s) => replaced(s, "7e0fa28eaeb1cc09.1", "0000000000000000.1"),
    /documented filter candidates: source\/contract drift/,
  );
});

test("requires exactly one explicit filter replacement and its original identity", () => {
  rejectsChange(current, (s) => s.replace(/^\| Q#.*\n/m, ""), /one explicit filter candidate/);
  rejectsChange(
    current,
    (s) => s.replace(/^(\| Q#.*)$/m, "$1\n$1"),
    /one explicit filter candidate/,
  );
  rejectsChange(
    current,
    (s) => replaced(s, "Q#beb5f8d5846aa028.1", "Q#483082db5a776bf3.1"),
    /historical filter open identity/,
  );
  rejectsChange(
    current,
    (s) => replaced(s, "Q#7e0fa28eaeb1cc09.1", "Q#beb5f8d5846aa028.1"),
    /must not reuse historical identity/,
  );
  rejectsChange(
    current,
    (s) => replaced(s, "Q#7e0fa28eaeb1cc09.1", "Q#0000000000000000.1"),
    /current filter candidate identity/,
  );
});

test("rejects missing association and non-association changes to the same trigger", () => {
  rejectsChange(
    component("ResponsiveFilterDrawer"),
    (s) => replaced(s, ':aria-controls="panelId"', ':aria-controls="otherId"'),
    /filter association binding/,
  );
  rejectsChange(
    component("ResponsiveFilterDrawer"),
    (s) => replaced(s, '@click="show"', '@click="close"'),
    /filter open changes beyond association/,
  );
});

test("does not supersede the other five filter candidates", () => {
  rejectsChange(
    component("ResponsiveFilterDrawer"),
    (s) => replaced(s, '@submit.capture="close"', '@submit.capture="show"'),
    /candidates: source\/contract drift/,
  );
});

test("requires the imported palette and pins the current expanded source", () => {
  rejectsChange(
    current,
    (s) => s.replace(/^\| apps\/web\/src\/design\/platform-overlay-tokens.css.*\n/m, ""),
    /additional source files: source\/contract drift/,
  );
  rejectsChange(
    "apps/web/src/design/platform-overlay-tokens.css",
    (s) => replaced(s, "#f3f6fb", "#f4f6fb"),
    /current palette expansion drift/,
  );
  rejectsChange(
    "apps/web/src/design/platform-overlay-tokens.css",
    (s) => replaced(s, "--so-workspace-overlay-canvas:", "--so-workspace-overlay-other:"),
    /missing overlay palette role/,
  );
});
