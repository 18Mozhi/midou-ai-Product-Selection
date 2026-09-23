import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { onboardingPageSources } from "../../scripts/lib/onboarding-page-evidence.mjs";

test("P09 evidence mounts the production page, child panel, step data, and scoped design", async () => {
  const [page, panel, steps, css] = await Promise.all(
    onboardingPageSources.map((path) => readFile(path, "utf8")),
  );
  assert.match(page.toString(), /OnboardingStepPanel/);
  assert.match(page.toString(), /resolveOnboardingStep/);
  assert.match(panel.toString(), /aria-live="polite"/);
  assert.match(panel.toString(), /aria-atomic="true"/);
  assert.match(steps.toString(), /Number\.isInteger/);
  assert.match(steps.toString(), /Math\.max\(1/);
  assert.match(css.toString(), /\.onboarding-page--c/);
  assert.doesNotMatch(css.toString(), /(?:radial|linear)-gradient/);
  assert.doesNotMatch(css.toString(), /border-radius:\s*(?:\d+px|50%)/);
  assert.doesNotMatch(page.toString() + panel.toString(), /fetch\(|localStorage|sessionStorage/);
});
