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

test("design tokens keep one accent family and administrative shells disable decorative glow", async () => {
  const [tokens, shellStyles, shell, account] = await Promise.all([
    read("apps/web/src/design/tokens.css"),
    read("apps/web/src/styles/onboarding-navigation.css"),
    read("apps/web/src/components/NavigationShell.vue"),
    read("apps/web/src/components/AccountShell.vue"),
  ]);
  assert.match(tokens, /--so-font-ui:\s*"Microsoft YaHei UI"/);
  assert.match(tokens, /--so-font-meta:\s*0\.8125rem/);
  assert.match(tokens, /\[data-theme="cloud-white"\][\s\S]*--so-border:\s*rgba\([^)]*,\s*0\.26\)/);
  for (const administrativeShell of ["organization_admin", "platform_admin"])
    assert.match(
      shellStyles,
      new RegExp(`data-shell="${administrativeShell}"[\\s\\S]*?--so-glow:\\s*transparent`),
    );
  assert.doesNotMatch(`${shell}\n${account}`, /applyTheme\("cloud-white"\)/);
});

test("navigation recovery and responsive quality are contract tested beyond screenshots", async () => {
  const [memory, shell, routes, responsive] = await Promise.all([
    read("apps/web/src/navigation-memory.ts"),
    read("apps/web/src/components/NavigationShell.vue"),
    read("apps/web/src/route-catalog.ts"),
    read("apps/web/src/responsive-baselines.css"),
  ]);
  assert.match(memory, /last-member-route[\s\S]*localStorage/);
  assert.match(memory, /last-valid-route/);
  assert.match(shell, /breadcrumbTrail[\s\S]*RouterLink/);
  assert.match(shell, /moreActive[\s\S]*aria-current/);
  assert.match(shell, /返回成员工作台/);
  assert.match(routes, /\/competitors\/monitoring-rules/);
  assert.match(routes, /\/platform-admin\/organizations\/new/);
  assert.match(routes, /\/platform-admin\/organizations\/:organizationId/);
  for (const width of [390, 768, 1024, 1440]) assert.match(responsive, new RegExp(String(width)));
});
