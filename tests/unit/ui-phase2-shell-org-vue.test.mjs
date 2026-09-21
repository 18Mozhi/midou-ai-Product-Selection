import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  buildShellOrgFixture,
  orgReviewCss,
  previewOrgSummary,
} from "../../scripts/lib/ui-phase2-shell-org-fixture.mjs";

test("organization fixture uses original organization-only authority and profile", async () => {
  const fixture = await buildShellOrgFixture();
  assert.deepEqual(fixture.navigation.roles, ["organization_admin"]);
  assert.deepEqual(fixture.navigation.platform_roles, []);
  assert.deepEqual(fixture.navigation.platform_capabilities, []);
  assert.equal(fixture.navigation.organization_id, fixture.profile.id);
  assert.equal(fixture.navigation.workspace_id, fixture.workspaces[0].id);
  assert.equal(fixture.profile.default_workspace_id, fixture.workspaces[0].id);
  assert.equal(fixture.summary.members.active, 96);
  assert.equal(fixture.profile.version, 3);
});
test("organization proposal changes only heading and CSS beyond existing shell preview", async () => {
  const css = await readFile(orgReviewCss, "utf8");
  assert.ok(
    css
      .replace(/\s+/g, " ")
      .includes("html body.shell-vue-c:has(#app) #app .role-shell.role-shell--review"),
  );
  assert.ok(css.includes(":has(> .org-admin-metrics)"));
  assert.ok(css.includes("outline: 3px solid #244bb0"));
  assert.ok(!css.includes("!important"));
  const driver = await readFile("scripts/verify-ui-phase2-shell-org-vue-c.mjs", "utf8");
  assert.ok(driver.includes("previewShellVue(source)"));
  assert.ok(driver.includes("await mkdir(output)"));
  assert.ok(!driver.includes('getByRole("button", { name: "保存并审计"'));
  const production = await readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8");
  assert.ok(!production.includes("shell-org-vue"));
  const proposed = previewOrgSummary(production);
  assert.equal(
    proposed.replace(
      '<h2>{{ view === "summary" && data?.name ? data.name : title }}</h2>',
      "<h2>{{ title }}</h2>",
    ),
    production,
  );
  const before = parse(production).descriptor,
    after = parse(proposed).descriptor;
  assert.equal(before.scriptSetup.content, after.scriptSetup.content);
  const script = compileScript(after, { id: "org-review" });
  assert.deepEqual(
    compileTemplate({
      source: after.template.content,
      filename: "OrganizationAdminCenter.vue",
      id: "org-review",
      compilerOptions: { bindingMetadata: script.bindings },
    }).errors,
    [],
  );
  assert.throws(() =>
    previewOrgSummary(production.replace("<h2>{{ title }}</h2>", "<h2>{{ changed }}</h2>")),
  );
});
test("organization capture binds all current loaded sources and requested images", async () => {
  const root = "output/playwright/shell-org-vue-c-r2";
  const evidence = JSON.parse(await readFile(`${root}/evidence.json`, "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(evidence.kind, "SHELL-ORG-VUE-C-r2");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.userReview, "pending");
  assert.equal(evidence.processesClosed, true);
  assert.deepEqual(
    evidence.runs.map((r) => `${r.mode}/${r.width}`),
    ["baseline/390", "baseline/1440", "review/390", "review/840", "review/841", "review/1440"],
  );
  assert.equal(evidence.screenshots.length, 20);
  assert.equal(Object.keys(evidence.sourceHashes).length, 174);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
  for (const shot of evidence.screenshots) {
    const bytes = await readFile(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of evidence.runs) {
    assert.ok(run.requests.every((r) => r.key.startsWith("GET ") && r.body === null));
    assert.equal(run.checks.find((c) => c.name === "only organization routes").actual, true);
    assert.deepEqual(run.checks.find((c) => c.name === "no unexpected network").actual, []);
    assert.deepEqual(run.checks.find((c) => c.name === "no runtime errors").actual, []);
    if (run.mode === "review") {
      assert.equal(run.checks.find((c) => c.name === "native reason still required").actual, true);
      assert.equal(
        run.checks.find((c) => c.name === "refresh is one additional summary read").actual,
        2,
      );
    }
  }
});
