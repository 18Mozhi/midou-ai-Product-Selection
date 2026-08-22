import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const read = (path) => readFile(path, "utf8");
test("M02-02.A01-A06/A09/A10/A13 reuses real identity tenancy contracts without new schema or invented providers", async () => {
  const [identity, tenancy, onboarding, apiClient, openapi, architecture, env] = await Promise.all(
    [
      "apps/web/src/components/LocalIdentity.vue",
      "apps/web/src/components/TenancyChooser.vue",
      "apps/web/src/components/OnboardingGuide.vue",
      "apps/web/src/api-client.ts",
      "docs/openapi.yaml",
      "docs/architecture/m02-02-auth-onboarding-pages.md",
      "config/env.example",
    ].map(read),
  );
  for (const endpoint of [
    "/auth/login",
    "/auth/register",
    "/auth/password-reset/request",
    "/auth/password-reset/confirm",
    "/auth/email-verification/confirm",
    "/org/memberships",
    "/auth/context",
  ]) {
    assert.match(identity + tenancy + openapi, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  for (const mode of ["login", "register", "forgot", "verify", "reset"])
    assert.match(identity, new RegExp(`["']${mode}["']`));
  assert.match(identity, /createApiClient/);
  assert.match(apiClient, /credentials\s*:\s*["']include["']/);
  assert.doesNotMatch(identity, /Google|Microsoft|手机登录|SSO 单点登录/);
  assert.match(onboarding, /三步|step\s*<\s*3|第 \{\{\s*step\s*\}\} \/ 3/);
  assert.match(architecture, /本模块不新增迁移/);
  assert.doesNotMatch(env, /ONBOARDING_|AUTH_PAGE_/);
  const migrations = await readdir("database/migrations");
  assert.equal(migrations.filter((name) => name.includes("m02_02")).length, 0);
});
test("M02-02.A07/A08/A11/A15/A16 pages expose responsive keyboard visual and truthful recovery states", async () => {
  const [identity, tenancy, onboarding, foundationStyles, navigationStyles, e2e, runbook, feature] =
    await Promise.all(
      [
        "apps/web/src/components/LocalIdentity.vue",
        "apps/web/src/components/TenancyChooser.vue",
        "apps/web/src/components/OnboardingGuide.vue",
        "apps/web/src/styles.css",
        "apps/web/src/styles/onboarding-navigation.css",
        "tests/e2e/m02-02-auth-onboarding.spec.ts",
        "docs/runbooks/m02-02-auth-onboarding-pages.md",
        "docs/feature-map.json",
      ].map(read),
    );
  const styles = `${foundationStyles}\n${navigationStyles}`;
  for (const state of ["rate_limited", "blocked", "expired"])
    assert.match(identity, new RegExp(state));
  assert.match(identity, /请求标识/);
  assert.match(identity, /智能选品账号/);
  assert.doesNotMatch(identity, /AI SELECTION ACCOUNT|SECURITY CENTER/);
  assert.match(styles, /identity-form-row \.text-button[\s\S]*white-space:\s*nowrap/);
  assert.match(
    styles,
    /identity-page\[data-mode=["']login["']\] \.identity-brand[\s\S]*min-height:\s*44px/,
  );
  assert.match(
    styles,
    /@media\s*\(\s*max-width:\s*820px\s*\)[\s\S]*identity-page\[data-mode=["']login["']\] \.identity-card__foot[\s\S]*grid-template-columns:\s*repeat\(2/,
  );
  assert.match(
    styles,
    /identity-page\[data-mode=["']login["']\] \.identity-card__foot button,[\s\S]*identity-page\[data-mode=["']login["']\] \.identity-card__foot a[\s\S]*min-height:\s*44px/,
  );
  for (const state of ["empty", "forbidden", "expired", "selected"])
    assert.match(tenancy, new RegExp(state));
  assert.match(onboarding, /aria-current/);
  assert.match(styles, /@media\s*\(\s*max-width:\s*780px\s*\)/);
  assert.match(e2e, /keyboard\.press/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(runbook, /仅在宝塔网站发布/);
  assert.match(feature, /authOnboardingPages/);
});
