import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readArchivedCompetitorSource } from "../../scripts/lib/retired-competitor-surface.mjs";
const retired = ["selection-journey-enhancements.css", "MonitoringReadinessStrip.vue"];
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}
test("retired unused journey styles and monitoring card cannot return to the current UI", () => {
  assert.equal(existsSync("apps/web/src/selection-journey-enhancements.css"), false);
  assert.equal(existsSync("apps/web/src/components/shared/MonitoringReadinessStrip.vue"), false);
  for (const file of files("apps/web/src")) {
    if (!/\.(?:vue|ts|css)$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const name of retired) assert.ok(!source.includes(name), `${file} retains ${name}`);
  }
  assert.equal(existsSync("apps/web/src/components/shared/monitoring-readiness.ts"), true);
});
test("retired monitoring card historical evidence remains explicit and read-only", () => {
  const source = readArchivedCompetitorSource(
    "apps/web/src/components/shared/MonitoringReadinessStrip.vue",
  );
  assert.match(source, /MonitoringReadinessFact/);
  assert.match(source, /monitoring-readiness__summary/);
});

const retiredStyles = [
  "apps/web/src/design/home-dashboard-tokens.css",
  "apps/web/src/provider-sources.css",
  "apps/web/src/design/approval-read-feedback-tokens.css",
  "apps/web/src/design/identity-mfa-tokens.css",
  "apps/web/src/design/identity-recovery-tokens.css",
  "apps/web/src/design/identity-registration-tokens.css",
  "apps/web/src/design/identity-reset-tokens.css",
  "apps/web/src/design/identity-verification-tokens.css",
  "apps/web/src/design/local-identity-login-tokens.css",
];
test("unreferenced legacy source and identity palette styles stay outside runtime source", () => {
  for (const p of retiredStyles) assert.equal(existsSync(p), false, p);
  for (const file of files("apps/web/src")) {
    if (!/\.(?:vue|ts|css)$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const p of retiredStyles)
      assert.ok(!source.includes(p.split("/").at(-1)), `${file} imports retired style ${p}`);
  }
});

test("commerce section labels keep scoped precedence without important", () => {
  const source = readFileSync("apps/web/src/commerce-workspace.css", "utf8");
  assert.match(source, /\.trend-dashboard \.trend-section-label/);
  assert.match(source, /\.sourcing-workspace \.sourcing-section-label/);
  assert.doesNotMatch(source, /!important/);
  const qualified = source.slice(source.indexOf(".trend-dashboard .trend-section-label"));
  assert.equal(qualified.match(/\{([^}]*)\}/)[1].trim(), "font-size: 12px;");
});

test("unused legacy modal trap stays removed while the active dialog focus helper remains", () => {
  assert.equal(existsSync("apps/web/src/modal-dialog-keyboard.ts"), false);
  assert.equal(existsSync("apps/web/src/ui/contain-dialog-tab.ts"), true);
  for (const file of files("apps/web/src")) {
    if (!/\.(?:vue|ts|css)$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    assert.ok(!source.includes("modal-dialog-keyboard"), `${file} retains old modal helper`);
    assert.ok(!source.includes("trapModalTab"), `${file} retains old modal trap`);
  }
  const active = readFileSync("apps/web/src/components/OpportunityWorkspaceDialogs.vue", "utf8");
  assert.match(active, /containDialogTab\(\$event, decisionDialog\)/);
});
