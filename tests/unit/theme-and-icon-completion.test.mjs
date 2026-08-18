import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("dark role shells override every production module that still carries legacy white surfaces", async () => {
  const css = await readFile("apps/web/src/theme-compat.css", "utf8");
  for (const root of [
    "account-center",
    "collection-task-center",
    "competitor-monitor",
    "crawler-center",
    "quality-center",
    "cost-console",
    "adapter-center",
    "source-center",
    "sourcing-workspace",
  ])
    assert.match(css, new RegExp(root));
  assert.match(css, /html:not\(\[data-theme="cloud-white"\]\)/);
  assert.match(css, /background:\s*var\(--so-panel\)\s*!important/);
});

test("icon-only production actions expose hover and focus names", async () => {
  const [theme, shell, credentials, registry, sourcing] = await Promise.all(
    [
      "apps/web/src/theme-compat.css",
      "apps/web/src/components/NavigationShell.vue",
      "apps/web/src/components/CredentialAssetCenter.vue",
      "apps/web/src/components/ProviderRegistry.vue",
      "apps/web/src/components/SourcingWorkspace.vue",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(theme, /content:\s*attr\(aria-label\)/);
  for (const label of ["通知中心", "个人中心"]) assert.match(shell, new RegExp(`aria-label="${label}"`));
  for (const label of ["关闭凭证编辑", "关闭浏览器档案编辑"])
    assert.match(credentials, new RegExp(label));
  assert.match(registry, /关闭来源设置编辑/);
  assert.match(sourcing, /关闭供应商搜索/);
  assert.match(sourcing, /关闭报价编辑/);
});
