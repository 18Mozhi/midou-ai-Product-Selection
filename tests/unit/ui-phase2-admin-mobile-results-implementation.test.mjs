import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import postcss from "postcss";
import { adminHistoricalCapture } from "../../scripts/lib/ui-phase2-admin-historical-capture.mjs";
import {
  adminResultsRevisions,
  historicalAdminResultsSource,
} from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const folder = "output/playwright/p44-mobile-results-implementation/";
const evidence = (mode) => JSON.parse(read(folder + mode + "/evidence.json"));
const baseline = adminHistoricalCapture("results-baseline");
const implemented = adminHistoricalCapture("results-implemented");
const before = baseline.evidence,
  after = implemented.evidence;
const component = "apps/web/src/components/PlatformRoleComparison.vue";
const stylesheet = "apps/web/src/components/PlatformAdminComparisonMobile.css";
const states = [
  "same-role-empty",
  "same-role-all",
  "search-empty",
  "restored-all",
  "group-filter",
  "reset-default",
];

for (const mode of ["baseline", "historical-implemented", "current"]) {
  test(`same-role ${mode} evidence has exact stage sources and all 48 formal images`, () => {
    const capture =
      mode === "baseline" ? baseline : mode === "historical-implemented" ? implemented : null;
    const e = capture ? capture.evidence : evidence(mode),
      dir = folder + mode;
    assert.equal(e.kind, "P44-MOBILE-RESULTS-IMPLEMENTATION");
    assert.equal(e.baseline, mode === "baseline");
    assert.equal(e.processesClosed, true);
    assert.equal(e.checks.length, mode === "baseline" ? 148 : 234);
    assert.equal(e.screenshots.length, 48);
    assert.equal(Object.keys(e.sourceHashes).length, mode === "current" ? 43 : 36);
    if (mode === "baseline")
      assert.equal(read(folder + "baseline/evidence.json"), capture.manifest);
    if (mode === "current") {
      assert.deepEqual(
        Object.keys(e.sourceHashes)
          .filter((file) => !Object.hasOwn(after.sourceHashes, file))
          .sort(),
        [
          "apps/web/src/components/PlatformAccountCenterAdmin.css",
          "apps/web/src/components/PlatformAccountCenterPermissions.css",
          "apps/web/src/components/PlatformAdminDirectoryMobile.css",
          "apps/web/src/components/PlatformRoleComparisonPermissions.css",
          "apps/web/src/design/platform-admin-mobile-tokens.css",
          "apps/web/src/design/platform-overlay-tokens.css",
          "apps/web/src/use-platform-organization-detail-state.ts",
          "scripts/lib/ui-imported-style-sources.mjs",
          "scripts/verify-ui-phase2-admin-mobile-results-implementation.mjs",
        ],
      );
      assert.deepEqual(
        Object.keys(after.sourceHashes).filter((file) => !Object.hasOwn(e.sourceHashes, file)),
        [
          "apps/web/src/styles/platform-dashboard.css",
          "scripts/verify-ui-phase2-admin-mobile-controls-implementation.mjs",
        ],
      );
    }
    for (const [file, sha] of Object.entries(e.sourceHashes)) {
      const source = capture ? capture.source(file) : read(file);
      assert.equal(
        hash(mode === "baseline" ? historicalAdminResultsSource(file, source) : source),
        sha,
        file,
      );
      assert.ok(!file.includes("-preview.css"));
    }
    assert.deepEqual(
      (capture ? capture.files() : readdirSync(dir)).sort(),
      ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const shot of e.screenshots)
      assert.equal(
        hash(capture ? capture.image(shot.file) : readFileSync(dir + "/" + shot.file)),
        shot.sha256,
        shot.file,
      );
    assert.equal(e.observations.length, 8);
    for (const width of [390, 760, 761, 1440])
      for (const routeName of ["admins", "permissions"]) {
        const o = e.observations.find((o) => o.width === width && o.routeName === routeName);
        assert.ok(o);
        assert.deepEqual(
          o.states.map((s) => s.name),
          states,
        );
        assert.deepEqual(o.errors, []);
        assert.deepEqual(o.unexpected, []);
        assert.equal(o.requests.length, routeName === "admins" ? 2 : 7);
        assert.ok(
          o.requests.every((r) => r.method === "GET" && ["roles", "accounts"].includes(r.target)),
        );
        assert.deepEqual(
          e.screenshots
            .filter((s) => s.width === width && s.routeName === routeName)
            .map((s) => s.state),
          states,
        );
      }
  });
}

