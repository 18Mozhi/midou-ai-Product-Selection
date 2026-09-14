import { openDetailGroups } from "./open-detail-preview.mjs";

export const openDetailCases = [
  {
    key: "client-active",
    view: "clients",
    patch: {},
    actions: ["轮换密钥", "撤销账号"],
    main: true,
  },
  ...["expired", "revoked", "rotated"].map((status) => ({
    key: "client-" + status,
    view: "clients",
    patch: { status, ...(status === "expired" ? { expires_at: "2026-08-08T00:00:00Z" } : {}) },
    actions: [],
  })),
  {
    key: "webhook-active",
    view: "webhooks",
    patch: {},
    actions: ["停用回调", "发送测试", "轮换密钥"],
    main: true,
  },
  {
    key: "webhook-disabled",
    view: "webhooks",
    patch: { status: "disabled" },
    actions: ["启用回调", "轮换密钥"],
  },
  { key: "delivery-dead-letter", view: "deliveries", patch: {}, actions: ["重放"], main: true },
  {
    key: "delivery-queued",
    view: "deliveries",
    patch: { status: "queued", attempt_count: 0, response_status: null, last_error_code: null },
    actions: [],
  },
  {
    key: "delivery-leased",
    view: "deliveries",
    patch: { status: "leased", attempt_count: 1, response_status: null, last_error_code: null },
    actions: [],
  },
  {
    key: "delivery-retry",
    view: "deliveries",
    patch: { status: "retry_scheduled", attempt_count: 1 },
    actions: [],
  },
  {
    key: "delivery-succeeded",
    view: "deliveries",
    patch: { status: "succeeded", response_status: 204, last_error_code: null },
    actions: ["重放"],
  },
  {
    key: "webhook-long",
    view: "webhooks",
    patch: {
      name: "长名称回调 · ".repeat(8),
      target_url: "https://example.com/hooks/" + "long-path-segment/".repeat(12),
    },
    actions: ["停用回调", "发送测试", "轮换密钥"],
  },
];
export function openDetailSnapshot(fixture, scenario) {
  const result = structuredClone(fixture);
  Object.assign(result[scenario.view][0], scenario.patch);
  result.summary.clients.active = result.clients.filter((row) => row.status === "active").length;
  result.summary.clients.expired = result.clients.filter((row) => row.status === "expired").length;
  result.summary.webhooks.active = result.webhooks.filter((row) => row.status === "active").length;
  for (const status of ["dead_letter", "retry_scheduled"])
    result.summary.deliveries[status] = result.deliveries.filter(
      (row) => row.status === status,
    ).length;
  return result;
}
export async function verifyOpenDetails({
  page,
  origin,
  width,
  fixture,
  setFixture,
  check,
  capture,
}) {
  for (const scenario of openDetailCases) {
    setFixture(openDetailSnapshot(fixture, scenario));
    await page.goto(origin + "/platform-admin/open-platform?view=" + scenario.view);
    const surface = page.locator(".open-platform--review");
    await surface.locator(".open-workspace").waitFor();
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
      scenario.key + " page width",
    );
    if (width > 760) {
      const details = surface.locator(".responsive-data-view__desktop tbody details");
      const summary = details.locator("summary");
      await summary.focus();
      await page.keyboard.press("Space");
      check(await details.getAttribute("open"), "", scenario.key + " desktop keyboard expansion");
      check(
        await summary.evaluate((node) => getComputedStyle(node).display),
        "list-item",
        "desktop native marker",
      );
      check(
        await details.locator("code").innerText(),
        scenario.view === "clients"
          ? fixture.clients[0].client_prefix
          : scenario.view === "webhooks"
            ? fixture.webhooks[0].id
            : scenario.patch.last_error_code === null
              ? fixture.deliveries[0].id
              : fixture.deliveries[0].last_error_code,
        "desktop original technical fact",
      );
      check(
        await summary.evaluate((node) => getComputedStyle(node).outlineColor),
        "rgb(47, 110, 229)",
        "desktop blue focus",
      );
      check(
        await page.locator(".responsive-data-view__drawer").count(),
        0,
        "desktop retains inline disclosure",
      );
      if (scenario.main && width === 1440)
        await capture(scenario.key + "-desktop-technical", details);
      await page.keyboard.press("Space");
      check(await details.getAttribute("open"), null, "desktop keyboard collapse");
      continue;
    }
    const trigger = surface.locator(".responsive-data-view__mobile article > button");
    await trigger.click();
    const dialog = page.locator(".responsive-data-view__drawer");
    await dialog.waitFor();
    const close = dialog.getByRole("button", { name: "关闭详情", exact: true });
    const group = openDetailGroups.find((group) => group.view === scenario.view);
    check(
      await close.evaluate((node) => node === document.activeElement),
      true,
      scenario.key + " initial close focus",
    );
    check(await page.locator("#app").evaluate((node) => node.inert), true, "background inert");
    check(
      await dialog.locator(".p60-detail-section h3").allTextContents(),
      group.groups,
      "task sections",
    );
    check(
      await dialog.locator(".p60-detail-section dt").allTextContents(),
      group.fields,
      "original fact labels",
    );
    check(
      await dialog
        .locator(".p60-detail-actions button")
        .allTextContents()
        .then((values) => values.map((value) => value.trim())),
      scenario.actions,
      "exact action availability",
    );
    check(
      await dialog.getAttribute("aria-label"),
      scenario.patch.name ||
        (scenario.view === "deliveries"
          ? fixture.deliveries[0].endpoint_name
          : fixture[scenario.view][0].name),
      "complete accessible record name",
    );
    check(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
      true,
      "no horizontal clipping",
    );
    check(
      await dialog
        .locator(":scope > header")
        .evaluate((node) => getComputedStyle(node).backgroundColor),
      "rgb(16, 42, 99)",
      "C blue title region",
    );
    check(
      await dialog.evaluate((node) => getComputedStyle(node).backgroundColor),
      "rgb(255, 255, 255)",
      "C white facts",
    );
    if (scenario.main && width === 390) await capture(scenario.key + "-facts", dialog);
    const technical = dialog.locator(".responsive-data-view__details > details");
    const summary = technical.locator("summary");
    await close.focus();
    await page.keyboard.press("Tab");
    check(
      await summary.evaluate(
        (node) => node === document.activeElement && node.matches(":focus-visible"),
      ),
      true,
      "real Tab reaches technical keyboard focus",
    );
    await page.keyboard.press("Space");
    check(await technical.getAttribute("open"), "", "technical keyboard expansion");
    const errorVisible = scenario.view === "deliveries" && scenario.patch.last_error_code !== null;
    check(
      await technical.locator("dt").allTextContents(),
      scenario.view === "deliveries" && !errorVisible
        ? group.technical.slice(0, 3)
        : group.technical,
      "technical field conditions",
    );
    check(
      await technical.evaluate((node) => getComputedStyle(node).backgroundColor),
      "rgb(243, 246, 250)",
      "technical gray surface",
    );
    check(
      await summary.evaluate((node) => getComputedStyle(node).display),
      "list-item",
      "native disclosure marker",
    );
    // Observe rendered keyboard state rather than treating the key event as a paint barrier.
    // A genuine focus loss or missing outline still fails after this bounded wait.
    await page.waitForFunction(
      () => {
        const node = document.querySelector(".responsive-data-view__details > details > summary");
        return (
          node === document.activeElement &&
          node.matches(":focus-visible") &&
          getComputedStyle(node).outlineColor === "rgb(47, 110, 229)"
        );
      },
      undefined,
      { timeout: 3000 },
    );
    const focusEvidence = await summary.evaluate((node) => ({
      active: node === document.activeElement,
      visible: node.matches(":focus-visible"),
      color: getComputedStyle(node).outlineColor,
      style: getComputedStyle(node).outlineStyle,
      transition: getComputedStyle(node).transition,
    }));
    check(
      focusEvidence.color,
      "rgb(47, 110, 229)",
      scenario.key + " technical blue keyboard focus " + JSON.stringify(focusEvidence),
    );
    if (scenario.key === "delivery-queued")
      check(
        await dialog
          .locator(".p60-detail-section dd")
          .allTextContents()
          .then((values) => values.map((value) => value.trim()).slice(1, 4)),
        ["等待投递", "0 次", "—"],
        "zero attempts and absent response retain original meaning",
      );
    if (scenario.key === "delivery-succeeded")
      check(
        await dialog.locator(".p60-detail-section dd").nth(3).innerText(),
        "204",
        "response status retained",
      );
    if (scenario.key === "webhook-long")
      check(
        await dialog.locator(".p60-detail-section dd").first().innerText(),
        scenario.patch.target_url,
        "full URL retained",
      );
    await summary.evaluate((node) => node.scrollIntoView({ block: "center" }));
    if (width === 390) await capture(scenario.key + "-technical", dialog);
    const last = scenario.actions.length
      ? dialog.locator(".p60-detail-actions button").last()
      : summary;
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    check(
      await last.evaluate((node) => node === document.activeElement),
      true,
      "reverse Tab remains in drawer",
    );
    await page.keyboard.press("Tab");
    check(
      await close.evaluate((node) => node === document.activeElement),
      true,
      "forward Tab wraps to close",
    );
    if (
      scenario.main ||
      scenario.key === "webhook-disabled" ||
      scenario.key === "delivery-succeeded"
    ) {
      for (const [index, label] of scenario.actions.entries()) {
        const action = dialog.getByRole("button", { name: label, exact: true });
        await action.click();
        const confirmation = page.getByRole("alertdialog");
        await confirmation.waitFor();
        const cancel = confirmation.getByRole("button", { name: "取消", exact: true });
        check(
          await cancel.evaluate((node) => node === document.activeElement),
          true,
          "row confirmation receives safe focus",
        );
        check(
          await page.locator(".responsive-data-view__overlay").evaluate((node) => node.inert),
          true,
          "drawer suspended",
        );
        check(
          await page.locator(".p60-create-dialog[open]").count(),
          0,
          "no unrelated creation input",
        );
        check(
          await confirmation.getByRole("button", { name: "确认执行", exact: true }).isDisabled(),
          label === "撤销账号",
          "original destructive acknowledgment gate",
        );
        if (scenario.main && width === 390)
          await capture(scenario.key + "-confirm-" + index, confirmation);
        await cancel.click();
        await page.waitForFunction(
          () => !document.querySelector(".responsive-data-view__overlay")?.inert,
        );
        check(await dialog.isVisible(), true, "cancel keeps detail");
        check(
          await action.evaluate((node) => node === document.activeElement),
          true,
          "cancel restores original action focus",
        );
      }
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    check(
      await trigger.evaluate((node) => node === document.activeElement),
      true,
      "Escape restores record",
    );
    check(await page.locator("#app").evaluate((node) => node.inert), false, "background released");
  }
}
