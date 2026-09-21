import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  notificationShellPreview,
  notificationPagePreview,
} from "../../scripts/lib/platform-notification-shell-preview.mjs";
import {
  shellReviewImport,
  shellReviewSetup,
} from "../../scripts/lib/ui-phase2-shell-vue-preview.mjs";

for (const [name, transform] of [
  ["NavigationShell", notificationShellPreview],
  ["PlatformNotificationCenter", notificationPagePreview],
]) {
  test(`${name} C composition keeps business script, styles, and compiles`, async () => {
    const filename = `apps/web/src/components/${name}.vue`;
    const original = (await readFile(filename, "utf8")).replaceAll("\r\n", "\n");
    const result = transform(original);
    const before = parse(original).descriptor,
      after = parse(result).descriptor;
    assert.equal(
      after.scriptSetup.content.replace(shellReviewImport, "").replace(shellReviewSetup, ""),
      before.scriptSetup.content,
    );
    assert.deepEqual(
      after.styles.map(({ loc, ...style }) => style),
      before.styles.map(({ loc, ...style }) => style),
    );
    for (const re of [/\bto="[^"]*"/g, /:to="[^"]*"/g, /@[\w.-]+="[^"]*"/g]) {
      const expected = original.match(re) || [];
      const actual = result.match(re) || [];
      for (const value of new Set(expected))
        assert.equal(
          actual.filter((item) => item === value).length,
          expected.filter((item) => item === value).length,
          value,
        );
    }
    const script = compileScript(after, { id: name });
    assert.deepEqual(
      compileTemplate({
        source: after.template.content,
        filename,
        id: name,
        compilerOptions: { bindingMetadata: script.bindings },
      }).errors,
      [],
    );
    if (name === "PlatformNotificationCenter") assert.equal(transform(result), result);
    else assert.throws(() => transform(result));
    assert.ok(!original.includes("shell-review-navigation"));
  });
}

test("P57 proposal preserves section handlers and moves rail after the only page heading", async () => {
  const production = await readFile(
    "apps/web/src/components/PlatformNotificationCenter.vue",
    "utf8",
  );
  const original = production
    .replace("platform-notifications platform-notifications--review", "platform-notifications")
    .replace("<h1>通知管理</h1>", "<h2>通知管理</h2>");
  const result = notificationPagePreview(original);
  assert.equal((result.match(/<h1>通知管理<\/h1>/g) || []).length, 1);
  assert.ok(result.indexOf("platform-notifications__rail") > result.indexOf("<h1>通知管理</h1>"));
  assert.ok(result.includes('@click="section = item.key"'));
  assert.equal(notificationPagePreview(result), result);
  assert.throws(() =>
    notificationPagePreview(original.replace("platform-notifications__rail", "changed")),
  );
});