test("historical result-only stage preserves original controls, summaries, P45, desktop and filtered styles", () => {
  for (const current of after.observations) {
    const old = before.observations.find(
      (o) => o.width === current.width && o.routeName === current.routeName,
    );
    assert.deepEqual(current.styles, old.styles);
    assert.deepEqual(current.focus, old.focus);
    for (const item of current.states) {
      const previous = old.states.find((s) => s.name === item.name).appearance;
      const { marker, ...actual } = item.appearance;
      const { marker: oldMarker, ...expected } = previous;
      assert.equal(oldMarker, "false");
      const eligible = ["same-role-empty", "same-role-all", "restored-all"].includes(item.name);
      assert.equal(marker, String(eligible && current.routeName === "admins"));
      assert.deepEqual(actual.summaries, expected.summaries);
      if (current.width > 760 || current.routeName !== "admins" || !eligible) {
        assert.deepEqual(actual, expected, `${current.width} ${current.routeName} ${item.name}`);
      } else {
        assert.equal(actual.result.backgroundColor, "rgb(244, 247, 252)");
        if (actual.article) {
          assert.equal(actual.article.backgroundColor, "rgb(255, 255, 255)");
          assert.equal(actual.dl.gridTemplateColumns.split(" ").length, 1);
          assert.equal(actual.owned.color, "rgb(41, 76, 175)");
        }
        if (actual.empty) assert.equal(actual.empty.backgroundColor, "rgb(244, 247, 252)");
      }
    }
  }
});

test("current cumulative results preserve role-result markers, focus visibility and read boundaries", () => {
  for (const current of evidence("current").observations) {
    const old = after.observations.find(
      (o) => o.width === current.width && o.routeName === current.routeName,
    );
    assert.equal(current.focus.height, 44);
    assert.match(current.focus.outline, /solid 3px/);
    assert.deepEqual(current.requests, old.requests);
    assert.deepEqual(
      current.states.map((state) => state.name),
      states,
    );
    for (const item of current.states) {
      const sameRoleState = ["same-role-empty", "same-role-all", "restored-all"].includes(
        item.name,
      );
      assert.equal(item.appearance.marker, String(current.routeName === "admins" && sameRoleState));
    }
  }
});

test("production template adds only a presentation class; original script and content stay exact", () => {
  const source = implemented.source(component),
    old = historicalAdminResultsSource(component, source);
  assert.equal(source.replace(/<section[\s\S]*?>/, '<section class="role-comparison">'), old);
  const root = baseParse(parse(source).descriptor.template.content).children.find(
    (n) => n.type === 1,
  );
  const binding = root.props.find(
    (p) => p.type === 7 && p.name === "bind" && p.arg?.content === "class",
  );
  assert.ok(binding);
  for (const persistSelection of [false, true])
    for (const bothPresent of [false, true])
      for (const same of [false, true])
        for (const activeFilterCount of [0, 1, 2]) {
          const classes = vm.runInNewContext("(" + binding.exp.content + ")", {
            persistSelection,
            comparedRoles: { left: bothPresent ? {} : undefined, right: {} },
            compareLeft: "left",
            compareRight: same ? "left" : "right",
            activeFilterCount,
          });
          assert.equal(
            classes["role-comparison--same-role-result"],
            !persistSelection && bothPresent && same && activeFilterCount === 0,
          );
        }
  // This exact append contract belongs to the original result-only implementation.
  const historicalStyle = implemented.source(stylesheet);
  const a = postcss.parse(historicalStyle),
    b = postcss.parse(historicalAdminResultsSource(stylesheet, historicalStyle));
  const newMedia = a.nodes.find((n) => n.type === "atrule"),
    oldMedia = b.nodes.find((n) => n.type === "atrule");
  assert.equal(newMedia.params, "(max-width: 760px)");
  assert.equal(
    newMedia.nodes[0].toString(),
    oldMedia.nodes[0].toString(),
    "approved control rules stay exact",
  );
  for (const rule of newMedia.nodes.slice(1)) {
    assert.match(
      rule.selector,
      /html\[data-design="signal-ledger"\][\s\S]*#app[\s\S]*\.account-center[\s\S]*\.role-comparison\.role-comparison--same-role-result[\s\S]*\.role-comparison__(result|matrix)/,
    );
    assert.doesNotMatch(rule.selector, /summaries/);
  }
});

test("unknown historical result revisions fail closed; approved result PNGs remain immutable", () => {
  for (const file of Object.keys(adminResultsRevisions)) {
    const source = implemented.source(file);
    assert.equal(hash(source), adminResultsRevisions[file].after);
    const current = read(file);
    assert.equal(hash(current), adminResultsRevisions[file].current);
    assert.equal(
      hash(historicalAdminResultsSource(file, current)),
      adminResultsRevisions[file].before,
    );
    assert.throws(
      () => historicalAdminResultsSource(file, current + "\n/* unknown */"),
      /Unreviewed admin results source/,
    );
  }
  for (const [file, sha] of [
    ["390-same-role-empty.png", "b839db6b4858010426d74039fd9416348a813dd5c7c94ad014f1271a79e40e73"],
    ["390-same-role-all.png", "eca89c21b71216dffe8f4946215fe04c60489089ee3811b00cf2ddb4543b33c0"],
  ])
    assert.equal(hash(readFileSync("output/playwright/p44-comparison-vue-preview/" + file)), sha);
});
