import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  adminDirectoryRevision,
  historicalAdminDirectorySource,
} from "../../scripts/lib/ui-phase2-admin-directory-baseline.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const folder = "output/playwright/p44-mobile-directory-implementation/";
const evidence = (mode) => JSON.parse(read(folder + mode + "/evidence.json"));
const before = evidence("baseline"),
  after = evidence("current");

for (const mode of ["baseline", "current"])
  test(`directory ${mode}: exact actual sources, 30 PNGs and scoped read-only replay`, () => {
    const e = evidence(mode),
      dir = folder + mode;
    assert.equal(e.kind, "P44-MOBILE-DIRECTORY-IMPLEMENTATION");
    assert.equal(e.baseline, mode === "baseline");
    assert.equal(e.processesClosed, true);
    assert.equal(e.checks.length, mode === "baseline" ? 116 : 134);
    assert.equal(e.screenshots.length, 30);
    assert.equal(e.observations.length, 12);
    assert.equal(Object.keys(e.sourceHashes).length, mode === "baseline" ? 36 : 37);
    for (const [file, sha] of Object.entries(e.sourceHashes)) {
      const source = read(file);
      assert.equal(
        hash(mode === "baseline" ? historicalAdminDirectorySource(file, source) : source),
        sha,
        file,
      );
      assert.ok(!file.includes("-preview.css"));
    }
    assert.deepEqual(
      readdirSync(dir).sort(),
      ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const s of e.screenshots) assert.equal(hash(readFileSync(dir + "/" + s.file)), s.sha256);
    for (const width of [390, 760, 761, 1440])
      for (const routeName of ["admins", "users", "permissions"]) {
        const o = e.observations.find((o) => o.width === width && o.routeName === routeName);
        assert.ok(o);
        assert.deepEqual(o.errors, []);
        assert.deepEqual(o.unexpected, []);
        assert.equal(o.requests.length, routeName === "admins" ? 7 : 1);
        assert.ok(
          o.requests.every(
            (r) => r.method === "GET" && ["accounts", "roles", "detail"].includes(r.target),
          ),
        );
        if (routeName === "admins") {
          assert.equal(o.contents.length, 2);
          assert.match(o.contents[1], /buyer@example.test[\s\S]*尚未授予平台角色/);
          assert.deepEqual(
            o.states.map((s) => s.name),
            width <= 760
              ? ["focus", "preview", "detail", "long", "restored"]
              : ["focus", "detail", "long", "restored"],
          );
          assert.equal(o.requests.filter((r) => r.target === "detail").length, 1);
          assert.equal(o.states.find((s) => s.name === "long").text.length, 1);
        } else assert.equal(o.states.length, 0);
      }
  });

const outside = ({ heading, title, table, rows, row, button, name, meta, action, ...others }) =>
  others;
const exceptHeading = ({ heading, title, ...others }) => others;
test("only mobile admin directory changes; P43/P45/desktop and original dialogs/controls remain", () => {
  for (const o of after.observations) {
    const old = before.observations.find((x) => x.width === o.width && x.routeName === o.routeName);
    const active = o.width <= 760 && o.routeName === "admins";
    assert.deepEqual(o.requests, old.requests);
    assert.deepEqual(o.contents, old.contents);
    assert.deepEqual(outside(o.defaultStyles), outside(old.defaultStyles));
    if (active) {
      assert.equal(o.defaultStyles.heading.display, "block");
      assert.equal(o.defaultStyles.title.fontSize, "22px");
      assert.equal(o.defaultStyles.table.backgroundColor, "rgb(255, 255, 255)");
      assert.equal(o.defaultStyles.rows.gap, "0px");
      assert.equal(o.defaultStyles.row.borderRadius, "0px");
      assert.equal(o.defaultStyles.button.padding, "20px 16px");
      assert.equal(o.defaultStyles.action.color, "rgb(83, 107, 134)");
      assert.ok(o.defaultStyles.name.fontFamily.includes("Bahnschrift"));
    } else {
      assert.deepEqual(exceptHeading(o.defaultStyles), exceptHeading(old.defaultStyles));
      if (o.routeName === "admins") assert.equal(o.defaultStyles.heading.display, "none");
      else assert.equal(o.defaultStyles.heading, null);
    }
    for (const s of o.states) {
      const prev = old.states.find((x) => x.name === s.name);
      assert.deepEqual(s.text, prev.text);
      assert.deepEqual(outside(s.styles), outside(prev.styles));
      if (!active) assert.deepEqual(exceptHeading(s.styles), exceptHeading(prev.styles));
    }
  }
});

test("parent changes only static directory heading and stylesheet import; existing contracts stay exact", () => {
  const r = adminDirectoryRevision,
    source = read(r.file),
    old = historicalAdminDirectorySource(r.file, source);
  assert.equal(hash(source), r.after);
  assert.equal(hash(old), r.before);
  const intro =
    '      <header v-if="tab === \'admins\'" class="admin-directory-heading">\n        <h3>可授权账号</h3>\n        <p>包含尚未授予平台角色的账号。进入详情后核对身份与当前授权。</p>\n      </header>\n';
  assert.equal(source.split(intro).length, 2);
  assert.equal(
    source
      .replace(intro, "")
      .replace('<style src="./PlatformAdminDirectoryMobile.css"></style>\n', ""),
    old,
  );
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(old).descriptor.scriptSetup.content,
  );
  const css = postcss.parse(read("apps/web/src/components/PlatformAdminDirectoryMobile.css"));
  const media = css.nodes.find((n) => n.type === "atrule");
  assert.equal(media.params, "(max-width: 760px)");
  assert.match(
    media.nodes[0].selector,
    /html\[data-design="signal-ledger"\][\s\S]*#app[\s\S]*\.account-center:has\(\.account-tabs a\[href="\/platform-admin\/admins"\]\[aria-current="page"\]\)/,
  );
  assert.doesNotMatch(
    media.toString(),
    /__drawer|__overlay|__filter|__summaries|__matrix|!important/,
  );
  const unknown = source + "\n/* unknown */";
  assert.equal(
    historicalAdminDirectorySource(r.file, unknown),
    unknown,
    "unknown source cannot be normalized into an approved revision",
  );
  assert.notEqual(hash(unknown), r.after);
  assert.equal(
    hash(readFileSync("output/playwright/p44-page-vue-preview/390-directory.png")),
    "28bfd32d5557df1b2c972de3d7a2d8381a953f7748bb12777ba5da9c8f4b8e74",
  );
});
