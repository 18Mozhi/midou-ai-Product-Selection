import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const adapterFeedbackDriverHash =
  "4b2b39aeca9420f71264f1fd412e310d840e15d007c0d82aac352603f6374310";

export const oldConcurrentReadExpectation =
  '          await expect(center.locator(".adapter-message")).toContainText("已刷新");\n' +
  "          probeStatus = 200;";
export const currentConcurrentReadExpectation =
  '          await expect(center.getByRole("button", { name: "刷新状态", exact: true })).toBeEnabled();\n' +
  '          await expect(center.locator(".adapter-message")).toHaveCount(0);\n' +
  '          await expect(status).toHaveText("正在检查此来源，请稍候。");\n' +
  "          await expect(status).toBeFocused();\n" +
  '          await expect(drawer.getByRole("button", { name: "检查中…", exact: true })).toBeDisabled();\n' +
  '          check("superseded GET cannot publish during pending probe", true);\n' +
  "          probeStatus = 200;";

export function buildAdapterFeedbackCurrentRunner(source) {
  let runner = source.replaceAll("\r\n", "\n");
  assert.equal(createHash("sha256").update(runner).digest("hex"), adapterFeedbackDriverHash);
  function replace(before, after) {
    assert.equal(runner.split(before).length, 2, before);
    runner = runner.replace(before, after);
  }
  replace('const capture = process.argv.includes("--capture");', "const capture = false;");
  replace(
    'assert.ok(process.argv.slice(2).every((a) => a === "--capture"));',
    'assert.equal(process.argv.length, 2, "Current feedback verifier takes no arguments");',
  );
  replace(
    "const source = await read(component),\n  replacement = await read(preview);\n" +
      "const baseline = historicalAdapterFeedbackSource(component, source);\n" +
      'assert.equal(baseline.split("</script>")[0], replacement.split("</script>")[0]);',
    "const source = await read(component);",
  );
  const start = runner.indexOf("const feedback = source.match(");
  const end = runner.indexOf("  checks = [],", start);
  assert.ok(start > 0 && end > start);
  // Remove only unused old baseline/review construction. Current Vite mode returns no transform.
  runner =
    runner.slice(0, start) +
    'const baseline = null, review = null;\nconst modes = ["current"],\n' +
    runner.slice(end);
  replace(
    'for (const width of mode === "review" ? [390, 760] : [390, 760, 1440]) {',
    "for (const width of [390, 760, 761, 1440]) {",
  );
  // f2e87218 read ownership intentionally supersedes this one old feedback-stage assertion.
  replace(oldConcurrentReadExpectation, currentConcurrentReadExpectation);
  replace(
    "      runs: runs.length,",
    '      runs: runs.length,\n      currentOnly: true,\n      processesClosed: true,\n      observations: checks,\n      networkCounts: network.map(n => ({width:n.width, GET:n.requests.filter(r=>r.key.startsWith("GET ")).length, POST:n.requests.filter(r=>r.key.startsWith("POST ")).length})),',
  );
  return runner;
}
