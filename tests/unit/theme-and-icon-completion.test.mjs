import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

test("production CSS has no global compatibility patch or important overrides", async () => {
  const paths = (await readdir("apps/web/src", { recursive: true }))
    .filter((path) => path.endsWith(".css"))
    .map((path) => `apps/web/src/${path.replaceAll("\\", "/")}`);
  const sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));

  assert.ok(!paths.includes("apps/web/src/theme-compat.css"));
  for (const [index, source] of sources.entries()) {
    // Keep high-priority overrides inside OS reduced-motion blocks, but reject them elsewhere.
    const withoutReducedMotionBlocks = source.replace(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?^\}/gm,
      "",
    );
    assert.doesNotMatch(withoutReducedMotionBlocks, /!important/, paths[index]);
  }
});

test("body copy and interactive controls preserve the accessibility floor", async () => {
  const [accessibility, member] = await Promise.all(
    ["apps/web/src/accessibility.css", "apps/web/src/member-workspace-polish.css"].map((path) =>
      readFile(path, "utf8"),
    ),
  );

  assert.match(accessibility, /--so-font-body:\s*1rem/);
  assert.match(accessibility, /--so-touch-target:\s*44px/);
  assert.match(accessibility, /#app small\s*\{\s*font-size:\s*var\(--so-font-meta\)/);
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
  const [main, theme, tokens, studio, shell, shellTheme, task, personal, approval, notification] =
    await Promise.all(
      [
        "apps/web/src/main.ts",
        "apps/web/src/design/theme.ts",
        "apps/web/src/design/tokens.css",
        "apps/web/src/components/ThemeStudio.vue",
        "apps/web/src/components/NavigationShell.vue",
        "apps/web/src/use-navigation-shell-theme.ts",
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
  assert.match(studio, /label="页面密度"/);
  assert.match(shell, /applyShellDensity\(props\.shell !== "member"\)/);
  assert.match(shellTheme, /\/me\/ui-preferences/);
  assert.match(shellTheme, /主题保存失败，已恢复原主题/);
  assert.match(tokens, /\[data-density="compact"\]/);
  assert.match(tokens, /--so-font-meta:\s*0\.8125rem/);
  assert.doesNotMatch(shell, /applyTheme\("cloud-white"\)/);
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
    if (paths[index] === "apps/web/src/design/provider-registry-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        new RegExp(
          "^html:has\\(#app\\s*\\.provider-registry\\)\\s*\\{(?:\\s*--p46-[a-z-]+:\\s*(?:#[0-9a-f]{3,6}|rgba?\\([^;]+\\));)+\\s*\\}$",
        ),
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/provider-compatibility-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.source-modal\.p48-compatibility-modal,\s*\.source-modal\.p48-parser-samples-modal\s*\{(?:\s*--p48-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/provider-source-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.source-center--p48\s*\{(?:\s*--p48-source-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/platform-admin-mobile-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        new RegExp(
          '^@media\\s*\\(max-width:\\s*760px\\)\\s*\\{\\s*html\\[data-design="signal-ledger"\\]\\s*#app\\s*\\.account-center:has\\(\\.account-tabs\\s*a\\[href="/platform-admin/admins"\\]\\[aria-current="page"\\]\\)\\s*\\{(?:\\s*--so-admin-mobile-[a-z-]+:\\s*#[0-9a-f]{3,6};)+\\s*\\}\\s*\\}$',
        ),
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/platform-data-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        new RegExp(
          "^\\.platform-data\\s*\\{(?:\\s*--so-data-[a-z-]+:\\s*(?:#[0-9a-f]{3,6}|rgb\\((?:24 45 84 / 14%|255 255 255 / (?:10|30|38|48|86)%)\\));)+\\s*\\}$",
        ),
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/platform-overlay-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        new RegExp(
          "^\\.responsive-data-view__overlay--governance,\\s*\\.responsive-data-view__overlay--content,\\s*\\.responsive-filter-drawer--governance,\\s*\\.responsive-filter-drawer--content,\\s*\\.responsive-filter-drawer--notifications\\s*\\{(?:\\s*--so-workspace-overlay-[a-z-]+:\\s*#[0-9a-f]{3,6};)+\\s*\\}$",
        ),
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/provider-adapter-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.adapter-center--c\)\s*\{(?:\s*--p47-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgba\(15, 31, 53, 0\.55\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/platform-notification-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.platform-notifications,\s*\.message-dialog,\s*\.message-reader-dialog,\s*\.notification-action-dialog,\s*\.responsive-filter-drawer--notifications\s*\{(?:\s*--so-platform-notification-[a-z-]+:\s*#[0-9a-f]{6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/content-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.platform-content,\s*\.platform-content-review,\s*\.responsive-filter-drawer--content,\s*\.responsive-data-view__overlay--content\s*\{(?:\s*--so-content-[a-z-]+:\s*#[0-9a-f]{6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/governance-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.platform-governance\s*\{(?:\s*--so-governance-[a-z-]+:\s*#[0-9a-f]{6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/approval-workspace-tokens.css") {
      const palette = new Set(
        [
          ...source.matchAll(/(--so-approval-review-[a-z-]+):\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));/gi),
        ].map((match) => match[1]),
      );
      const stylesheet = sources[paths.indexOf("apps/web/src/approval-workspace.css")];
      const references = new Set(
        [...stylesheet.matchAll(/var\((--so-approval-review-[a-z-]+)\)/g)].map((match) => match[1]),
      );
      assert.equal(palette.size, 14);
      assert.deepEqual([...references].sort(), [...palette].sort());
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.approval-workspace--review\s*\{[\s\S]*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/opportunity-review-tokens.css") {
      const palette = new Set(
        [
          ...source.matchAll(
            /(--so-opportunity(?:-review|-list)-[a-z-]+):\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));/gi,
          ),
        ].map((match) => match[1]),
      );
      const stylesheet = [
        sources[paths.indexOf("apps/web/src/automatic-selection.css")],
        sources[paths.indexOf("apps/web/src/components/OpportunityDetailNavigation.vue")],
      ].join("\n");
      const references = new Set(
        [...stylesheet.matchAll(/var\((--so-opportunity(?:-review|-list)-[a-z-]+)\)/g)].map(
          (match) => match[1],
        ),
      );
      assert.equal(palette.size, 25);
      assert.deepEqual([...references].sort(), [...palette].sort());
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.opportunity-workspace--review\s*\{[\s\S]*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/opportunity-ai-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(#app \.opportunity-workspace--review\)\s*\{(?:\s*--so-opportunity-ai-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/opportunity-p18-workfaces-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(#app \.opportunity-workspace--review\)\s*\{(?:\s*--so-opportunity-p18-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/automation-rule-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.automation-center--review\s*\{(?:\s*--so-automation-rule-[a-z-]+:\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/backup-recovery-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html body:has\(\.backup-center--c\),\s*\.backup-center\.backup-center--c\s*\{(?:\s*--so-backup-c-[a-z-]+:\s*#[0-9a-f]{6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/capacity-boundary-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html body:has\(#app \.capacity-boundary--c\),\s*\.capacity-boundary--c\s*\{(?:\s*--so-capacity-c-[a-z-]+:\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/collection-task-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.collection-task-center--review\s*\{(?:\s*--so-collection-task-c-[a-z-]+:\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/competitor-review-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.competitor-monitor--review\s*\{(?:\s*--so-competitor-c-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/crawler-runtime-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.crawler-center--review\s*\{(?:\s*--so-crawler-c-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/crawler-scheduler-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html body:has\(#app \.crawler-scheduler--c\),\s*\.crawler-scheduler--c\s*\{(?:\s*--p70-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/credential-assets-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html body:has\(#app \.credential-center\)\s*\{(?:\s*--p50-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/file-resilience-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.file-resilience--c\s*\{(?:\s*--file-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/home-dashboard-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.home-dashboard\s*\{(?:\s*--home-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/mysql-resilience-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html body:has\(#app \.mysql-resilience--c\),\s*\.mysql-resilience--c\s*\{(?:\s*--p68-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/notification-inbox-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.notification-center--review\s*\{(?:\s*--review-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/open-platform-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.role-shell:has\(\.open-platform--c\)\s*\{(?:\s*--p60-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*--(?:text|text-muted|surface|bg|border|primary|danger|warning):\s*var\(--p60-[a-z-]+\);(?:\s*--(?:text|text-muted|surface|bg|border|primary|danger|warning):\s*var\(--p60-[a-z-]+\);)*\s*\}\s*\.open-platform--c\s*\{(?:\s*--so-[a-z-]+:\s*var\(--p60-[a-z-]+\);)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/sourcing-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.sourcing-workspace--review\)\s*\{(?:\s*--so-sourcing-review-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\)|var\(--so-(?:text|panel)\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/organization-admin-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.org-admin-center\)\s*\{(?:\s*--oa-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/navigation-shell-c-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^#app \.role-shell\.role-shell--c\s*\{(?:\s*--shell-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/discovery-c-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.discovery-c-backdrop\s*\{(?:\s*--discovery-c-[a-z-]+:\s*(?:#[0-9a-f]{3,8}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/navigation-shell-c-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^#app \.role-shell\.role-shell--c\s*\{(?:\s*--shell-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/task-workspace-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.task-workspace--review\)\s*\{(?:\s*--tw-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/trend-dashboard-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.trend-dashboard--review\)\s*\{(?:\s*--trend-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/platform-dashboard-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.platform-dashboard--review\)\s*\{(?:\s*--pd-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/collection-ops-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.collection-ops--review\)\s*\{(?:\s*--p52-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/acceptance-1688-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.acceptance-1688\)\s*\{(?:\s*--acceptance-[a-z-]+:\s*#[0-9a-f]{3,8};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/api-coverage-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.api-coverage--c\)\s*\{(?:\s*--p63-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/commercial-review-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.commercial--review\)\s*\{(?:\s*--so-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/landing-redirect-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.landing-redirect\s*\{(?:\s*--p01-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/local-identity-login-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.p02-login-page\)\s*\{(?:\s*--p02-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/identity-mfa-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.p07-mfa-page\)\s*\{(?:\s*--p07-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/identity-recovery-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.p04-recovery-page\)\s*\{(?:\s*--p04-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/identity-registration-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.p03-registration-page\)\s*\{(?:\s*--p03-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/identity-reset-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.p06-reset-page\)\s*\{(?:\s*--p06-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/identity-verification-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.p05-verification-page\)\s*\{(?:\s*--p05-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/not-found-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.not-found-page--review\)\s*\{(?:\s*--p73-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/organization-wizard-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.organization-wizard\)\s*\{(?:\s*--ow-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/account-center-tokens.css") {
      const palette = source.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      assert.match(
        palette,
        new RegExp(
          String.raw`^html:has\(body #app \.account-center--review\)\s*\{(?:\s*--account-review-[a-z-]+:\s*(?:#[0-9a-f]{3,8}|rgba?\([^;]+\));)+\s*\}` +
            String.raw`\s*html:has\(body #app \.account-center--organization-review\),\s*html:has\(body #app \.account-center--user-admin-c\),\s*html:has\(body #app \.account-center--admins-c\),\s*html:has\(body #app \.account-center--users-c\)\s*\{(?:\s*--account-org-[a-z-]+:\s*(?:#[0-9a-f]{3,8}|rgba?\([^;]+\));)+\s*\}` +
            String.raw`\s*html:has\(body #app \.account-center--users-c\)\s*\{(?:\s*--account-users-[a-z-]+:\s*(?:#[0-9a-f]{3,8}|rgba?\([^;]+\));)+\s*\}` +
            String.raw`\s*html:has\(body #app \.account-center--review \.account-filter--overview-c\)\s*\{(?:\s*--p39-[a-z-]+:\s*(?:#[0-9a-f]{3,8}|rgba?\([^;]+\));)+\s*\}$`,
        ),
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/account-permissions-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.account-center--permissions-c\)\s*\{(?:\s*--account-permission-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/tenancy-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.tenancy-page\s*\{(?:\s*--p08-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/organization-audit-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.org-admin-center \.org-audit-panel\)\s*\{(?:\s*--org-audit-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/platform-log-center-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.platform-log-center--c\)\s*\{(?:\s*--p62-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/provider-source-filters-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^\.source-filter\s*\{(?:\s*--source-filter-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/platform-status-center-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.platform-management--status-c\)\s*\{(?:\s*--p61-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/cost-rule-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.cost-console--review\)\s*\{(?:\s*--p22-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/redis-resilience-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.redis-resilience--c\)\s*\{(?:\s*--rr-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/report-center-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.report-center--review\)\s*\{(?:\s*--report-review-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/runtime-topology-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.topology-center--c\)\s*\{(?:\s*--topology-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/scoring-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.score-rules--review\)\s*\{(?:\s*--p17-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/security-operations-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html:has\(body #app \.security-ops--c\)\s*\{(?:\s*--p59-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/export-detail-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html #app \[data-export-detail-c\] \.org-data-export-list\s*\{(?:\s*--so-export-detail-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/approval-read-failure-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html #app \.org-approval-first-failure-c\s*\{(?:\s*--so-approval-failure-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/approval-read-feedback-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html #app \.org-approval-read-feedback-c\s*\{(?:\s*--so-approval-feedback-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/token-filter-tokens.css") {
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html #app \.org-token-filters-c\s*\{(?:\s*--so-token-filter-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/approval-filter-tokens.css") {
      // P34 palette can only declare tokens on this filter, never global styling rules.
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html #app :is\(\.org-approval-template-filters-c, \.org-template-empty-c\)\s*\{(?:\s*--so-approval-filter-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/workspace-restore-tokens.css") {
      // P32 palette is opt-in to one reason variant; reject ordinary rules or broader selectors.
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html #app dialog\.workspace-restore-reason\s*\{\s*--so-font-meta:\s*16px;(?:\s*--so-restore-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/roles-tokens.css") {
      // Like P16, this page-lazy palette may declare scoped tokens only, not styling rules.
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html #app \.org-admin-center:has\(> \.org-role-page\)\s*\{(?:\s*--so-roles-[a-z-]+:\s*#[0-9a-f]{3,6};)+\s*\}$/,
      );
      continue;
    }
    if (paths[index] === "apps/web/src/design/selection-tokens.css") {
      // Page-lazy token source: only scoped custom properties, never ordinary CSS rules.
      assert.match(
        source.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
        /^html #app \.selection-journey\s*\{(?:\s*--so-selection-[a-z-]+:\s*(?:#[0-9a-f]{3,6}|var\(--so-panel\));)+\s*\}$/,
      );
      continue;
    }
    assert.doesNotMatch(source, /#(?:[0-9a-f]{3,8})\b/i, paths[index]);
    assert.doesNotMatch(source, /(?:rgb|hsl)a?\(/i, paths[index]);
  }
  assert.match(sources.join("\n"), /var\(--so-(?:bg|panel|text|border|primary)/);
});

test("icon-only production actions expose hover and focus names", async () => {
  const [main, shell, credentials, registry, sourcingDialogs] = await Promise.all(
    [
      "apps/web/src/main.ts",
      "apps/web/src/components/NavigationShell.vue",
      "apps/web/src/components/CredentialAssetCenter.vue",
      "apps/web/src/components/ProviderRegistry.vue",
      "apps/web/src/components/SourcingWorkspaceDialogs.vue",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(main, /button\[aria-label\],a\[aria-label\]/);
  assert.match(main, /element\.title = label/);
  for (const label of ["通知中心", "个人中心"])
    assert.match(shell, new RegExp(`aria-label="${label}"`));
  for (const label of ["关闭凭证编辑", "关闭浏览器档案编辑"])
    assert.match(credentials, new RegExp(label));
  assert.match(registry, /关闭来源设置编辑/);
  assert.match(sourcingDialogs, /关闭供应商搜索/);
  assert.match(sourcingDialogs, /关闭报价编辑/);
});
