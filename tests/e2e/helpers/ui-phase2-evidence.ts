import { type Page, type TestInfo } from "@playwright/test";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
  pageId: "P17" | "P31" | "P54" | "P55" | "P56" | "P61",
  state: string,
  assertions: string[],
) {
  if (process.env.SCOUTOPS_UI_PHASE2_CAPTURE !== "1") return;
  if (!/^[a-z][a-z0-9-]*$/.test(state)) throw new Error("Invalid evidence state");
  const url = new URL(page.url());
  const expectedPath = {
    P17: "/opportunities/scoring-rules",
    P31: "/org-admin/roles",
    P54: "/platform-admin/data",
    P55: "/platform-admin/governance",
    P56: "/platform-admin/content",
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
  const qualityP54 = pageId === "P54" && state.startsWith("quality-");
  const outputRelative =
      pageId === "P55" || pageId === "P56"
        ? `design/${pageId === "P55" ? "governance" : "content"}-direction-c/vue-implementation`
        : pageId === "P54"
          ? qualityP54
            ? "design/data-quality-direction-c/vue-implementation"
            : "design/data-records-direction-c/vue-implementation"
          : "runtime/representatives",
    output = path.join(root, outputRelative);
  const hash = (content: string | Buffer) =>
    createHash("sha256")
      .update(typeof content === "string" ? content.replace(/\r\n/g, "\n") : content)
      .digest("hex");
  try {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    // W00 records existing layout defects; it is not a visual-acceptance gate.
    // Preserve measurements rather than suppressing a defective baseline screenshot.
    const layout = await page.evaluate(() => ({
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      overflowingElements: Array.from(document.querySelectorAll("main *"))
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          return node.getClientRects().length && rect.right > innerWidth + 1;
        })
        .slice(0, 12)
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          className: node.getAttribute("class") ?? "",
          width: Math.round(node.getBoundingClientRect().width),
          right: Math.round(node.getBoundingClientRect().right),
        })),
    }));
    const dialog = (await page.locator('dialog[open], [role="alertdialog"]').count()) > 0;
    const focusedMobileViewport =
      (pageId === "P54" || pageId === "P55" || pageId === "P56") && viewport.width === 390;
    if (!dialog) {
      if (focusedMobileViewport)
        await page.evaluate(
          ({ selector, offset }) => {
            const target = document.querySelector(selector);
            if (!target) throw new Error(`Missing capture target: ${selector}`);
            const top = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo(0, Math.max(0, top));
          },
          pageId === "P56"
            ? state === "content-default"
              ? { selector: ".platform-content__hero", offset: 58 }
              : state === "content-records"
                ? { selector: ".responsive-data-view__mobile", offset: 138 }
                : state === "content-filtered-empty"
                  ? { selector: ".platform-content__ledger", offset: 58 }
                  : state === "content-forbidden"
                    ? { selector: ".platform-content__first-state", offset: 58 }
                    : { selector: ".platform-content__surface", offset: 58 }
            : pageId === "P55"
              ? state === "governance-directory"
                ? { selector: ".governance-directory", offset: 58 }
                : state === "governance-default"
                  ? { selector: ".governance-hero", offset: 58 }
                  : state === "governance-forbidden"
                    ? { selector: ".governance-state", offset: 58 }
                    : { selector: ".governance-context", offset: 58 }
              : qualityP54
                ? state.includes("unknown")
                  ? { selector: ".quality-feedback", offset: 110 }
                  : state === "quality-default"
                    ? { selector: ".quality-title", offset: 58 }
                    : { selector: ".quality-task", offset: 58 }
                : state.includes("unknown")
                  ? { selector: ".platform-data-feedback", offset: 110 }
                  : { selector: ".platform-data-hero", offset: 58 },
        );
      else await page.evaluate(() => window.scrollTo(0, 0));
    }
    await mkdir(output, { recursive: true });
    const fullPage = !dialog && !focusedMobileViewport;
    await page.screenshot({
      path: path.join(output, `${filename}.png`),
      fullPage,
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
            insideDialog: Boolean(node.closest('dialog[open], [role="alertdialog"]')),
          })),
      );
    const baseline = JSON.parse(await readFile(path.join(root, "baseline.json"), "utf8"));
    const stylesheets: Record<string, string> = {};
    for (const relative of (await readdir("apps/web/src", { recursive: true })).sort()) {
      if (!relative.endsWith(".css")) continue;
      const source = `apps/web/src/${relative.split(path.sep).join("/")}`;
      stylesheets[source] = hash(await readFile(source, "utf8"));
    }
    const sourceFiles: Record<string, string> = {};
    if (pageId === "P54") {
      const p54Sources = qualityP54
        ? [
            "apps/web/src/components/PlatformDataCenter.vue",
            "apps/web/src/components/DataQualityCenter.vue",
            "apps/web/src/components/ResponsiveDataView.vue",
            "apps/web/src/components/ConfirmDialog.vue",
            "apps/web/src/components/TechnicalDetails.vue",
            "apps/web/src/use-modal-dialog.ts",
          ]
        : [
            "apps/web/src/components/PlatformDataCenter.vue",
            "apps/web/src/components/ResponsiveDataView.vue",
            "apps/web/src/components/AuditedReasonDialog.vue",
          ];
      for (const source of p54Sources) {
        sourceFiles[source] = hash(await readFile(source, "utf8"));
      }
    }
    if (pageId === "P55") {
      for (const source of [
        "apps/web/src/components/PlatformGovernanceCenter.vue",
        "apps/web/src/components/ResponsiveDataView.vue",
        "apps/web/src/components/ResponsiveFilterDrawer.vue",
        "apps/web/src/components/TableViewControls.vue",
        "apps/web/src/components/TechnicalDetails.vue",
        "apps/web/src/use-modal-dialog.ts",
        "apps/web/src/platform-governance.css",
      ]) {
        sourceFiles[source] = hash(await readFile(source, "utf8"));
      }
    }
    if (pageId === "P56") {
      for (const source of [
        "apps/web/src/components/PlatformContentCenter.vue",
        "apps/web/src/components/PlatformContentReviewDialog.vue",
        "apps/web/src/components/PlatformManagementRecordList.vue",
        "apps/web/src/components/ResponsiveDataView.vue",
        "apps/web/src/components/ResponsiveFilterDrawer.vue",
        "apps/web/src/components/use-platform-content-list.ts",
        "apps/web/src/components/use-platform-content-review.ts",
        "apps/web/src/use-modal-dialog.ts",
        "apps/web/src/platform-content.css",
      ]) {
        sourceFiles[source] = hash(await readFile(source, "utf8"));
      }
    }
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
          fullPage,
          file: `${outputRelative}/${filename}.png`,
          sha256: hash(await readFile(path.join(output, `${filename}.png`))),
          sourceFingerprint: baseline.sourceFingerprint,
          sourceRevision: baseline.sourceRevision,
          testFile: path.relative(process.cwd(), testInfo.file).split(path.sep).join("/"),
          testFileSha256: hash(await readFile(testInfo.file, "utf8")),
          captureHelperSha256: hash(
            await readFile("tests/e2e/helpers/ui-phase2-evidence.ts", "utf8"),
          ),
          sourceFiles,
          stylesheets,
          testTitle: testInfo.title,
          browser: "chromium",
          os: process.platform,
          capturedAt: new Date().toISOString(),
          assertions,
          controls,
          pageOverflow: layout.documentWidth > layout.viewportWidth,
          layout,
          visualAcceptance: "not-evaluated-baseline-only",
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
