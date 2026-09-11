import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import postcss from "postcss";
import {
  adminResultsRevisions,
  historicalAdminResultsSource,
} from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const folder = "output/playwright/p44-mobile-results-implementation/";
const evidence = (mode) => JSON.parse(read(folder + mode + "/evidence.json"));
const before = evidence("baseline"),
  after = evidence("current");
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

for (const mode of ["baseline", "current"]) {
  test(`same-role ${mode} evidence has exact sources and all 48 formal images`, () => {
    const e = evidence(mode),
      dir = folder + mode;
    assert.equal(e.kind, "P44-MOBILE-RESULTS-IMPLEMENTATION");
    assert.equal(e.baseline, mode === "baseline");
    assert.equal(e.processesClosed, true);
    assert.equal(e.checks.length, mode === "baseline" ? 148 : 234);
    assert.equal(e.screenshots.length, 48);
    assert.equal(Object.keys(e.sourceHashes).length, 36);
    for (const [file, sha] of Object.entries(e.sourceHashes)) {
      const source = read(file);
      assert.equal(
        hash(mode === "baseline" ? historicalAdminResultsSource(file, source) : source),
        sha,
        file,
      );
      assert.ok(!file.includes("-preview.css"));
    }
    assert.deepEqual(
      readdirSync(dir).sort(),
      ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const shot of e.screenshots)
      assert.equal(hash(readFileSync(dir + "/" + shot.file)), shot.sha256, shot.file);
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

test("original controls, summaries, P45, desktop and filtered results keep their computed styles", () => {
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

test("production template adds only a presentation class; original script and content stay exact", () => {
  const source = read(component),
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
  const a = postcss.parse(read(stylesheet)),
    b = postcss.parse(historicalAdminResultsSource(stylesheet, read(stylesheet)));
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

test("unknown source revisions fail closed; approved result PNGs remain immutable", () => {
  for (const file of Object.keys(adminResultsRevisions)) {
    assert.equal(hash(read(file)), adminResultsRevisions[file].after);
    assert.throws(
      () => historicalAdminResultsSource(file, read(file) + "\n/* unknown */"),
      /Unreviewed admin results source/,
    );
  }
  for (const [file, sha] of [
    ["390-same-role-empty.png", "b839db6b4858010426d74039fd9416348a813dd5c7c94ad014f1271a79e40e73"],
    ["390-same-role-all.png", "eca89c21b71216dffe8f4946215fe04c60489089ee3811b00cf2ddb4543b33c0"],
  ])
    assert.equal(hash(readFileSync("output/playwright/p44-comparison-vue-preview/" + file)), sha);
});
