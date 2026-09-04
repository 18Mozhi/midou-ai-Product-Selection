import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const e2eRoot = resolve(root, "tests/e2e");
const specs = (await readdir(e2eRoot)).filter((name) => name.endsWith(".spec.ts"));
const productionManifest = JSON.parse(
  await readFile(resolve(root, "infra/baota/production-acceptance-manifest.json"), "utf8"),
);
const productionCoreVerifier = await readFile(
  resolve(root, "scripts/verify-production-core-e2e.mjs"),
  "utf8",
);
let screenshotCalls = 0;
let screenshotCallsInMockedFiles = 0;
let realApiScreenshotCases = 0;

for (const spec of specs) {
  const source = await readFile(resolve(e2eRoot, spec), "utf8");
  const snapshots = source.match(/toHaveScreenshot\s*\(/g)?.length ?? 0;
  const captures = source.match(/page\.screenshot\s*\(/g)?.length ?? 0;
  const total = snapshots + captures;
  screenshotCalls += total;
  if (/page\.route\s*\(/.test(source)) screenshotCallsInMockedFiles += total;
  if (
    /\[real-api\]/.test(source) &&
    /waitForResponse/.test(source) &&
    /page\.screenshot\s*\(/.test(source) &&
    !/page\.route\s*\(/.test(source)
  )
    realApiScreenshotCases += 1;
}

const productionRealStackScreenshots = Number(
  productionManifest.baseline?.realCoreScreenshotCount ?? 0,
);
if (
  productionRealStackScreenshots !== 4 ||
  /page\.route\s*\(/.test(productionCoreVerifier) ||
  !/source_decision_task/.test(productionCoreVerifier) ||
  !/approval_decision_desk/.test(productionCoreVerifier) ||
  !/sourcing_cost_profit/.test(productionCoreVerifier) ||
  !/dependencies\?\.mysql === "available"/.test(productionCoreVerifier) ||
  !/dependencies\?\.redis === "available"/.test(productionCoreVerifier)
)
  throw new Error("production_core_real_stack_screenshot_contract_invalid");
screenshotCalls += productionRealStackScreenshots;

if (screenshotCalls === 0) throw new Error("e2e_screenshot_coverage_missing");
const mockedRatio = screenshotCallsInMockedFiles / screenshotCalls;
if (mockedRatio >= 0.5)
  throw new Error(
    `e2e_mocked_screenshot_ratio_exceeded:${screenshotCallsInMockedFiles}/${screenshotCalls}`,
  );
if (realApiScreenshotCases < 2) throw new Error("e2e_real_api_screenshot_coverage_insufficient");

console.log(
  [
    "e2e_realism_gate_passed",
    `screenshots=${screenshotCalls}`,
    `mocked_file_screenshots=${screenshotCallsInMockedFiles}`,
    `mocked_ratio=${mockedRatio.toFixed(4)}`,
    `real_api_screenshot_cases=${realApiScreenshotCases}`,
    `production_real_stack_screenshots=${productionRealStackScreenshots}`,
  ].join(" "),
);
