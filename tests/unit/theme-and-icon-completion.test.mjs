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

test("saved theme is restored before Vue mounts and modules use semantic theme tokens", async () => {
  const [main, theme, tokens, task, personal, approval, notification] = await Promise.all(
    [
      "apps/web/src/main.ts",
      "apps/web/src/design/theme.ts",
      "apps/web/src/design/tokens.css",
      "apps/web/src/task-workspace.css",
      "apps/web/src/components/PersonalCenter.vue",
      "apps/web/src/approval-workspace.css",
      "apps/web/src/notification-center.css",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(main, /applyCachedTheme\(\);[\s\S]*createApp/);
  assert.match(theme, /localStorage\.setItem/);
  assert.match(theme, /localStorage\.getItem/);
  for (const alias of ["--surface", "--text-primary", "--accent", "--border"])
    assert.match(tokens, new RegExp(alias));
  for (const source of [task, approval, notification]) {
    assert.match(source, /var\(--so-panel/);
    assert.match(source, /var\(--so-border/);
  }
  assert.doesNotMatch(task, /#(?:0d203a|16284f|0b1c31|ffffff|fff)\b/i);
  assert.doesNotMatch(personal, /linear-gradient\(135deg,\s*#0d2342/);
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
