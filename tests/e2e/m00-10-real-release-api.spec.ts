import { expect, test } from "@playwright/test";

test("[real-api] release identity and readiness render together without interception", async ({
  page,
}) => {
  const readyResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/health/ready"),
  );
  const versionResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/health/version"),
  );

  await page.goto("/?view=deployment");
  const [ready, version] = await Promise.all([readyResponse, versionResponse]);
  expect(ready.status()).toBe(200);
  expect(version.status()).toBe(200);
  expect((await version.json()).data).toMatchObject({
    version: "playwright-e2e",
    build_sha: "0123456789abcdef0123456789abcdef01234567",
    config_fingerprint: "a".repeat(64),
  });
  await expect(page.getByTestId("deployment-healthy")).toBeVisible();

  const screenshot = await page.screenshot({ fullPage: true });
  expect(screenshot.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(screenshot.byteLength).toBeGreaterThan(10_000);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("deployment-healthy")).toBeVisible();
  const mobileScreenshot = await page.screenshot({ fullPage: true });
  expect(mobileScreenshot.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(mobileScreenshot.readUInt32BE(16)).toBe(390);
  expect(mobileScreenshot.byteLength).toBeGreaterThan(10_000);
});
