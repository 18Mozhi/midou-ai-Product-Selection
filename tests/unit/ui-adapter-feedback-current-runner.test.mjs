import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildAdapterFeedbackCurrentRunner,
  oldConcurrentReadExpectation,
  currentConcurrentReadExpectation,
} from "../../scripts/lib/ui-adapter-feedback-current-runner.mjs";

const source = readFileSync(
  "scripts/verify-ui-phase2-provider-adapter-feedback.mjs",
  "utf8",
).replaceAll("\r\n", "\n");

test("current feedback runner permits no capture, old preview construction or baseline execution", () => {
  const runner = buildAdapterFeedbackCurrentRunner(source);
  assert.ok(runner.includes("const capture = false;"));
  assert.ok(runner.includes('const modes = ["current"],'));
  assert.ok(runner.includes("for (const width of [390, 760, 761, 1440])"));
  assert.ok(!runner.includes("const feedback = source.match("));
  assert.ok(!runner.includes("replacement = await read(preview)"));
  assert.ok(runner.includes('return mode === "current" ? null : { code: rendered, map: null };'));
  assert.ok(runner.includes('if (mode !== "review") return html;'));
  assert.ok(runner.includes("assert.equal(process.argv.length, 2,"));
});

test("current feedback scenarios differ only in the explicitly superseded concurrent GET expectation", () => {
  const runner = buildAdapterFeedbackCurrentRunner(source);
  const begin = "        const page = await context.newPage(),";
  const end = "    for (const mod of server.moduleGraph.idToModuleMap.values())";
  const body = (text) => text.slice(text.indexOf(begin), text.indexOf(end));
  assert.equal(
    body(runner),
    body(source).replace(oldConcurrentReadExpectation, currentConcurrentReadExpectation),
  );
  assert.ok(runner.includes(currentConcurrentReadExpectation));
  assert.equal(
    runner.slice(runner.lastIndexOf("} finally {")),
    source.slice(source.lastIndexOf("} finally {")),
  );
});

test("current feedback runner rejects changed source, transport, focus or supersession assertions", () => {
  for (const token of [
    "const capture =",
    "await expect(status).toBeFocused();",
    "return route.abort();",
    oldConcurrentReadExpectation,
  ]) {
    const changed = source.replace(token, "// changed\n" + token);
    assert.notEqual(changed, source);
    assert.throws(() => buildAdapterFeedbackCurrentRunner(changed));
  }
});
