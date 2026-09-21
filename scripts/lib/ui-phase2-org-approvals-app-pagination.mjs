import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const driverHash = "01db5a52a7073d15d9964b0fad8b451f9da44bf1725a51bfea84e3d677666907";
export function buildApprovalsAppPaginationRunner(source) {
  let runner = source.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(runner).digest("hex"),
    driverHash,
    "Inspect original P34 App driver drift",
  );
  const replace = (before, after) => {
    assert.equal(runner.split(before).length, 2, `Inspect App pagination anchor: ${before}`);
    runner = runner.replace(before, after);
  };
  replace(
    'import assert from "node:assert/strict";',
    'import assert from "node:assert/strict";\nimport { verifyAppPaginationFocus } from "./lib/ui-phase2-org-approvals-app-pagination.mjs";',
  );
  replace(
    'output = "output/playwright/p34-approvals-vue-c-r4";',
    'output = "output/playwright/p34-pagination-app-c-r3";',
  );
  replace('kind: "P34-ACTUAL-VUE-C-r4",', 'kind: "P34-PAGINATION-ACTUAL-APP-C-r3",');
  replace(
    '  "scripts/verify-ui-phase2-org-approvals-vue-c.mjs",',
    '  "scripts/verify-ui-phase2-org-approvals-vue-c.mjs",\n  "scripts/verify-ui-phase2-org-approvals-pagination-app.mjs",\n  "scripts/lib/ui-phase2-org-approvals-app-pagination.mjs",',
  );
  replace(
    "const fixture = await buildShellOrgFixture(),",
    'assert.equal(replacements.get(approvalsVueFile).split("</script>")[0], originals.get(approvalsVueFile).split("</script>")[0], "C preview must retain the entire current child script");\nconst fixture = await buildShellOrgFixture(),',
  );
  replace(
    '        await shot("requests-default");',
    `        if (mode === "review") {
          for (const [selector,property,expected] of [
            [".org-approval-request-list","columnGap","24px"],
            [".org-approval-request-list header span","color","rgb(37, 74, 156)"],
            [".org-approval-request-list header span","whiteSpace","normal"],
            [".org-approval-request-list dl > div","backgroundColor","rgba(0, 0, 0, 0)"],
            [".org-approval-request-list dl > div","borderLeftWidth","0px"],
            [".org-approval-request-list dd","whiteSpace","normal"],
          ]) check("C request card " + property + selector, await panel.locator(selector).first().evaluate((el,key)=>getComputedStyle(el)[key],property),expected);
        }
        await shot("requests-default");`,
  );
  replace(
    '        await nav.getByRole("button", { name: /模板版本/ }).focus();',
    '        await verifyAppPaginationFocus({ page, pager: panel.locator(".org-approval-pagination"), check, shot, mode, name: "requests", queryKey: "approval_request_page", requestCount: () => requests.length });\n        await nav.getByRole("button", { name: /模板版本/ }).focus();',
  );
  replace(
    '          await shot("cross-page-selection", ".org-approval-template-browser");',
    '          await verifyAppPaginationFocus({ page, pager: directory.locator(".org-approval-pagination"), check, shot, mode, name: "templates", queryKey: "approval_template_page", requestCount: () => requests.length });\n          await shot("cross-page-selection", ".org-approval-template-browser");',
  );
  return runner;
}

export async function verifyAppPaginationFocus({
  page,
  pager,
  check,
  shot,
  mode,
  name,
  queryKey,
  requestCount,
}) {
  const beforeRequests = requestCount();
  const status = pager.locator(":scope > span");
  const previous = pager.getByRole("button", { name: "上一页", exact: true });
  const next = pager.getByRole("button", { name: "下一页", exact: true });
  for (const edge of ["first", "last"]) {
    const trigger = edge === "first" ? previous : next;
    await trigger.focus();
    await trigger.press(edge === "first" ? "Enter" : "Space");
    await page.waitForFunction(
      ([key, target]) => (new URL(location.href).searchParams.get(key) || "1") === target,
      [queryKey, edge === "first" ? "1" : "2"],
    );
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    check(`${name}/${edge}: boundary trigger disabled`, await trigger.isDisabled());
    check(
      `${name}/${edge}: focus remains at owning status`,
      await status.evaluate((el) => el === document.activeElement),
    );
    check(
      `${name}/${edge}: status semantics`,
      await status.evaluate((el) => [
        el.getAttribute("role"),
        el.getAttribute("aria-live"),
        el.getAttribute("aria-atomic"),
      ]),
      ["status", "polite", "true"],
    );
    // Before screenshot framing or any scroll helper: focus must actually be visible to the user.
    check(
      `${name}/${edge}: focused status inside viewport`,
      await status.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
      }),
    );
    check(
      `${name}/${edge}: focus is not covered`,
      await status.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    );
    if (mode === "review") {
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".org-approval-pagination > span"))
            .outlineColor === "rgb(77, 121, 255)",
        undefined,
        { timeout: 3000 },
      );
      check(
        `${name}/${edge}: C focus color`,
        await status.evaluate((el) => getComputedStyle(el).outlineColor),
        "rgb(77, 121, 255)",
      );
    }
    await shot(`${name}-pagination-${edge}-focus`, ".org-approval-pagination");
    await page.keyboard.press("Tab");
    check(
      `${name}/${edge}: next Tab reaches enabled pager`,
      await (edge === "first" ? next : previous).evaluate((el) => el === document.activeElement),
    );
  }
  check(`${name}: local pagination adds no requests`, requestCount(), beforeRequests);
}
