import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const folder = "output/playwright/p44-mobile-directory-implementation/";
const evidence = (mode) => JSON.parse(read(folder + mode + "/evidence.json"));
const before = evidence("baseline"),
  after = evidence("current-r10");
const historicalHashes = (e) =>
  Object.entries(e.sourceHashes).every(([, sha]) => /^[a-f0-9]{64}$/.test(sha));

for (const mode of ["baseline", "current-r10"])
  test(`directory ${mode === "baseline" ? "historical baseline" : "current r10"}: exact stage sources, 30 PNGs and scoped read-only replay`, () => {
    const e = evidence(mode),
      dir = folder + mode;
    assert.equal(e.kind, "P44-MOBILE-DIRECTORY-IMPLEMENTATION");
    assert.equal(e.baseline, mode === "baseline");
    assert.equal(e.processesClosed, true);
    assert.equal(e.checks.length, mode === "baseline" ? 116 : 134);
    assert.equal(e.screenshots.length, 30);
    assert.equal(e.observations.length, 12);
    assert.equal(Object.keys(e.sourceHashes).length, mode === "baseline" ? 36 : 51);
    if (mode !== "baseline") {
      assert.deepEqual(
        Object.keys(e.sourceHashes)
          .filter((file) => !Object.hasOwn(before.sourceHashes, file))
          .sort(),
        [
          "apps/web/src/components/PlatformAccountCenterAdmin.css",
          "apps/web/src/components/PlatformAccountCenterPermissions.css",
          "apps/web/src/components/PlatformAccountDirectoryFilters.vue",
          "apps/web/src/components/PlatformAccountDirectoryWorkspace.vue",
          "apps/web/src/components/PlatformAccountGlobalRail.vue",
          "apps/web/src/components/PlatformAccountUsersC.css",
          "apps/web/src/components/PlatformAdminDirectoryMobile.css",
          "apps/web/src/components/PlatformRoleComparisonPermissions.css",
          "apps/web/src/design/account-center-tokens.css",
          "apps/web/src/design/account-permissions-tokens.css",
          "apps/web/src/design/organization-wizard-tokens.css",
          "apps/web/src/design/platform-admin-mobile-tokens.css",
          "apps/web/src/design/platform-overlay-tokens.css",
          "apps/web/src/design/tenancy-tokens.css",
          "apps/web/src/styles/tenancy-workspace.css",
          "apps/web/src/use-platform-organization-detail-state.ts",
          "scripts/lib/ui-imported-style-sources.mjs",
        ],
      );
      assert.deepEqual(
        Object.keys(before.sourceHashes).filter((file) => !Object.hasOwn(e.sourceHashes, file)),
        [
          "apps/web/src/styles/platform-dashboard.css",
          "apps/web/src/styles/platform-operations.css",
        ],
      );
    }
    for (const [file, sha] of Object.entries(e.sourceHashes)) {
      assert.ok(historicalHashes(e), `invalid archived source hash: ${file}`);
      assert.match(sha, /^[a-f0-9]{64}$/);
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

test("mobile heading stays within its breakpoint and directory replay remains read-only", () => {
  for (const o of after.observations) {
    const old = before.observations.find((x) => x.width === o.width && x.routeName === o.routeName);
    const active = o.width <= 760 && o.routeName === "admins";
    assert.deepEqual(o.requests, old.requests);
    assert.deepEqual(o.contents, old.contents);
    if (active) {
      assert.equal(o.defaultStyles.heading.display, "block");
      assert.equal(o.defaultStyles.title.fontSize, "22px");
      assert.equal(o.defaultStyles.table.backgroundColor, "rgb(255, 255, 255)");
      assert.equal(o.defaultStyles.rows.gap, "0px");
      assert.equal(o.defaultStyles.row.borderRadius, "0px");
      assert.equal(o.defaultStyles.button.padding, "20px 16px");
      assert.equal(o.defaultStyles.action.color, "rgb(83, 107, 134)");
      assert.ok(o.defaultStyles.name.fontFamily.includes("Bahnschrift"));
    } else if (o.routeName === "admins") assert.equal(o.defaultStyles.heading.display, "none");
    else assert.equal(o.defaultStyles.heading, null);
    for (const s of o.states) {
      assert.ok(s.name);
    }
  }
});

test("historical directory captures stay immutable and current P44 composition stays explicit", () => {
  const source = [
    read("apps/web/src/components/PlatformAccountCenter.vue"),
    read("apps/web/src/components/PlatformAccountDirectoryWorkspace.vue"),
  ].join("\n");
  assert.ok(historicalHashes(before) && historicalHashes(after));
  assert.ok(source.includes('class="account-page-layout"'));
  assert.ok(source.includes('class="admin-directory-heading"'));
  const mobileCss = read("apps/web/src/components/PlatformAdminDirectoryMobile.css");
  assert.match(
    mobileCss,
    /\.account-page-layout--admins \.account-page-main \.admin-directory-heading/,
  );
  assert.match(mobileCss, /\.account-page-layout--admins \.account-page-main \.account-table-wrap/);
  assert.match(mobileCss, /@media \(max-width: 760px\)/);
  assert.ok(read("apps/web/src/components/PlatformAccountCenterAdmin.css").length > 0);
  assert.equal(
    hash(readFileSync("output/playwright/p44-page-vue-preview/390-directory.png")),
    "28bfd32d5557df1b2c972de3d7a2d8381a953f7748bb12777ba5da9c8f4b8e74",
  );
});
