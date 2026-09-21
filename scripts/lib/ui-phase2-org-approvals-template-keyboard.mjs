import assert from "node:assert/strict";
import { buildApprovalsAppPaginationRunner } from "./ui-phase2-org-approvals-app-pagination.mjs";

export function buildTemplateKeyboardRunner(source) {
  let runner = buildApprovalsAppPaginationRunner(source);
  const replace = (before, after) => {
    assert.equal(runner.split(before).length, 2, `Inspect template keyboard anchor: ${before}`);
    runner = runner.replace(before, after);
  };
  replace(
    'import assert from "node:assert/strict";',
    'import assert from "node:assert/strict";\nimport { verifyTemplateKeyboard, verifyCrossPageTemplate } from "./lib/ui-phase2-org-approvals-template-keyboard.mjs";',
  );
  replace(
    'output = "output/playwright/p34-pagination-app-c-r3";',
    'output = "output/playwright/p34-template-keyboard-c-r1";',
  );
  replace('kind: "P34-PAGINATION-ACTUAL-APP-C-r3",', 'kind: "P34-TEMPLATE-KEYBOARD-C-r1",');
  replace(
    '          if (!capture || mode !== "review") return;',
    '          if (!capture || mode !== "review" || !["template-technical-space", "template-technical-enter", "template-cross-page-retained"].includes(scene)) return;',
  );
  replace(
    '  "scripts/verify-ui-phase2-org-approvals-vue-c.mjs",',
    '  "scripts/verify-ui-phase2-org-approvals-vue-c.mjs",\n  "scripts/verify-ui-phase2-org-approvals-template-keyboard.mjs",\n  "scripts/lib/ui-phase2-org-approvals-template-keyboard.mjs",',
  );
  replace(
    '        await filters.locator(\'input[type="search"]\').fill("找不到的审核模板");',
    '        await verifyTemplateKeyboard({ page, directory, detail, check, shot, templates: originalData.templates, requestCount: () => requests.length });\n        await filters.locator(\'input[type="search"]\').fill("找不到的审核模板");',
  );
  replace(
    "          for (const status of [500, 429]) {",
    "          await verifyCrossPageTemplate({ page, directory, detail, check, shot, templates: payload.templates, requestCount: () => requests.length });\n          for (const status of [500, 429]) {",
  );
  return runner;
}

async function visibleFocus(locator, check, name) {
  check(name + ": focused", await locator.evaluate((el) => el === document.activeElement));
  check(
    name + ": visible before screenshot",
    await locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        r.left >= 0 &&
        r.right <= innerWidth &&
        el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
      );
    }),
  );
  check(
    name + ": focus indicator",
    await locator.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    }),
  );
}

async function assertIdentity(directory, detail, templates, check, name) {
  const title = (await detail.locator(":scope > header h5").textContent()).trim();
  const template = templates.find((item) => item.name === title);
  assert.ok(template, name + ": fixture identity exists");
  check(
    name + ": technical ID matches displayed title",
    (await detail.locator("details code").textContent()).trim(),
    "模板 ID：" + template.id,
  );
  const selected = directory.locator(':scope > button[aria-pressed="true"]');
  check(name + ": exactly one visible selection", await selected.count(), 1);
  check(
    name + ": selected title matches detail",
    (await selected.locator("b").textContent()).trim(),
    title,
  );
}

export async function verifyTemplateKeyboard({
  page,
  directory,
  detail,
  check,
  shot,
  templates,
  requestCount,
}) {
  const count = requestCount();
  const buttons = directory.locator(":scope > button");
  await buttons.first().focus();
  await page.keyboard.press("Tab");
  check(
    "template native Tab reaches next entry",
    await buttons.nth(1).evaluate((el) => el === document.activeElement),
  );
  for (const [index, key] of [
    [1, "Space"],
    [0, "Enter"],
  ]) {
    const button = buttons.nth(index);
    await button.focus();
    await page.keyboard.press(key);
    await visibleFocus(button, check, "template " + key);
    await assertIdentity(directory, detail, templates, check, "template " + key);
    const summary = detail.locator("summary");
    // Traverse the real tab order; do not focus or scroll the destination for the assertion.
    for (
      let step = 0;
      step < 8 && !(await summary.evaluate((el) => el === document.activeElement));
      step++
    )
      await page.keyboard.press("Tab");
    await visibleFocus(summary, check, "technical " + key);
    check(
      "technical initially collapsed " + key,
      await detail.locator("details").getAttribute("open"),
      null,
    );
    check(
      "technical ID initially hidden " + key,
      await detail.locator("details code").isVisible(),
      false,
    );
    await page.keyboard.press(key);
    check("technical expanded " + key, await detail.locator("details").getAttribute("open"), "");
    check("technical ID visible " + key, await detail.locator("details code").isVisible());
    await visibleFocus(summary, check, "expanded technical " + key);
    await shot("template-technical-" + key.toLowerCase(), ".org-approval-template-detail details");
    await page.keyboard.press(key);
    check("technical collapses " + key, await detail.locator("details").getAttribute("open"), null);
  }
  check("template keyboard adds no API requests", requestCount(), count);
}

export async function verifyCrossPageTemplate({
  page,
  directory,
  detail,
  check,
  shot,
  templates,
  requestCount,
}) {
  const count = requestCount();
  const retained = (await detail.locator("details code").textContent()).trim();
  check("cross-page original selected ID retained", retained, "模板 ID：" + templates[1].id);
  const button = directory.locator(":scope > button").first();
  await button.focus();
  await page.keyboard.press("Enter");
  await visibleFocus(button, check, "cross-page choose entry");
  await assertIdentity(directory, detail, templates, check, "cross-page new selection");
  check(
    "cross-page note clears on visible selection",
    await detail.locator(".org-approval-c-selection-note").count(),
    0,
  );
  const chosen = (await detail.locator("details code").textContent()).trim();
  const pager = directory.locator(".org-approval-pagination");
  for (const [label, target, noteCount] of [
    ["上一页", "1", 1],
    ["下一页", "2", 0],
  ]) {
    await pager.getByRole("button", { name: label, exact: true }).focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(
      (target) =>
        (new URL(location.href).searchParams.get("approval_template_page") || "1") === target,
      target,
    );
    check(
      "cross-page retained ID page " + target,
      (await detail.locator("details code").textContent()).trim(),
      chosen,
    );
    check(
      "cross-page note page " + target,
      await detail.locator(".org-approval-c-selection-note").count(),
      noteCount,
    );
    check(
      "cross-page visible selected count page " + target,
      await directory.locator(':scope > button[aria-pressed="true"]').count(),
      1 - noteCount,
    );
    if (target === "1") await shot("template-cross-page-retained", ".org-approval-template-detail");
  }
  check("cross-page navigation adds no API requests", requestCount(), count);
}
