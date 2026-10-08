import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewShellVue, shellReviewCss } from "../../scripts/lib/ui-phase2-shell-vue-preview.mjs";

const file = "apps/web/src/components/NavigationShell.vue";
const source = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");

test("production C shell SFC compiles with one responsive navigation dialog", () => {
  const actual = parse(source).descriptor;
  assert.equal(actual.template.content.match(/id="role-navigation"/g)?.length, 1);
  assert.match(actual.template.content, /<dialog[\s\S]*?ref="navigationDialog"/);
  assert.match(source, /useNavigationShellDrawer\(menuOpen\)/);
  assert.match(source, /class="role-shell role-shell--c"/);
  assert.ok(source.includes('<style src="../navigation-shell-c.css"></style>'));
  assert.ok(!source.includes("navigation-shell-scoped.css"));
  assert.ok(!source.includes("shell-review-navigation"));
  assert.ok(!source.includes("SIGNAL LEDGER"));
  assert.ok(!source.includes("已连接 · 可复核"));
  const script = compileScript(actual, { id: "shell-production-c" });
  assert.deepEqual(
    compileTemplate({
      source: actual.template.content,
      filename: file,
      id: "shell-production-c",
      compilerOptions: { bindingMetadata: script.bindings },
    }).errors,
    [],
  );
});

test("production C shell colors stay inside its page-scoped semantic token sheet", async () => {
  const [css, tokens] = await Promise.all([
    readFile("apps/web/src/navigation-shell-c.css", "utf8"),
    readFile("apps/web/src/design/navigation-shell-c-tokens.css", "utf8"),
  ]);
  const names = new Set(
    [...tokens.matchAll(/(--shell-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi)].map(
      (match) => match[1],
    ),
  );
  const references = new Set(
    [...css.matchAll(/var\((--shell-[a-z-]+)\)/g)].map((match) => match[1]),
  );
  assert.ok(css.startsWith('@import "./design/navigation-shell-c-tokens.css";'));
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^#app \.role-shell\.role-shell--c\s*\{[\s\S]*\}$/,
  );
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test("production C shell preserves authorization, surface routing and primary action targets", () => {
  for (const contract of [
    "authorizedNavigation(props.shell, allCapabilities.value, guard.value?.roles ?? [])",
    "canOpenRoute(",
    "const routeAllowed = computed(",
    "const selectedSurfaceComponent = computed(",
    '<KeepAlive :max="12">',
    'to="/platform-admin/organizations/new"',
    'to="/org-admin/members"',
    'to="/notifications"',
    'to="/me"',
  ])
    assert.ok(source.includes(contract), `Missing shell contract: ${contract}`);
  assert.equal(source.match(/id="role-navigation"/g)?.length, 1);
});

test("historical shell review stays isolated and is no longer the production transform", async () => {
  const reviewSource = previewShellVue(source);
  assert.notEqual(reviewSource, source);
  assert.match(reviewSource, /role-shell--review/);
  assert.ok(!reviewSource.includes("shell-vue-c-preview.css"));
  assert.ok(!source.includes("shell-review-navigation"));
  assert.ok(!source.includes("shell-vue-c-preview"));
  const css = await readFile(shellReviewCss, "utf8");
  assert.ok(css.startsWith("/* Review-only"));
  assert.ok(css.includes("html body.shell-vue-c:has(#app) #app .role-shell.role-shell--review"));
  assert.match(css, /\.role-navigation-frame:not\(\[open\]\)\s*\{\s*display: none;\s*\}/);
  assert.ok(!css.includes("!important"));
});

test("platform C r2 remains immutable historical evidence after production implementation", async () => {
  const root = "output/playwright/shell-vue-c-platform-r2";
  const evidence = JSON.parse(await readFile(`${root}/evidence.json`, "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(evidence.kind, "SHELL-VUE-C-PLATFORM-r2");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.userReview, "pending");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 6);
  assert.equal(
    evidence.runs.reduce((total, run) => total + run.checks.length, 0),
    88,
  );
  assert.equal(evidence.screenshots.length, 18);
  assert.equal(Object.keys(evidence.sourceHashes).length, 177);
  assert.notEqual(
    evidence.sourceHashes[file],
    hash(source.replaceAll("\r\n", "\n")),
    "historical preview source hash must not be presented as the current production source",
  );
  for (const shot of evidence.screenshots) {
    const bytes = await readFile(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  const before = evidence.runs.find((run) => run.mode === "baseline").expectedMenu;
  for (const run of evidence.runs) {
    assert.deepEqual(run.expectedMenu, before);
    assert.ok(
      run.requests.every((request) => request.key.startsWith("GET ") && request.body === null),
    );
    if (run.mode === "review")
      assert.equal(
        run.checks.find(
          (check) => check.name === "content is beside navigation and visible in first viewport",
        )?.actual,
        true,
      );
  }
});
