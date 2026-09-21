import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { previewOrgProfileForm } from "./ui-phase2-org-profile-form-preview.mjs";

export const orgSaveFeedbackCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-save-feedback-c.css";
export const profileRepository = "apps/api/src/mysql-organization-admin-repository.ts";
export async function buildProfileSaveResult(profile) {
  const source = await readFile(profileRepository, "utf8");
  const ast = ts.createSourceFile(profileRepository, source, ts.ScriptTarget.Latest, true);
  const matches = [];
  function visit(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(ast) === "updateProfile") {
      function result(child) {
        if (ts.isVariableDeclaration(child) && child.name.getText(ast) === "result")
          matches.push(child.initializer);
        ts.forEachChild(child, result);
      }
      result(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(matches.length, 1, "Unique repository profile result shape");
  const box = {
    i: { organizationId: profile.id },
    rows: [{ version: profile.version }],
    now: new Date(profile.updated_at),
  };
  vm.runInNewContext("globalThis.result=" + matches[0].getText(ast), box);
  return JSON.parse(JSON.stringify(box.result));
}

export const saveReceiptScript = `const profileSaveReceipt = ref<{ phase: string; writeId: string; readId: string } | null>(null);
let profileReceiptGeneration = 0;
function clearProfileReceipt() { profileReceiptGeneration += 1; profileSaveReceipt.value = null; }
watch([() => props.routePath, () => props.organizationId], clearProfileReceipt, { flush: "sync" });
onDeactivated(clearProfileReceipt);
onBeforeUnmount(clearProfileReceipt);
`;
export const saveReceiptMarkup = `<section v-if="view === 'summary' && profileSaveReceipt" class="org-profile-receipt" :data-phase="profileSaveReceipt.phase" aria-labelledby="org-profile-receipt-title">
      <div role="status" aria-live="polite">
        <p class="org-profile-receipt-kicker">本次保存</p>
        <h3 id="org-profile-receipt-title">{{ profileSaveReceipt.phase === 'pending' ? '资料已保存，正在更新页面' : profileSaveReceipt.phase === 'ready' ? '资料已保存，页面已更新' : '资料已保存，页面暂未更新' }}</h3>
        <p>{{ profileSaveReceipt.phase === 'pending' ? '正在重新读取组织资料，请稍候。' : profileSaveReceipt.phase === 'ready' ? '页面已显示本次重新读取的资料。' : state === 'ready' ? '下方只读资料仍来自上次读取。可以使用上方“刷新数据”重新读取；无需重复保存。' : '当前暂时无法读取组织资料。请根据下方提示处理后重新加载；无需重复保存。' }}</p>
      </div>
      <details><summary>保存与读取追踪</summary><dl><div><dt>保存请求</dt><dd><code>{{ profileSaveReceipt.writeId }}</code></dd></div><div v-if="profileSaveReceipt.readId"><dt>页面读取</dt><dd><code>{{ profileSaveReceipt.readId }}</code></dd></div></dl></details>
    </section>`;
export const saveFeedbackReplacements = [
  ["async function load(options:", saveReceiptScript + "async function load(options:"],
  [
    "  if (!options.preserveNotice) {",
    "  if (!options.preserveNotice) {\n    clearProfileReceipt();",
  ],
  [
    '      : "empty";\n  } catch (error) {',
    '      : "empty";\n    return { ok: true, requestId: viewResponse.requestId };\n  } catch (error) {',
  ],
  [
    "    lastReadFailureStatus.value = failure?.status ?? null;\n    rethrowUnexpectedError(error);",
    "    lastReadFailureStatus.value = failure?.status ?? null;\n    rethrowUnexpectedError(error);\n    return { ok: false, requestId: requestId.value };",
  ],
  [
    "  const secretGeneration = tokenSecretGeneration;",
    `  const secretGeneration = tokenSecretGeneration;
  const profileWrite = path === "/org/admin/profile" && method === "PATCH" && view.value === "summary";
  if (profileWrite) clearProfileReceipt();
  const receiptGeneration = profileReceiptGeneration;
  const ownsProfileWrite = () => surfaceActive && receiptGeneration === profileReceiptGeneration;`,
  ],
  [
    '    if (!options.preserveForm) form.value = { reason: "" };\n    await load({ background: true, preserveNotice: true });',
    `    if (profileWrite && !ownsProfileWrite()) return true;
    if (!options.preserveForm) form.value = { reason: "" };
    if (profileWrite) {
      notice.value = "";
      profileSaveReceipt.value = { phase: "pending", writeId: writeRequestId, readId: "" };
    }
    const readOutcome = await load({ background: true, preserveNotice: true });
    if (profileWrite) {
      if (!ownsProfileWrite()) return true;
      if (!readOutcome) { clearProfileReceipt(); return true; }
      profileSaveReceipt.value = { phase: readOutcome.ok ? "ready" : "failed", writeId: writeRequestId, readId: readOutcome.requestId };
      return true;
    }`,
  ],
  [
    "    requestId.value = writeRequestId;\n    return true;\n  } catch (error) {",
    "    requestId.value = writeRequestId;\n    return true;\n  } catch (error) {\n    if (profileWrite && !ownsProfileWrite()) { rethrowUnexpectedError(error); return false; }",
  ],
  [
    '    </header>\n    <div\n      v-if="notice',
    "    </header>\n    " + saveReceiptMarkup + '\n    <div\n      v-if="notice',
  ],
];
export function previewOrgSaveFeedback(source) {
  let result = previewOrgProfileForm(source);
  for (const [before, after] of saveFeedbackReplacements) {
    assert.equal(result.split(before).length, 2, `Profile receipt anchor changed: ${before}`);
    result = result.replace(before, after);
  }
  return result;
}
