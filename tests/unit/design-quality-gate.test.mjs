import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("design quality gate keeps metadata readable and removes unscoped visual selectors", async () => {
  const paths = (await readdir("apps/web/src", { recursive: true }))
    .filter((path) => path.endsWith(".css") || path.endsWith(".vue"))
    .map((path) => `apps/web/src/${path.replaceAll("\\", "/")}`);
  const sources = await Promise.all(paths.map(read));
  const violations = [];
  for (const [index, source] of sources.entries()) {
    for (const match of source.matchAll(/font-size:\s*(?:clamp\(\s*)?(\d+(?:\.\d+)?)px/g)) {
      if (Number(match[1]) < 13) violations.push(`${paths[index]}:${match[0]}`);
    }
    for (const match of source.matchAll(/font-size:\s*(0\.\d+)rem/g)) {
      if (Number(match[1]) * 16 < 13) violations.push(`${paths[index]}:${match[0]}`);
    }
  }
  assert.deepEqual(violations, []);

  const styles = await read("apps/web/src/styles.css");
  for (const selector of ["button", "nav", "h1", "dt", "dd"])
    assert.doesNotMatch(styles, new RegExp(`^${selector}\\s*\\{`, "m"));
});

test("design tokens keep the signal-ledger contract and all shells share it", async () => {
  const [tokens, shellStyles, shell, account, signalLedger] = await Promise.all([
    read("apps/web/src/design/tokens.css"),
    read("apps/web/src/styles/onboarding-navigation.css"),
    read("apps/web/src/components/NavigationShell.vue"),
    read("apps/web/src/components/AccountShell.vue"),
    read("apps/web/src/signal-ledger.css"),
  ]);
  assert.match(tokens, /--so-font-ui:\s*"Microsoft YaHei UI"/);
  assert.match(tokens, /--so-font-meta:\s*0\.8125rem/);
  assert.match(tokens, /--so-content-max:\s*1440px/);
  assert.match(tokens, /--so-control-radius:\s*0/);
  assert.match(tokens, /\[data-theme="cloud-white"\][\s\S]*--so-primary:\s*#e54a19/);
  assert.match(signalLedger, /data-design="signal-ledger"/);
  assert.match(signalLedger, /\.confirm-dialog[\s\S]*border-top:\s*8px solid var\(--so-primary\)/);
  assert.doesNotMatch(`${shell}\n${account}`, /applyTheme\("cloud-white"\)/);
  assert.match(shell, /SIGNAL LEDGER/);
  assert.match(shell, /role-page-folio/);
  assert.doesNotMatch(shell, /<aside\s+id="role-navigation"/);
  assert.match(account, /<nav class="account-sidebar"/);
  assert.match(shellStyles, /--so-glow:\s*transparent/);
  assert.doesNotMatch(shellStyles, /role-shell[\s\S]{0,260}radial-gradient/);
});

test("navigation recovery and responsive quality are contract tested beyond screenshots", async () => {
  const [memory, shell, routeCatalog, responsive] = await Promise.all([
    read("apps/web/src/navigation-memory.ts"),
    read("apps/web/src/components/NavigationShell.vue"),
    read("config/route-catalog.json").then(JSON.parse),
    read("apps/web/src/responsive-baselines.css"),
  ]);
  assert.match(memory, /last-member-route[\s\S]*localStorage/);
  assert.match(memory, /last-valid-route/);
  assert.match(shell, /breadcrumbTrail[\s\S]*RouterLink/);
  assert.match(shell, /moreActive[\s\S]*aria-current/);
  assert.match(shell, /返回成员工作台/);
  const routePaths = new Set(routeCatalog.routes.map((route) => route.path));
  assert.equal(routePaths.has("/competitors/monitoring-rules"), true);
  assert.equal(routePaths.has("/platform-admin/organizations/new"), true);
  assert.equal(routePaths.has("/platform-admin/organizations/:organizationId"), true);
  for (const width of [390, 768, 1024, 1440]) assert.match(responsive, new RegExp(String(width)));
});
