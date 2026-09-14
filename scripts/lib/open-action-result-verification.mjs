import assert from "node:assert/strict";
import { openEnvelope } from "./open-review-fixtures.mjs";

export async function verifyOpenActionResults({
  page,
  origin,
  width,
  fixture,
  requests,
  check,
  capture: captureImage,
  keyboard = false,
}) {
  const capture = async (view, region) => {
    await region.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
    check(
      await region.evaluate((node) => {
        const r = node.getBoundingClientRect(),
          x = r.x + r.width / 2;
        return [r.top + 4, r.bottom - 4].every(
          (y) => y >= 0 && y < innerHeight && node.contains(document.elementFromPoint(x, y)),
        );
      }),
      true,
      "feedback region top and bottom are not covered by navigation",
    );
    await captureImage(view, region);
  };
  for (const scene of [
    "saved-read-failed",
    "queued-read-failed",
    "saved-read-ready",
    "write-failed",
    ...(keyboard ? ["long-read-failed"] : []),
  ]) {
    let written = false,
      failedRead = scene.endsWith("failed"),
      pending,
      hold = true;
    const reads = [],
      writes = [];
    const queued = scene.startsWith("queued");
    const failureHint =
      "本次列表暂时无法读取，请稍后重试。" +
      (scene === "long-read-failed"
        ? "连接恢复后可重新读取列表，无需重复执行已成功的操作。".repeat(4)
        : "");
    const readId = keyboard ? "00000000-0000-4000-8000-000000000628" : "local-read-failed";
    const expectedPath = "/api/v1/platform/open/webhooks/w1" + (queued ? "/test" : "");
    const updated = structuredClone(fixture);
    if (!queued) {
      updated.webhooks[0].status = "disabled";
      updated.webhooks[0].version = 2;
      updated.summary.webhooks.active = 0;
    }
    const failure = () => ({
      status: 503,
      json: {
        error: { code: "local_read_blocked", action_hint: failureHint },
        request_id: readId,
      },
    });
    const handler = async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      assert.equal(url.origin, origin);
      requests.push({
        key: req.method() + " " + url.pathname,
        search: url.search,
        body: req.postData(),
      });
      if (req.method() === "GET") {
        assert.equal(url.pathname, "/api/v1/platform/open");
        reads.push(req.url());
        if (written && hold) {
          pending = route;
          hold = false;
          return;
        }
        return route.fulfill(
          written && failedRead ? failure() : { json: openEnvelope(written ? updated : fixture) },
        );
      }
      assert.equal(url.pathname, expectedPath);
      assert.equal(req.method(), queued ? "POST" : "PATCH");
      assert.ok(req.headers()["idempotency-key"]);
      writes.push(req.postDataJSON());
      assert.equal(writes.length, 1, "no duplicated mutation");
      assert.equal(writes[0].reason, "开放平台配置变更");
      if (!queued)
        assert.deepEqual(writes[0], {
          name: fixture.webhooks[0].name,
          target_url: fixture.webhooks[0].target_url,
          events: fixture.webhooks[0].events,
          status: "disabled",
          expected_version: 1,
          reason: "开放平台配置变更",
        });
      if (scene === "write-failed")
        return route.fulfill({
          status: 409,
          json: {
            error: { code: "local_conflict", action_hint: "记录已更新，请重新读取后核对。" },
            request_id: "local-write-failed",
          },
        });
      written = true;
      return route.fulfill({
        status: queued ? 202 : 200,
        json: {
          ...openEnvelope(queued ? { status: "queued" } : updated.webhooks[0]),
          request_id: "local-write-ok",
        },
      });
    };
    await page.route("**/api/v1/platform/open**", handler);
    try {
      await page.goto(origin + "/platform-admin/open-platform?view=webhooks");
      const surface = page.locator(".open-platform--review");
      await surface.locator('.open-workspace[aria-busy="false"]').waitFor();
      if (width <= 760) {
        await surface.locator(".responsive-data-view__mobile article > button").click();
        await page
          .locator(".responsive-data-view__drawer")
          .getByRole("button", { name: queued ? "发送测试" : "停用回调", exact: true })
          .click();
      } else
        await surface.getByRole("button", { name: queued ? "测试" : "停用", exact: true }).click();
      const confirmation = page.getByRole("alertdialog");
      await confirmation.waitFor();
      await confirmation.getByRole("button", { name: "确认执行", exact: true }).click();
      if (width <= 760)
        await page
          .locator(".responsive-data-view__drawer")
          .getByRole("button", { name: "关闭详情", exact: true })
          .click();
      const result = surface.locator(".open-action-result"),
        readNotice = surface.locator(".open-notice:not(.open-action-result)");
      if (scene === "write-failed") {
        await readNotice.getByText("记录已更新，请重新读取后核对。", { exact: false }).waitFor();
        check(await result.count(), 0, "write failure is not a success result");
        check(reads.length, 1, "failed write does not reread");
        await capture(scene, readNotice);
      } else {
        await result.getByText("列表正在刷新…", { exact: true }).waitFor();
        check(
          await result.getByRole("button", { name: "读取中…", exact: true }).isDisabled(),
          true,
          "pending reread disabled",
        );
        check(await result.getAttribute("role"), "status", "persistent action result announcement");
        await result.getByText("本次操作追踪", { exact: true }).focus();
        await page.keyboard.press("Enter");
        check(
          await result.locator("code").innerText(),
          "请求 ID：local-write-ok",
          "write ID retained separately",
        );
        if (scene === "saved-read-failed") await capture("saved-read-pending", result);
        assert.ok(pending);
        await pending.fulfill(failedRead ? failure() : { json: openEnvelope(updated) });
        pending = null;
        await surface.locator('.open-workspace[aria-busy="false"]').waitFor();
        check(
          (await result.innerText()).includes(
            queued ? "已进入真实投递队列" : "操作成功并已写入审计",
          ),
          true,
          "original outcome meaning preserved",
        );
        if (failedRead) {
          await readNotice.getByText("本次列表暂时无法读取", { exact: false }).waitFor();
          check(reads.length, 4, "initial GET plus original three failed attempts");
          check(
            await result.getByRole("button", { name: "重新读取列表", exact: true }).isEnabled(),
            true,
            "GET recovery available",
          );
          await readNotice.locator("summary").focus();
          await page.keyboard.press("Enter");
          check(
            await readNotice.locator("code").innerText(),
            "请求 ID：" + readId,
            "read failure ID is not overwritten",
          );
          await capture(scene + "-operation", result);
          await capture(scene + "-read", readNotice);
          failedRead = false;
          const retry = result.getByRole("button");
          if (keyboard) {
            check(
              (await readNotice.innerText()).includes(failureHint),
              true,
              "complete long failure hint retained",
            );
            check(
              await readNotice.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
              true,
              "failure region does not overflow",
            );
            hold = true;
            await result.locator("summary").focus();
            await page.keyboard.press("Tab");
            check(
              await retry.evaluate((n) => n === document.activeElement),
              true,
              "Tab reaches recovery button",
            );
            await page.keyboard.press("Enter");
            await result.getByText("列表正在刷新…", { exact: true }).waitFor();
            check(
              await retry.evaluate((n) => n === document.activeElement),
              true,
              "busy recovery keeps keyboard focus",
            );
            await page.waitForFunction(
              () => {
                const button = document.querySelector(".open-action-reread");
                const style = button && getComputedStyle(button);
                return (
                  button?.matches(":focus-visible") &&
                  style.backgroundColor === "rgb(233, 238, 245)" &&
                  style.outlineColor === "rgb(47, 110, 229)"
                );
              },
              null,
              { timeout: 3000 },
            );
            check(
              await retry.evaluate((n) => ({
                nativeDisabled: n.disabled,
                ariaDisabled: n.getAttribute("aria-disabled"),
                color: getComputedStyle(n).color,
              })),
              { nativeDisabled: false, ariaDisabled: "true", color: "rgb(100, 116, 139)" },
              "busy gray appearance and focusable disabled semantics",
            );
            await page.keyboard.press("Enter");
            await page.keyboard.press("Space");
            check(reads.length, 5, "busy keyboard activation does not duplicate GET");
            check(writes.length, 1, "busy keyboard activation does not duplicate mutation");
            await capture(scene + "-keyboard-busy", result);
            assert.ok(pending);
            await pending.fulfill({ json: openEnvelope(updated) });
            pending = null;
          } else await retry.click();
          await result.getByText("当前列表已刷新。", { exact: true }).waitFor();
          if (keyboard) {
            check(
              await retry.evaluate((n) => n === document.activeElement),
              true,
              "settled recovery keeps keyboard focus",
            );
            await capture(scene + "-keyboard-ready", result);
          }
          check(reads.length, 5, "one recovery GET");
          check(await readNotice.count(), 0, "read failure cleared after recovery");
        } else {
          check(reads.length, 2, "successful write single refresh");
          await result.getByText("当前列表已刷新。", { exact: true }).waitFor();
        }
        check(
          await result.locator("code").innerText(),
          "请求 ID：local-write-ok",
          "recovery does not replace write trace",
        );
        check(
          await result.getByRole("button").count(),
          1,
          "stable read-only button after successful refresh",
        );
        if (scene === "saved-read-ready") await capture(scene, result);
      }
      check(writes.length, 1, "one intercepted mutation only");
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
        "no horizontal overflow",
      );
    } finally {
      if (pending) await pending.abort().catch(() => {});
      await page.unroute("**/api/v1/platform/open**", handler);
    }
  }
}
