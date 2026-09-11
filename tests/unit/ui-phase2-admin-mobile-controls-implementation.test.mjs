import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  adminControlsRevision,
  historicalAdminControlsSource,
} from "../../scripts/lib/ui-phase2-admin-controls-baseline.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const root = "output/playwright/p44-mobile-controls-implementation/";
const evidence = (mode) => JSON.parse(read(root + mode + "/evidence.json"));
const before = evidence("baseline"),
  after = evidence("current");
const css = "apps/web/src/components/PlatformAdminComparisonMobile.css";

for (const mode of ["baseline", "current"]) {
  test(`P44 production controls ${mode}: exact captured sources, images and read-only fixtures`, () => {
    const e = evidence(mode),
      folder = root + mode;
    assert.equal(e.kind, "P44-MOBILE-CONTROLS-IMPLEMENTATION");
    assert.equal(e.baseline, mode === "baseline");
    assert.equal(e.processesClosed, true);
    assert.match(e.scope, /no review CSS or template transforms/);
    assert.match(e.scope, /No full App\/real permissions\/deployment acceptance/);
    assert.equal(e.checks.length, mode === "baseline" ? 92 : 110);
    assert.equal(e.screenshots.length, 16);
    assert.equal(Object.keys(e.sourceHashes).length, mode === "baseline" ? 35 : 36);
    for (const [file, sha] of Object.entries(e.sourceHashes)) {
      const source = read(file);
      assert.equal(
        hash(mode === "baseline" ? historicalAdminControlsSource(file, source) : source),
        sha,
        file,
      );
      assert.ok(!file.includes("-preview.css"), file);
    }
    assert.deepEqual(
      readdirSync(folder).sort(),
      ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const shot of e.screenshots)
      assert.equal(hash(readFileSync(folder + "/" + shot.file)), shot.sha256);
    assert.equal(e.observations.length, 8);
    for (const width of [390, 760, 761, 1440])
      for (const routeName of ["admins", "permissions"]) {
        const o = e.observations.find(
          (item) => item.width === width && item.routeName === routeName,
        );
        assert.ok(o);
        assert.deepEqual(o.errors, []);
        assert.deepEqual(o.unexpected, []);
        assert.equal(o.requests.length, routeName === "admins" ? 2 : 5);
        assert.ok(
          o.requests.every((r) => r.method === "GET" && ["accounts", "roles"].includes(r.target)),
        );
        assert.deepEqual(
          e.screenshots
            .filter((s) => s.width === width && s.routeName === routeName)
            .map((s) => s.state),
          ["default", "keyboard-focus"],
        );
      }
  });
}

test("P44 changes only mobile controls; excluded styles, focus geometry and default pixels stay exact", () => {
  for (const current of after.observations) {
    const old = before.observations.find(
      (o) => o.width === current.width && o.routeName === current.routeName,
    );
    if (current.routeName === "permissions" || current.width > 760) {
      assert.deepEqual(current.styles, old.styles);
      assert.deepEqual(current.focus, old.focus);
      for (const shot of after.screenshots.filter(
        (s) =>
          s.width === current.width && s.routeName === current.routeName && s.state === "default",
      )) {
        assert.equal(
          shot.sha256,
          before.screenshots.find((s) => s.file === shot.file).sha256,
          shot.file,
        );
      }
    } else {
      for (const key of ["summary", "summaryItem", "result", "matrix"])
        assert.deepEqual(current.styles[key], old.styles[key], key);
      assert.equal(current.styles.header.backgroundColor, "rgb(41, 76, 175)");
      assert.equal(current.styles.title.fontSize, "22px");
      assert.equal(current.styles.title.fontWeight, "700");
      assert.equal(current.styles.checkbox.width, "20px");
      assert.notDeepEqual(current.styles.header, old.styles.header);
    }
  }
});

test("P44 production parent only appends local stylesheet; script/template and other styles unchanged", () => {
  const current = read(adminControlsRevision.file);
  const old = historicalAdminControlsSource(adminControlsRevision.file, current);
  assert.equal(hash(current), adminControlsRevision.after);
  assert.equal(hash(old), adminControlsRevision.before);
  assert.equal(current, old + '<style src="./PlatformAdminComparisonMobile.css"></style>\n');
  assert.equal(before.sourceHashes[css], undefined);
  assert.equal(after.sourceHashes[css], hash(read(css)));
  const style = read(css);
  assert.match(style, /@media \(max-width: 760px\)/);
  assert.match(style, /html\[data-design="signal-ledger"\]/);
  assert.match(
    style,
    /:has\(\.account-tabs a\[href="\/platform-admin\/admins"\]\[aria-current="page"\]\)/,
  );
  assert.doesNotMatch(style, /\.role-comparison__(?:summaries|result|matrix)/);
  assert.doesNotMatch(style, /!important/);
});

test("historical association fails closed for an unregistered source and preserves CRLF equivalence", () => {
  const current = read(adminControlsRevision.file);
  assert.throws(
    () =>
      historicalAdminControlsSource(adminControlsRevision.file, current + "\n<!-- unknown -->\n"),
    /Unreviewed admin controls source/,
  );
  assert.equal(
    hash(
      historicalAdminControlsSource(adminControlsRevision.file, current.replaceAll("\n", "\r\n")),
    ),
    adminControlsRevision.before,
  );
  assert.equal(historicalAdminControlsSource("unrelated.vue", "unchanged"), "unchanged");
});
