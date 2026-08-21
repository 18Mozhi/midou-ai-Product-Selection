import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const e2eRoot = resolve(root, "tests/e2e");
const specs = (await readdir(e2eRoot)).filter((name) => name.endsWith(".spec.ts"));
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
  ].join(" "),
);
