import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewHomeAutomation, previewHomeDashboard } from "../../scripts/lib/home-page-preview.mjs";
test("P12 review preserves home summary, rule writes and quality-gate wording", async () => { const [dashboard, automation] = await Promise.all([readFile("apps/web/src/components/HomeDashboard.vue", "utf8"), readFile("apps/web/src/components/HomeAutomationOverview.vue", "utf8")]); const a = previewHomeDashboard(dashboard), b = previewHomeAutomation(automation); assert.match(a,/request<Summary>\("\/me\/home-dashboard"/); assert.match(a,/\/trends\/monitoring-rules/); assert.match(a,/resumeRule\(pausedRules\[0\]\)/); assert.match(a,/五项质量门/); assert.match(a,/最终采纳仍由人完成/); assert.match(b,/selection\.recommended_count/); });
