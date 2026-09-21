import test from "node:test";
import { adminHistoricalCapture } from "../../scripts/lib/ui-phase2-admin-historical-capture.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import postcss from "postcss";
import {
  adminRoleFactsRevision,
  historicalAdminRoleFactsSource,
} from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const folder = "output/playwright/p44-mobile-role-facts-implementation/";
const evidence = (mode) => JSON.parse(read(folder + mode + "/evidence.json"));
const before = evidence("baseline"),
  after = evidence("current");
const baseline = adminHistoricalCapture("role-facts-baseline");
const implemented = adminHistoricalCapture("role-facts-implemented");
const states = [
  "role-facts",
  "same-role-empty",
  "same-role-all",
  "search-empty",
  "restored-all",
  "group-filter",
  "reset-default",
];

for (const mode of ["baseline", "historical-implemented", "current"]) {
  test(`role facts ${mode} binds exact stage sources and 24 formal images`, () => {
    const capture =
      mode === "baseline" ? baseline : mode === "historical-implemented" ? implemented : null;
    const e = capture ? capture.evidence : evidence(mode),
      dir = folder + mode;
    assert.equal(e.kind, "P44-MOBILE-ROLE-FACTS-IMPLEMENTATION");
    assert.equal(e.baseline, mode === "baseline");
    assert.equal(e.checks.length, mode === "baseline" ? 188 : 352);
    assert.equal(e.screenshots.length, 24);
    assert.equal(e.observations.length, 8);
    assert.equal(e.processesClosed, true);
    assert.equal(Object.keys(e.sourceHashes).length, mode === "current" ? 40 : 37);
    if (mode === "baseline")
      assert.equal(read(folder + "baseline/evidence.json"), capture.manifest);
    if (mode === "current") {
      const oldSources = implemented.evidence.sourceHashes;
      assert.deepEqual(
        Object.keys(e.sourceHashes)
          .filter((file) => !Object.hasOwn(oldSources, file))
          .sort(),
        [
          "apps/web/src/components/PlatformAdminDirectoryMobile.css",
          "apps/web/src/design/platform-admin-mobile-tokens.css",
          "apps/web/src/design/platform-overlay-tokens.css",
          "scripts/lib/ui-imported-style-sources.mjs",
        ],
      );
      assert.deepEqual(
        Object.keys(oldSources).filter((file) => !Object.hasOwn(e.sourceHashes, file)),
        ["scripts/verify-ui-phase2-admin-mobile-controls-implementation.mjs"],
      );
    }
    for (const [file, sha] of Object.entries(e.sourceHashes)) {
      const source = capture ? capture.source(file) : read(file);
      assert.equal(
        hash(mode === "baseline" ? historicalAdminRoleFactsSource(file, source) : source),
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
      );
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
          o.requests.every((r) => r.method === "GET" && ["accounts", "roles"].includes(r.target)),
        );
        assert.deepEqual(
          e.screenshots
            .filter((s) => s.width === width && s.routeName === routeName)
            .map((s) => s.state),
          ["role-facts", "same-role-all", "reset-default"],
        );
      }
  });
}

