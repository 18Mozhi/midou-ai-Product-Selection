import { expect, test } from "@playwright/test";

test("[real-api] readiness renders from Fastify without interception and produces a valid PNG", async ({
  page,
}) => {
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/health/ready"),
  );
  await page.goto("/?view=api");
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["x-request-id"]).toBeTruthy();
  const body = await response.json();
  expect(body.data).toEqual({
    status: "ready",
    dependencies: { mysql: "available", redis: "available" },
  });
  await expect(page.getByTestId("api-ready")).toBeVisible();
  const screenshot = await page.screenshot({ fullPage: true });
  expect(screenshot.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(screenshot.readUInt32BE(16)).toBe(page.viewportSize()?.width);
  expect(screenshot.readUInt32BE(20)).toBeGreaterThan(300);
  expect(screenshot.byteLength).toBeGreaterThan(10_000);
});
