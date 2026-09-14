import assert from "node:assert/strict";
import { securityEnvelope } from "./security-review-fixtures.mjs";

export const securityReadStates = [
  { key: "loading", hold: true },
  { key: "expired", status: 401, hint: "登录状态已失效，请重新登录后再读取。" },
  { key: "forbidden", status: 403, hint: "当前权限无法读取此视图。" },
  { key: "rate_limited", status: 429, hint: "请求过于频繁，请稍后再试。" },
  { key: "blocked", status: 503, hint: "安全运营服务暂时不可用，请稍后重试。" },
  { key: "error", status: 400, hint: "本次安全运营读取未能完成，请重试。" },
  { key: "refreshing", retained: true, hold: true },
  {
    key: "retained-error",
    retained: true,
    status: 503,
    hint: "安全运营服务暂时不可用，请稍后重试。",
  },
];

export async function verifySecurityReadStates({
  page,
  origin,
  snapshot,
  check,
  requests,
  capture,
}) {
  let response, pending;
  const routeHandler = async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    assert.equal(url.origin, origin);
    assert.equal(req.method(), "GET");
    requests.push({ key: "GET " + url.pathname, search: url.search, body: req.postData() });
    assert.equal(url.searchParams.get("page_size"), "20");
    assert.equal(url.searchParams.get("token_page_size"), "20");
    if (response.hold) {
      pending = route;
      return;
    }
    if (response.status)
      return route.fulfill({
        status: response.status,
        json: {
          error: { code: response.key, action_hint: response.hint },
          request_id: "p59-local-" + response.key,
        },
      });
    return route.fulfill({ json: securityEnvelope(snapshot("events")) });
  };
  await page.route("**/api/v1/platform/security/operations?**", routeHandler);
  const surface = page.locator(".security-ops--review");
  const ready = () =>
    page.waitForFunction(
      () => document.querySelector(".security-grid")?.getAttribute("aria-busy") === "false",
    );
  try {
    for (const scene of securityReadStates) {
      response = scene.retained ? {} : scene;
      const startReads = requests.length;
      // Existing api-client retries 429/503 GETs three times at 0/150/400ms.
      const expectedReads = (scene.retained ? 1 : 0) + ([429, 503].includes(scene.status) ? 3 : 1);
      await page.goto(origin + "/platform-admin/security");
      if (scene.retained) {
        await ready();
        response = scene;
        await surface.getByRole("button", { name: "刷新数据", exact: true }).click();
      }
      const region = surface.locator(
        scene.retained ? ".p59-investigation" : ".platform-dashboard-state",
      );
      await region.waitFor();
      const settled = scene.hold
        ? surface.getByRole("button", { name: "正在刷新…", exact: true })
        : scene.retained
          ? surface.locator(".security-notice")
          : surface.locator(`.platform-dashboard-state[data-kind="${scene.key}"]`);
      await settled.waitFor();
      if (scene.hold) {
        await page.waitForFunction(
          () => document.querySelector(".security-hero-actions button")?.disabled === true,
        );
        assert.ok(pending, "request held by local fixture");
      }
      check(
        await surface.locator(".security-grid").count(),
        scene.retained ? 1 : 0,
        scene.key + " truthful record visibility",
      );
      check(
        await surface.locator(".security-kpis").count(),
        scene.retained ? 1 : 0,
        scene.key + " truthful summary visibility",
      );
      check(
        await surface
          .getByRole("button", { name: scene.hold ? "正在刷新…" : "刷新数据", exact: true })
          .isDisabled(),
        !!scene.hold,
        scene.key + " refresh disabled only while pending",
      );
      check(requests.length - startReads, expectedReads, scene.key + " read count before action");
      if (scene.retained) {
        check(
          await surface.locator(".security-grid").getAttribute("aria-busy"),
          String(!!scene.hold),
          "retained grid busy semantics",
        );
        check(
          (await surface.locator(".security-grid").textContent()).includes("登录失败"),
          true,
          "retained original row",
        );
        if (!scene.hold)
          check(
            (await surface.locator(".security-notice").textContent()).includes(
              "已保留上次成功数据",
            ),
            true,
            "retained failure explicitly identifies old data",
          );
        if (!scene.hold) {
          const contrast = await surface.locator(".security-notice").evaluate((node) => {
            const style = getComputedStyle(node);
            const luminance = (color) =>
              color
                .match(/[\d.]+/g)
                .slice(0, 3)
                .map(Number)
                .map((v) => v / 255)
                .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
                .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
            const values = [luminance(style.color), luminance(style.backgroundColor)].sort(
              (a, b) => b - a,
            );
            return {
              ratio: (values[0] + 0.05) / (values[1] + 0.05),
              color: style.color,
              background: style.backgroundColor,
            };
          });
          check(
            contrast.ratio >= 4.5,
            true,
            `retained failure text contrast ${JSON.stringify(contrast)}`,
          );
        }
      } else {
        check(
          await region.getAttribute("aria-busy"),
          String(!!scene.hold),
          "initial read busy semantics",
        );
        check(
          await region.locator('p[role="status"]').count(),
          1,
          "read message has a live status region",
        );
        if (scene.hold)
          check(
            (await region.textContent()).includes("检查 API 与 MySQL"),
            false,
            "pending read does not imply an infrastructure failure",
          );
        check(
          (await region.textContent()).includes("已保留上次成功数据"),
          false,
          "first read never claims a prior snapshot",
        );
        check(
          await region.getByRole("button", { name: "重新读取", exact: true }).count(),
          ["loading", "expired", "forbidden"].includes(scene.key) ? 0 : 1,
          "original retry availability",
        );
      }
      if (scene.status && !scene.retained) {
        const details = region.locator("details"),
          summary = details.locator("summary");
        await summary.focus();
        await page.keyboard.press("Enter");
        check(await details.evaluate((node) => node.open), true, "trace expands by keyboard");
        check(
          (await details.textContent()).includes("p59-local-" + scene.key),
          true,
          "trace belongs to this local failure",
        );
      }
      if (!scene.hold && !["expired", "forbidden"].includes(scene.key)) {
        const button = scene.retained
          ? surface.getByRole("button", { name: "刷新数据", exact: true })
          : region.getByRole("button", { name: "重新读取", exact: true });
        await button.focus();
        // Native keyboard modality, then restore the exact action before the next-frame capture.
        await page.keyboard.press("Shift");
        await page.waitForFunction(
          () => document.activeElement?.matches(":focus-visible"),
          undefined,
          { timeout: 3000 },
        );
      }
      await page.evaluate(() => document.fonts.ready);
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
        scene.key + " no horizontal overflow",
      );
      await capture(scene.key, region);
      response = {};
      if (scene.hold) {
        await pending.fulfill({ json: securityEnvelope(snapshot("events")) });
        pending = null;
      } else {
        await surface
          .getByRole("button", {
            name:
              scene.retained || ["expired", "forbidden"].includes(scene.key)
                ? "刷新数据"
                : "重新读取",
            exact: true,
          })
          .click();
      }
      await ready();
      check(
        await surface.locator(".platform-dashboard-state").count(),
        0,
        "recovery removes initial state",
      );
      check(
        await surface.locator(".security-notice").count(),
        0,
        "recovery removes old failure notice",
      );
      check(
        requests.length - startReads,
        expectedReads + (scene.hold ? 0 : 1),
        "recovery has no duplicate read",
      );
    }
  } finally {
    if (pending) await pending.abort().catch(() => {});
    await page.unroute("**/api/v1/platform/security/operations?**", routeHandler);
  }
}
