import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export const approvalsParentBase = "scripts/verify-ui-phase2-org-approvals-parent.mjs";
export const approvalsParentBaseHash =
  "eff13338e7fd7ebf581ef682a7abcd99789a2d62108d783f66a916fd8d901944";
export const approvalsParentOutput = "output/playwright/p34-parent-current-c-r3";

const imports = `
import { previewShellVue, shellReviewCss, shellReviewModule } from "./lib/ui-phase2-shell-vue-preview.mjs";
import { approvalsVueFile, approvalsVueCss, previewApprovalsVue } from "./lib/ui-phase2-org-approvals-vue-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
import { approvalsParentFile, approvalsParentFrameCss, previewApprovalsParentFrame } from "./lib/ui-phase2-org-approvals-parent-frame-preview.mjs";
const localRead = async (file) => (await readFile(file, "utf8")).replaceAll("\\r\\n", "\\n");
const sourceOriginals = new Map(await Promise.all([
  "apps/web/src/components/NavigationShell.vue", approvalsVueFile, approvalsParentFile,
].map(async (file) => [file, await localRead(file)])));
const sourceRevisions = new Map([
  ["apps/web/src/components/NavigationShell.vue", previewShellVue(sourceOriginals.get("apps/web/src/components/NavigationShell.vue"))],
  [approvalsVueFile, previewApprovalsVue(sourceOriginals.get(approvalsVueFile))],
  [approvalsParentFile, previewApprovalsParentFrame(sourceOriginals.get(approvalsParentFile))],
]);
`;

const plugin = `
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [{
    name: "p34-current-parent-c-review", enforce: "pre",
    transform(text, id) {
      const file = path.relative(process.cwd(), id).replaceAll("\\\\", "/");
      if (!sourceRevisions.has(file)) return null;
      assert.equal(text.replaceAll("\\r\\n", "\\n"), sourceOriginals.get(file));
      return { code: sourceRevisions.get(file), map: null };
    },
    transformIndexHtml(html) {
      return html.replace("<body>", '<body class="shell-vue-c approvals-vue-c">')
        .replace("</head>", [shellReviewCss, approvalsVueCss, approvalsParentFrameCss].map((f) =>
          '<link rel="stylesheet" href="/@fs/' + path.resolve(f).replaceAll("\\\\", "/") + '">'
        ).join("") + "</head>");
    },
  }],`;

const close = `
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    const file = module.file && path.relative(process.cwd(), module.file).replaceAll("\\\\", "/");
    if (file && !file.startsWith("..") && !file.includes("node_modules") && /\\.(vue|ts|css|json)$/.test(file))
      currentSources.add(file);
  }
  await server.close();
}
await includeImportedStyleSources(currentSources, (file) => file.startsWith("apps/web/src/") ? localRead(file) : "");
sourceHashes = Object.fromEntries(await Promise.all([...currentSources].sort().map(async (file) => [file, hash(await localRead(file))])));
`;

