import { expect, type Page, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const capturedByTest = new Map<string, string[]>();

export async function finalizePhase2Evidence(testInfo: TestInfo) {
  for (const filename of capturedByTest.get(testInfo.testId) ?? []) {
    const record = JSON.parse(await readFile(filename, "utf8"));
    record.testStatus = testInfo.status;
    await writeFile(filename, JSON.stringify(record, null, 2) + "\n");
  }
  capturedByTest.delete(testInfo.testId);
}

// Opt-in, fixture-only evidence. Does not create or approve design/production coverage.
export async function capturePhase2Evidence(
  page: Page,
  testInfo: TestInfo,
  pageId: "P17" | "P31" | "P61",
  state: string,
  assertions: string[],
) {
  if (process.env.SCOUTOPS_UI_PHASE2_CAPTURE !== "1") return;
  if (!/^[a-z][a-z0-9-]*$/.test(state)) throw new Error("Invalid evidence state");
  const url = new URL(page.url());
  const expectedPath = {
    P17: "/opportunities/scoring-rules",
    P31: "/org-admin/roles",
    P61: "/platform-admin/status",
  }[pageId];
  if (url.hostname !== "127.0.0.1" || url.pathname !== expectedPath)
    throw new Error("Phase2 capture only accepts the explicit local fixture routes");
  const root = path.resolve("design-plans/ui-phase-2-2026-09-07");
  const originalViewport = page.viewportSize();
  const viewport =
    testInfo.project.name === "mobile-390"
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 };
  const filename = `${pageId}-${viewport.width}-${state}`;
  const output = path.join(root, "runtime/representatives");
  const hash = (content: string | Buffer) =>
    createHash("sha256")
      .update(typeof content === "string" ? content.replace(/\r\n/g, "\n") : content)
      .digest("hex");
  try {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    const dialog = (await page.locator("dialog[open]").count()) > 0;
    if (!dialog) await page.evaluate(() => window.scrollTo(0, 0));
    await mkdir(output, { recursive: true });
    await page.screenshot({
      path: path.join(output, `${filename}.png`),
      fullPage: !dialog,
      animations: "disabled",
    });
    const controls = await page
      .locator("button, a[href], summary, input, select, textarea")
      .evaluateAll((nodes) =>
        nodes
          .filter(
            (node) =>
              node.getClientRects().length && getComputedStyle(node).visibility !== "hidden",
          )
          .map((node) => ({
            tag: node.tagName.toLowerCase(),
            name: (
              node.getAttribute("aria-label") ||
              node.textContent ||
              node.getAttribute("placeholder") ||
              ""
            )
              .trim()
              .replace(/\s+/g, " ")
              .slice(0, 180),
            disabled: node.matches(":disabled"),
            insideDialog: Boolean(node.closest("dialog[open]")),
          })),
      );
    const baseline = JSON.parse(await readFile(path.join(root, "baseline.json"), "utf8"));
    await writeFile(
      path.join(output, `${filename}.json`),
      JSON.stringify(
        {
          schemaVersion: 1,
          testStatus: "pending-test-completion",
          kind: "vue-existing-e2e-fixture-baseline-not-production",
          pageId,
          state,
          concretePath: url.pathname,
          viewport,
          fullPage: !dialog,
          file: `runtime/representatives/${filename}.png`,
          sha256: hash(await readFile(path.join(output, `${filename}.png`))),
          sourceFingerprint: baseline.sourceFingerprint,
          sourceRevision: baseline.sourceRevision,
          testFile: path.relative(process.cwd(), testInfo.file).split(path.sep).join("/"),
          testFileSha256: hash(await readFile(testInfo.file, "utf8")),
          testTitle: testInfo.title,
          browser: "chromium",
          os: process.platform,
          capturedAt: new Date().toISOString(),
          assertions,
          controls,
          pageOverflow: false,
          userReview: "pending",
          limitations: [
            "Route fixtures simulate backend responses; no real DB or RBAC is proven.",
            "Assertions describe this case only, not every action/variant/role on the page.",
            "These are current Vue baselines, not approved redesign images.",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    capturedByTest.set(testInfo.testId, [
      ...(capturedByTest.get(testInfo.testId) ?? []),
      path.join(output, `${filename}.json`),
    ]);
  } finally {
    if (originalViewport) await page.setViewportSize(originalViewport);
  }
}
