import assert from "node:assert/strict";
import { openEnvelope } from "./open-review-fixtures.mjs";
export const openReadCases = [
  { key: "loading", hold: true },
  { key: "expired", status: 401, hint: "登录状态已失效，请重新登录后再读取。" },
  { key: "forbidden", status: 403, hint: "当前权限还不能读取这些内容。权限调整后，可以重新加载。" },
  { key: "rate_limited", status: 429, hint: "读取请求较多，请稍后再试。" },
  { key: "blocked", status: 503, hint: "开放平台服务暂时不可用，请稍后再试。" },
  { key: "error", status: 400, hint: "本次读取未能完成，请核对输入后重试。" },
  { key: "refreshing", hold: true, retained: true },
  {
    key: "retained-error",
    status: 503,
    retained: true,
    hint: "开放平台服务暂时不可用，请稍后再试。",
  },
  { key: "first-timeout", hold: true, timeout: true },
  { key: "retained-timeout", hold: true, timeout: true, retained: true },
];
export async function verifyOpenReadStates({ page, origin, fixture, requests, check, capture }) {
  let response = {},
    pending;
  const handler = async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    assert.equal(url.origin, origin);
    assert.equal(req.method(), "GET");
    requests.push({ key: "GET " + url.pathname, search: url.search, body: req.postData() });
    for (const prefix of ["client", "webhook", "delivery"])
      assert.equal(url.searchParams.get(prefix + "_page_size"), "20");
    if (response.hold) {
      pending = route;
      return;
    }
    if (response.status)
      return route.fulfill({
        status: response.status,
        json: {
          error: { code: response.key, action_hint: response.hint },
          request_id: "p60-read-" + response.key,
        },
      });
    return route.fulfill({ json: openEnvelope(structuredClone(fixture)) });
  };
  await page.route("**/api/v1/platform/open?**", handler);
  const surface = page.locator(".open-platform--review");
  const ready = () => surface.locator('.open-workspace[aria-busy="false"]').waitFor();
  try {
    for (const scene of openReadCases) {
      response = scene.retained ? {} : scene;
      pending = null;
      const start = requests.length;
      const attempts = (scene.retained ? 1 : 0) + ([429, 503].includes(scene.status) ? 3 : 1);
      await page.goto(origin + "/platform-admin/open-platform");
      if (scene.retained) {
        await ready();
        response = scene;
        await surface
          .locator(".open-workspace > header")
          .getByRole("button", { name: "刷新", exact: true })
          .click();
      }
      if (scene.hold) {
        await surface.locator(".open-org-filter button:disabled").waitFor();
        assert.ok(pending);
      }
      if (scene.timeout) {
        // Wait for the actual unchanged 15000ms application timer, not an accelerated replacement.
        await surface
          .getByText("读取超过 15 秒，已停止本次等待。", { exact: !scene.retained })
          .waitFor({ timeout: 20000 });
        await pending.abort();
        pending = null;
      } else if (!scene.hold) {
        if (scene.retained) await surface.locator(".open-notice").waitFor();
        else await surface.locator('.open-state[data-read-state="' + scene.key + '"]').waitFor();
      }
      const busy = !!scene.hold && !scene.timeout;
      const region = surface.locator(
        scene.retained ? (busy ? ".open-workspace" : ".open-notice") : ".open-state",
      );
      check(
        await surface.locator(".open-workspace").count(),
        scene.retained ? 1 : 0,
        scene.key + " record visibility",
      );
      check(
        await surface.locator(".open-summary").count(),
        scene.retained ? 1 : 0,
        "summary visibility",
      );
      check(
        await surface.locator(".open-org-filter button").isDisabled(),
        busy,
        "read busy availability",
      );
      check(requests.length - start, attempts, "unchanged HTTP retry count");
      check(
        await surface.locator(".open-notice").count(),
        scene.retained && !busy ? 1 : 0,
        "first failures have no duplicate banner",
      );
      if (scene.retained) {
        check(
          await surface.locator(".open-workspace").getAttribute("aria-busy"),
          String(busy),
          "retained workspace busy semantics",
        );
        check(
          (await surface.locator(".open-workspace").innerText()).includes("报表只读 Client"),
          true,
          "original row retained",
        );
        if (!busy)
          check(
            (await region.innerText()).includes("当前仍显示上次成功结果。"),
            true,
            "old snapshot explicitly identified",
          );
      } else {
        check(await region.getAttribute("aria-busy"), String(busy), "initial state busy semantics");
        check(
          await region.locator("h2#open-read-state-title").count(),
          1,
          "one named state heading",
        );
        check(await region.locator('p[role="status"]').count(), 1, "one live state message");
        check(
          (await region.innerText()).includes("上次成功"),
          false,
          "no imaginary first snapshot",
        );
        check(
          await region.getByRole("button", { name: "重试", exact: true }).count(),
          busy ? 0 : 1,
          "original retry availability retained",
        );
      }
      if (!busy) {
        const hint = scene.timeout ? "读取超过 15 秒，已停止本次等待。" : scene.hint;
        check(
          (await surface.innerText()).split(hint).length - 1,
          1,
          "failure explanation appears exactly once",
        );
        const details = region.locator("details");
        check(await details.count(), scene.timeout ? 0 : 1, "only actual request IDs shown");
        if (!scene.timeout) {
          await details.locator("summary").focus();
          await page.keyboard.press("Enter");
          check(await details.getAttribute("open"), "", "trace opens by keyboard");
          check(
            await details.locator("code").innerText(),
            "请求 ID：p60-read-" + scene.key,
            "trace belongs to this failure",
          );
        }
      }
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
        "no horizontal overflow",
      );
      if (!scene.retained) {
        check(
          await region.evaluate((node) => getComputedStyle(node).backgroundColor),
          "rgb(255, 255, 255)",
          "white state region",
        );
      }
      if (!scene.retained) {
        await region.evaluate((node) =>
          node.scrollIntoView({ block: "start", behavior: "instant" }),
        );
        check(
          await region.evaluate((node) => {
            const r = node.getBoundingClientRect();
            const x = r.x + r.width / 2,
              y = r.bottom - 4;
            return y < innerHeight && node.contains(document.elementFromPoint(x, y));
          }),
          true,
          "state bottom remains visible and is not covered by navigation",
        );
      }
      await capture(scene.key, region);
      response = {};
      if (busy) {
        await pending.fulfill({ json: openEnvelope(structuredClone(fixture)) });
        pending = null;
      } else
        await (
          scene.retained
            ? surface.locator(".open-org-filter button")
            : region.getByRole("button", { name: "重试", exact: true })
        ).click();
      await ready();
      check(await surface.locator(".open-state").count(), 0, "recovery removes initial state");
      check(await surface.locator(".open-notice").count(), 0, "recovery clears old failure");
      check(requests.length - start, attempts + (busy ? 0 : 1), "single recovery read");
    }
  } finally {
    if (pending) await pending.abort().catch(() => {});
    await page.unroute("**/api/v1/platform/open?**", handler);
  }
}
