import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import postcss from "postcss";
import { parse } from "@vue/compiler-sfc";

// The rebuilt workspace uses 12px for these explicitly reviewed metadata rules.
// The default floor stays 13px; no unlisted sub-13px selector is accepted.
const metadataRules = new Set([
  "apps/web/src/backup-recovery-center-c.css::& .p64-directory > p:last-child",
  "apps/web/src/backup-recovery-center-c.css::& .panel-title > span",
  "apps/web/src/backup-recovery-center-c.css::& .p64-content > footer",
  "apps/web/src/file-resilience.css::& .p69-observed :is(b, time)",
  "apps/web/src/file-resilience.css::& .p69-directory header > b",
  "apps/web/src/file-resilience.css::& .p69-sample-total span",
  "apps/web/src/file-resilience.css::& .p69-note",
  "apps/web/src/file-resilience.css::& .file-resilience__footer",
  "apps/web/src/platform-status-center-c.css::& :is(.platform-topology-node i, .platform-realtime-degradation i)",
  "apps/web/src/platform-status-center-c.css::& .platform-realtime-degradation article span",
  "apps/web/src/runtime-observation-workspace.css::& :is(small, dt)",
  "apps/web/src/runtime-observation-workspace.css::& .p68-measurements p",
  "apps/web/src/runtime-observation-workspace.css::& :is(.mysql-resilience__footer, .redis-resilience__footer)",
  "apps/web/src/runtime-observation-workspace.css::& :is(.p68-contract, .p67-persistence-rows > div, .p67-sample-list article)",
  "apps/web/src/components/OrganizationCreationWizard.vue::.organization-wizard__progress span",
  "apps/web/src/components/OrganizationCreationWizard.vue::.organization-wizard__step small",
  "apps/web/src/components/PlatformAccountCenter.css::.account-center .account-metrics small,\n.account-center .account-metrics span",
  "apps/web/src/components/PlatformAccountCenter.css::.account-center .account-filter small",
  "apps/web/src/components/PlatformAccountCenter.css::.account-center .account-updated",
  "apps/web/src/components/PlatformAccountCenter.css::.account-center th",
  "apps/web/src/components/PlatformAccountCenter.css::.account-center td small",
  "apps/web/src/components/PlatformAccountCenter.css::.account-center .p40-record-counts",
  "apps/web/src/components/PlatformAccountCenterAdmin.css::.account-center--admins-c .role-comparison > header p",
  "apps/web/src/components/PlatformAccountDialogs.css::.p44-admin-create-help",
  "apps/web/src/components/PlatformAdminDirectoryMobile.css::.account-center--admins-c .responsive-record-summary small,\n  .account-center--admins-c .responsive-data-view__action",
  "apps/web/src/components/PlatformOrganizationDetailDialog.vue::.p42-identity-head small,\n.p42-missing-identity small",
  "apps/web/src/components/PlatformOrganizationDetailDialog.vue::.detail-grid small",
  "apps/web/src/components/PlatformOrganizationDetailDialog.vue::.field-help",
  "apps/web/src/components/PlatformRoleComparisonPermissions.css::.role-comparison--permission-page .role-comparison__matrix h4 small",
  "apps/web/src/components/PlatformRoleComparisonPermissions.css::.role-comparison--permission-page .role-comparison__matrix dt",
  "apps/web/src/components/PlatformUserDetailDialog.vue::.user-detail-identity small",
]);

const read = (path) => readFile(path, "utf8");

test("design quality gate keeps metadata readable and removes unscoped visual selectors", async () => {
  const paths = (await readdir("apps/web/src", { recursive: true }))
    .filter((path) => path.endsWith(".css") || path.endsWith(".vue"))
    .map((path) => `apps/web/src/${path.replaceAll("\\", "/")}`);
  const sources = await Promise.all(paths.map(read));
  const violations = [];
  for (const [index, source] of sources.entries()) {
    const file = paths[index];
    const blocks = file.endsWith(".vue")
      ? parse(source).descriptor.styles.map((style) => style.content)
      : [source];
    for (const block of blocks)
      postcss.parse(block).walkDecls("font-size", (declaration) => {
        const value = /^(?:clamp\(\s*)?(\d+(?:\.\d+)?)(px|rem)/.exec(declaration.value);
        if (!value) return;
        const pixels = Number(value[1]) * (value[2] === "rem" ? 16 : 1);
        const floor = metadataRules.has(file + "::" + declaration.parent.selector) ? 12 : 13;
        if (pixels < floor)
          violations.push(file + ":" + declaration.parent.selector + ":" + declaration.toString());
      });
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
  assert.match(shell, /SCOUTOPS/);
  assert.match(shell, /<h1>\{\{ pageTitle \}\}<\/h1>/);
  assert.match(shell, /class="commerce-sidebar"/);
  assert.doesNotMatch(shell, /class="role-page-title"/);
  assert.doesNotMatch(shell, /<aside\s+id="role-navigation"/);
  assert.match(account, /<nav class="account-sidebar(?:\s|[">])/);
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
