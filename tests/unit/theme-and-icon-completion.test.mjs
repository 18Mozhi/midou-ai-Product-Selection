import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

test("production CSS has no global compatibility patch or important overrides", async () => {
  const paths = (await readdir("apps/web/src", { recursive: true }))
    .filter((path) => path.endsWith(".css"))
    .map((path) => `apps/web/src/${path.replaceAll("\\", "/")}`);
  const sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));

  assert.ok(!paths.includes("apps/web/src/theme-compat.css"));
  for (const [index, source] of sources.entries())
    assert.doesNotMatch(source, /!important/, paths[index]);
});

test("body copy and interactive controls preserve the accessibility floor", async () => {
  const [accessibility, member] = await Promise.all(
    ["apps/web/src/accessibility.css", "apps/web/src/member-workspace-polish.css"].map((path) =>
      readFile(path, "utf8"),
    ),
  );

  assert.match(accessibility, /--so-font-body:\s*1rem/);
  assert.match(accessibility, /--so-touch-target:\s*44px/);
  assert.match(accessibility, /#app small\s*\{\s*font-size:\s*0\.75rem/);
  assert.match(
    accessibility,
    /#app\s+:where\(p, li, dd, td, label, input, select, textarea, button\)/,
  );
  for (const property of ["min-width", "min-height", "min-inline-size", "min-block-size"]) {
    assert.match(
      accessibility,
      new RegExp(`${property}: var\\(--so-control-height, var\\(--so-touch-target\\)\\)`),
    );
    assert.match(accessibility, new RegExp(`${property}: var\\(--so-touch-target\\)`));
  }
  assert.match(member, /\.role-content\s*\{\s*font-size:\s*16px/);
  assert.match(member, /textarea\s*\{\s*font-size:\s*16px/);
  assert.doesNotMatch(member, /font-size:\s*(?:14|15)px/);
});

test("saved theme and session density are applied before Vue mounts", async () => {
  const [main, theme, tokens, studio, shell, task, personal, approval, notification] =
    await Promise.all(
      [
        "apps/web/src/main.ts",
        "apps/web/src/design/theme.ts",
        "apps/web/src/design/tokens.css",
        "apps/web/src/components/ThemeStudio.vue",
        "apps/web/src/components/NavigationShell.vue",
        "apps/web/src/task-workspace.css",
        "apps/web/src/components/PersonalCenter.vue",
        "apps/web/src/approval-workspace.css",
        "apps/web/src/notification-center.css",
      ].map((path) => readFile(path, "utf8")),
    );
  assert.match(main, /applyCachedTheme\(\);[\s\S]*createApp/);
  assert.match(theme, /localStorage\.setItem/);
  assert.match(theme, /localStorage\.getItem/);
  assert.match(main, /applyShellDensity\(false\)/);
  assert.match(theme, /densityIds = \["standard", "compact"\]/);
  assert.match(theme, /applyShellDensity\(administrative: boolean\)/);
  assert.match(studio, /aria-label="页面密度"/);
  assert.match(shell, /applyShellDensity\(props\.shell !== "member"\)/);
  assert.match(tokens, /\[data-density="compact"\]/);
  for (const alias of ["--surface", "--text-primary", "--accent", "--border"])
    assert.match(tokens, new RegExp(alias));
  for (const source of [task, approval, notification]) {
    assert.match(source, /var\(--so-panel/);
    assert.match(source, /var\(--so-border/);
  }
  assert.doesNotMatch(task, /#(?:0d203a|16284f|0b1c31|ffffff|fff)\b/i);
  assert.doesNotMatch(personal, /linear-gradient\(135deg,\s*#0d2342/);
});

test("production CSS and Vue scoped styles use shared semantic color roles", async () => {
  const paths = (await readdir("apps/web/src", { recursive: true }))
      .filter((path) => path.endsWith(".css") || path.endsWith(".vue"))
      .map((path) => `apps/web/src/${path.replaceAll("\\", "/")}`)
      .filter((path) => path !== "apps/web/src/design/tokens.css"),
    sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));

  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /#(?:[0-9a-f]{3,8})\b/i, paths[index]);
    assert.doesNotMatch(source, /(?:rgb|hsl)a?\(/i, paths[index]);
  }
  assert.match(sources.join("\n"), /var\(--so-(?:bg|panel|text|border|primary)/);
});

test("icon-only production actions expose hover and focus names", async () => {
  const [main, shell, credentials, registry, sourcing] = await Promise.all(
    [
      "apps/web/src/main.ts",
      "apps/web/src/components/NavigationShell.vue",
      "apps/web/src/components/CredentialAssetCenter.vue",
      "apps/web/src/components/ProviderRegistry.vue",
      "apps/web/src/components/SourcingWorkspace.vue",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(main, /button\[aria-label\],a\[aria-label\]/);
  assert.match(main, /element\.title = label/);
  for (const label of ["通知中心", "个人中心"])
    assert.match(shell, new RegExp(`aria-label="${label}"`));
  for (const label of ["关闭凭证编辑", "关闭浏览器档案编辑"])
    assert.match(credentials, new RegExp(label));
  assert.match(registry, /关闭来源设置编辑/);
  assert.match(sourcing, /关闭供应商搜索/);
  assert.match(sourcing, /关闭报价编辑/);
});
