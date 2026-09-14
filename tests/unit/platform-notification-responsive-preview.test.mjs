import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import postcss from "postcss";

test("responsive verifier rejects missing shell mode, duplicate and unknown flags before starting", () => {
  for (const args of [
    ["--responsive"],
    ["--unknown"],
    ["--shell-preview", "--responsive", "--responsive"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-platform-notification-app.mjs", ...args],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /AssertionError/);
    assert.ok(!result.stdout.includes("p57_actual_app="));
  }
});

test("narrow reading layout is limited to the review shell and non-phone workbench container", async () => {
  const css = postcss.parse(
    await readFile(
      "design-plans/ui-phase-2-2026-09-07/implementation/platform-notification-shell-preview.css",
      "utf8",
    ),
  );
  const containers = [];
  css.walkAtRules("container", (rule) => containers.push(rule));
  assert.equal(containers.length, 1);
  const container = containers[0];
  assert.equal(container.params, "p57-messages (max-width: 640px)");
  assert.equal(container.parent.name, "media");
  assert.equal(container.parent.params, "(min-width: 761px)");
  assert.match(container.parent.parent.selector, /\.role-shell\.role-shell--review$/);
  const body = container.nodes.find((node) => node.selector === ".message-workbench__body");
  assert.ok(
    body.nodes.some(
      (node) => node.prop === "grid-template-columns" && node.value === "minmax(0, 1fr)",
    ),
  );
  const production = await readFile("apps/web/src/platform-notifications.css", "utf8");
  assert.ok(
    !production.includes("platform-notification-shell-preview") &&
      !production.includes("p57-messages"),
  );
});