export const approvalsParentCurrentEdits = [
  [
    "      const shot = async (scene) => {",
    `      const shot = async (scene) => {
        await page.waitForFunction(() => {
          const hero = document.querySelector(".org-admin-hero"), button = hero?.querySelector("button");
          if (!hero || !button) return false;
          return getComputedStyle(hero).backgroundImage === "none" && getComputedStyle(hero).borderTopWidth === "0px" &&
            getComputedStyle(button).backgroundColor === (button.disabled ? "rgb(232, 237, 244)" : "rgb(37, 74, 156)");
        });
        check(scene + ": C parent header survives child state", await center.getAttribute("data-approval-c-view"), "true");`,
  ],
  [
    '      check("no business dialogs fabricated", await page.locator("dialog[open]").count(), 0);',
    `
      check("no business dialogs fabricated", await page.locator("dialog[open]:not(.role-navigation-frame)").count(), 0);
      check("only desktop navigation container remains open", await page.locator('dialog.role-navigation-frame[open][aria-label="工作台导航"]').count(), width > 840 ? 1 : 0);
      check("no unexpected modal blocks content", await page.locator("dialog:modal").count(), 0);`,
  ],
  [
    '      await shot("ready");',
    `
      const viewButtons = child.locator(".org-approval-section-tabs button");
      check("current C child template active", await child.evaluate((n) => n.classList.contains("org-approval-c-workbench")));
      check("current C directory is blue", await child.locator(".org-approval-section-tabs").evaluate((n) => getComputedStyle(n).backgroundColor), "rgb(37, 74, 156)");
      await viewButtons.first().focus();
      await page.keyboard.press("Tab");
      const focusState = await viewButtons.nth(1).evaluate((n) => {
        const s = getComputedStyle(n);
        return { selected: n.getAttribute("aria-pressed"), background: s.backgroundColor, outline: s.outlineColor, outlineWidth: s.outlineWidth, outlineOffset: s.outlineOffset };
      });
      focusStates.push({ width, ...focusState });
      console.log(JSON.stringify({ width, focusState }));
      check("selected C view is keyboard focused", await viewButtons.nth(1).evaluate((n) =>
        n === document.activeElement && n.matches(":focus-visible")));
      check("selected C view focus contrasts with selected background", await viewButtons.nth(1).evaluate((n) => {
        const s = getComputedStyle(n);
        const luminance = (color) => color.match(/[\\d.]+/g).slice(0, 3).map(Number).map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
        const a = luminance(s.outlineColor), b = luminance(s.backgroundColor);
        return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 3 && (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 3;
      }));
      check("selected C view focus target is visible and unobscured", await viewButtons.nth(1).evaluate((n) => {
        const r = n.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth + 1 && (hit === n || n.contains(hit));
      }));
      await shot("ready");`,
  ],
  [
    'const capture = process.argv.includes("--capture"),',
    imports +
      '\nassert.ok(process.argv.slice(2).length <= 1, "One option only");\nconst capture = process.argv.includes("--capture"),',
  ],
  [
    'const output = "output/playwright/p34-parent-read-states";',
    `const output = "${approvalsParentOutput}";`,
  ],
  ["const sourceHashes = Object.fromEntries(", "let sourceHashes = Object.fromEntries("],
  ["let previous;\nif (!capture && !smoke) {", "let previous;\nif (false) {"],
  [
    "if (capture) await mkdir(output, { recursive: true });",
    `if (capture) await mkdir(output);
const currentSources = new Set([...sources,
  "scripts/verify-ui-phase2-org-approvals-parent-current.mjs",
  "scripts/lib/ui-phase2-org-approvals-parent-current-driver.mjs",
  "scripts/lib/ui-phase2-org-approvals-vue-preview.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "scripts/lib/ui-phase2-org-approvals-parent-frame-preview.mjs", approvalsParentFrameCss,
  "apps/api/src/mysql-organization-admin-repository.ts",
  "apps/api/src/organization-admin-service.ts",
  "docs/openapi.yaml", "apps/web/index.html", "apps/web/vite.config.ts",
  shellReviewCss, shellReviewModule, approvalsVueCss,
]);
const requestCounts = [], focusStates = [];`,
  ],
  ['  server: { host: "127.0.0.1", port, strictPort: true, open: false },', plugin],
  ["    const releases = [];", "    context.setDefaultTimeout(15000);\n    const releases = [];"],
  [
    '          bytes = await center.screenshot({ animations: "disabled" });',
    `          bytes = await (async () => {
            await page.evaluate(() => document.fonts.ready);
            const notice = center.locator(".org-admin-notice");
            const target = await notice.isVisible() ? notice : center.locator(".org-admin-hero");
            await target.evaluate((n) => scrollTo({ top: scrollY + n.getBoundingClientRect().top - 90, behavior: "instant" }));
            return page.screenshot({ animations: "disabled", fullPage: false });
          })();`,
  ],
  [
    '          pageId: "P34",',
    '          pageId: "P34",\n          viewport: page.viewportSize(),',
  ],
  [
    '          scope: "actual-app-parent-fixture-HTTP-not-production-or-C-approval",',
    '          scope: "current-C-composition-full-viewport-fixture-HTTP-not-production-or-approval",',
  ],
  [
    '      check("no business writes", writes, []);',
    '      requestCounts.push({ width, parentReads: reads.length, writes: writes.length });\n      check("no business writes", writes, []);',
  ],
  ["  await server.close();\n}", close],
  [
    '        kind: "P34-PARENT-READ-STATES",',
    `        kind: "P34-PARENT-CURRENT-C-r3",
        reviewOnly: true,
        approval: "pending",
        port,
        processesClosed: true,
        requestCounts,
        focusStates,
        transformedHashes: Object.fromEntries([...sourceRevisions].map(([file, source]) => [file, hash(source)])),`,
  ],
  ["else if (!smoke) {", "else if (false) {"],
  [
    "    browserAndServerClosed: true,",
    "    browserAndServerClosed: true,\n    port,\n    sources: Object.keys(sourceHashes).length,\n    requestCounts,",
  ],
];

export function approvalsParentCurrentDriver(input) {
  let source = input.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    approvalsParentBaseHash,
    "Inspect changed P34 original parent driver before composition",
  );
  for (const [before, after] of approvalsParentCurrentEdits) {
    assert.equal(source.split(before).length, 2, `One exact current-parent anchor: ${before}`);
    source = source.replace(before, after);
  }
  const ast = ts.createSourceFile(approvalsParentBase, source, ts.ScriptTarget.Latest, true);
  assert.deepEqual(ast.parseDiagnostics, []);
  for (const node of ast.statements.filter(ts.isImportDeclaration).reverse()) {
    const specifier = node.moduleSpecifier.text;
    const resolved = specifier.startsWith(".")
      ? pathToFileURL(path.resolve(path.dirname(approvalsParentBase), specifier)).href
      : import.meta.resolve(specifier);
    source =
      source.slice(0, node.moduleSpecifier.getStart(ast)) +
      JSON.stringify(resolved) +
      source.slice(node.moduleSpecifier.end);
  }
  return source;
}
