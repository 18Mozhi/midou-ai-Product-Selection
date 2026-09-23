import assert from "node:assert/strict";
import test from "node:test";
import { personalCenterPagePlugin } from "../../scripts/lib/personal-center-page-preview.mjs";

test("P11 review plugin keeps production Vue templates unchanged", () => {
  const plugin = personalCenterPagePlugin();
  assert.equal(plugin.transform, undefined);
  const html = plugin.transformIndexHtml("<html><head></head><body></body></html>");
  assert.match(html, /<body class="p11-review">/);
  assert.match(html, /personal-center-page-preview\.css/);
});