test("role facts change only P44 mobile presentation; every state preserves content and other regions", () => {
  for (const current of after.observations) {
    const old = before.observations.find(
      (o) => o.width === current.width && o.routeName === current.routeName,
    );
    const active = current.width <= 760 && current.routeName === "admins";
    const { summary, summaryItem, ...otherStyles } = current.styles;
    const { summary: oldSummary, summaryItem: oldItem, ...oldOtherStyles } = old.styles;
    assert.deepEqual(otherStyles, oldOtherStyles);
    assert.deepEqual(current.focus, old.focus);
    if (!active) assert.deepEqual(current.styles, old.styles);
    for (const item of current.states) {
      const prev = old.states.find((s) => s.name === item.name);
      const { summaries, ...others } = item.appearance;
      const { summaries: previousSummary, ...previousOthers } = prev.appearance;
      assert.deepEqual(
        others,
        previousOthers,
        `${current.width}/${current.routeName}/${item.name}`,
      );
      assert.deepEqual(
        item.facts.map(({ name, description, count }) => ({ name, description, count })),
        prev.facts.map(({ name, description, count }) => ({ name, description, count })),
      );
      if (active) {
        assert.equal(summaries.backgroundColor, "rgb(255, 255, 255)");
        assert.equal(summaries.padding, "20px 16px");
        assert.equal(summaries.gridTemplateColumns.split(" ").length, 1);
        assert.equal(summaries.gap, "20px");
        assert.ok(item.facts[1].box.y >= item.facts[0].box.y + item.facts[0].box.height + 19);
        for (const f of item.facts) {
          assert.equal(f.article.padding, "0px");
          assert.equal(f.article.borderRadius, "0px");
          assert.equal(f.title.fontSize, "16px");
          assert.equal(f.title.fontWeight, "700");
          assert.equal(f.title.color, "rgb(20, 42, 70)");
          assert.equal(f.descriptionStyle.color, "rgb(83, 107, 134)");
          assert.equal(f.countStyle.fontSize, "13px");
        }
      } else {
        assert.deepEqual(item.appearance, prev.appearance);
        assert.deepEqual(item.facts, prev.facts);
      }
    }
  }
});

test("historical role-facts stage appends only scoped CSS; original controls/results and Vue stay exact", () => {
  const file = adminRoleFactsRevision.file,
    current = implemented.source(file);
  assert.equal(hash(current), adminRoleFactsRevision.after);
  const old = historicalAdminRoleFactsSource(file, current);
  assert.equal(hash(old), adminRoleFactsRevision.before);
  const a = postcss.parse(current),
    b = postcss.parse(old);
  const media = a.nodes.filter((n) => n.type === "atrule");
  assert.equal(media.length, 2);
  assert.equal(media[0].toString(), b.nodes.find((n) => n.type === "atrule").toString());
  assert.equal(media[1].params, "(max-width: 760px)");
  assert.equal(media[1].nodes.length, 1);
  assert.match(
    media[1].nodes[0].selector,
    /html\[data-design="signal-ledger"\][\s\S]*#app[\s\S]*\.account-center:has\(\.account-tabs a\[href="\/platform-admin\/admins"\]\[aria-current="page"\]\)[\s\S]*\.role-comparison__summaries$/,
  );
  assert.doesNotMatch(media[1].toString(), /__matrix|__result|__selectors|__filters|!important/);
  const vue = "apps/web/src/components/PlatformRoleComparison.vue";
  assert.equal(hash(read(vue)), before.sourceHashes[vue]);
  assert.throws(
    () => historicalAdminRoleFactsSource(file, current + "\n/* drift */"),
    /Unreviewed admin results source/,
  );
  const approved = "output/playwright/p44-comparison-vue-preview/390-permission-facts.png";
  assert.equal(
    hash(readFileSync(approved)),
    "46e862abba5da101e17ed9d1dad80e53665f2a6ae8286f9a484657a5472efb51",
  );
});

test("current P44 comparison CSS expands exactly to the complete role-facts implementation", () => {
  const palette = postcss.parse(read("apps/web/src/design/platform-admin-mobile-tokens.css"));
  const values = new Map();
  palette.walkDecls((decl) => {
    assert.match(decl.prop, /^--so-admin-mobile-/);
    assert.ok(!values.has(decl.prop), "no duplicate color role");
    values.set(decl.prop, decl.value);
  });
  assert.equal(values.size, 11);
  const source = read(adminRoleFactsRevision.file);
  const prefix = '@import "../design/platform-admin-mobile-tokens.css";\n\n';
  assert.ok(source.startsWith(prefix));
  const expanded = source
    .slice(prefix.length)
    .replace(/var\((--so-admin-mobile-[a-z-]+)\)/g, (_, name) => {
      assert.ok(values.has(name), `undefined color role: ${name}`);
      return values.get(name);
    });
  assert.doesNotMatch(expanded, /var\(--so-admin-mobile-/);
  assert.equal(hash(expanded), adminRoleFactsRevision.after);
  assert.equal(expanded, implemented.source(adminRoleFactsRevision.file));
});
