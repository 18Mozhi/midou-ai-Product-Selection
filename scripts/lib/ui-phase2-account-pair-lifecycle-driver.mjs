import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export const originalAccountLifecycleDriver = "scripts/verify-ui-phase2-account-app-lifecycle.mjs";
export const originalAccountLifecycleHash =
  "ee649e31674d6fac6d4922aef07651b5c018504ee44771a40bf537bf14205ebd";
export const pairLifecycleOutput = "output/playwright/account-pair-c-lifecycle-r2";
export const pairLifecycleImport =
  'import { accountPairLifecyclePreview } from "./lib/ui-phase2-account-pair-lifecycle-preview.mjs";\n';
export const pairLifecycleEdits = [
  [
    'const output = "output/playwright/p43-actual-app-lifecycle-r1";',
    `const output = "${pairLifecycleOutput}";`,
  ],
  [
    "if (capture) await mkdir(output);",
    "const pairReview = await accountPairLifecyclePreview(read, sources);\nif (capture) await mkdir(output);",
  ],
  ['    logLevel: "error",', '    logLevel: "error",\n    plugins: [pairReview.plugin],'],
  [
    '    kind: "P43-ACTUAL-APP-LIFECYCLE-r1",',
    '    kind: "ACCOUNT-PAIR-C-LIFECYCLE-r2",\n    reviewComposition: pairReview.metadata,',
  ],
  ['    designApproval: "not_requested",', '    designApproval: "r2_whole_layout_pending",'],
  [
    "Untransformed App, NavigationShell, Router and KeepAlive. Local intercepted fixtures only. Original detail fixture lacks membership organization_id. Cancel dialogs before history navigation; open-dialog route cleanup, secret clearing, full C integration, real writes/RBAC and production are not covered.",
    "Actual App/Router/KeepAlive with exact pending C r2 shell/account review composition. Local intercepted fixtures only. Original detail fixture lacks membership organization_id. Cancel dialogs before history navigation; open-dialog route cleanup, secret clearing, additional password/reason designs, all states, real writes/RBAC and production are not covered.",
  ],
  [
    "现有未变换 App；仅本地测试数据。不是 C 方向最终设计稿，不代表生产或真实权限验收。",
    "待审 C r2 整页组合中的真实 App 交互；仅本地测试数据，不代表布局批准、完整 C 状态、生产或真实权限验收。",
  ],
  [
    '            await expect(page.getByRole("dialog")).toHaveCount(0);',
    `            const remainingDialogs = await page.getByRole("dialog").evaluateAll((nodes) =>
              nodes.map((node) => ({ label: node.getAttribute("aria-label"), modal: node.matches(":modal"), inAccounts: Boolean(node.closest(".account-center")) })),
            );
            check("only expected non-modal desktop navigation remains", remainingDialogs,
              width > 840 ? [{ label: "工作台导航", modal: false, inAccounts: false }] : [],
            );
            await expect(page.locator(".account-center").getByRole("dialog")).toHaveCount(0);`,
  ],
];

// Keep original interactions/requests; account-dialog closure stays strict while separately proving the desktop navigation is non-modal.
export function accountPairLifecycleDriver(input) {
  let source = input.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    originalAccountLifecycleHash,
    "Original actual App lifecycle driver changed",
  );
  for (const [before, after] of pairLifecycleEdits) {
    assert.equal(
      source.split(before).length,
      2,
      `One exact lifecycle composition anchor: ${before}`,
    );
    source = source.replace(before, after);
  }
  source = pairLifecycleImport + source;
  const ast = ts.createSourceFile(
    originalAccountLifecycleDriver,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  for (const node of ast.statements.filter(ts.isImportDeclaration).reverse()) {
    const specifier = node.moduleSpecifier.text;
    const resolved = specifier.startsWith(".")
      ? pathToFileURL(path.resolve(path.dirname(originalAccountLifecycleDriver), specifier)).href
      : import.meta.resolve(specifier);
    source =
      source.slice(0, node.moduleSpecifier.getStart(ast)) +
      JSON.stringify(resolved) +
      source.slice(node.moduleSpecifier.end);
  }
  return source;
}
