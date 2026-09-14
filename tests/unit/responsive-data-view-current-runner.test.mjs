import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDetailCurrentRunner } from "../../scripts/lib/ui-responsive-detail-current-runner.mjs";

const original = readFileSync("scripts/verify-responsive-data-view-focus.mjs", "utf8");
test("all six current scenarios preserve the original interaction assertions and prohibit capture", () => {
  for (const appearance of ["default", "governance", "content"]) {
    for (const motion of ["reduce", "no-preference"]) {
      const runner = buildDetailCurrentRunner(original, appearance, motion);
      for (const line of original.replaceAll("\r\n", "\n").split("\n")) {
        if (/^\s*(await expect\(|assert\.deepEqual\()/.test(line))
          assert.ok(runner.includes(line), line);
      }
      assert.ok(runner.includes(`appearance:'${appearance}'`));
      assert.ok(runner.includes(`reducedMotion: "${motion}"`));
      assert.ok(runner.includes("const capture = false;"));
      assert.ok(runner.includes("assert.equal(process.argv.length, 2"));
      assert.ok(runner.includes("h(KeepAlive"));
      assert.ok(runner.includes("window.__fixture.active.value = false"));
      assert.ok(runner.includes("window.__fixture.active.value = true"));
      assert.ok(runner.includes('route.request().method() === "GET"'));
      assert.equal(runner.includes("getComputedStyle(node)"), appearance !== "default");
      if (appearance !== "default") {
        assert.ok(runner.includes("border: 'rgb(207, 217, 232)'"));
        assert.ok(runner.includes(appearance === "governance" ? "#2d63cd" : "#2558bd"));
      }
    }
  }
});
test("changed original assertions or fixtures fail closed instead of silently rewriting history", () => {
  for (const source of [
    original + "\n// drift",
    original.replace("toBeFocused()", "toBeVisible()"),
  ])
    assert.throws(() => buildDetailCurrentRunner(source, "default", "reduce"), /original driver/);
});
test("unknown themes or motion options fail; CRLF preserves the same executable adapter", () => {
  assert.throws(() => buildDetailCurrentRunner(original, "unknown", "reduce"));
  assert.throws(() => buildDetailCurrentRunner(original, "default", "unknown"));
  assert.equal(
    buildDetailCurrentRunner(
      original.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"),
      "content",
      "reduce",
    ),
    buildDetailCurrentRunner(original, "content", "reduce"),
  );
});
