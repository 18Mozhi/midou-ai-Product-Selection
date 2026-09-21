import assert from "node:assert/strict";

// Review-only template transform. The complete production script and other dialogs stay intact.
export function previewCommercialEdit(source) {
  const start = source.indexOf('<dialog ref="planDialogElement"'),
    end = source.indexOf("</dialog>", start) + "</dialog>".length;
  assert.ok(start > 0 && end > start);
  let dialog = source.slice(start, end);
  const replace = (before, after) => {
    assert.equal(dialog.split(before).length, 2, `Unique P58 edit anchor: ${before}`);
    dialog = dialog.replace(before, after);
  };
  replace(
    '<dialog ref="planDialogElement"',
    '<dialog class="p58-revise-c" ref="planDialogElement"',
  );
  replace(
    "<header><h3>编辑配额方案</h3></header>",
    `<header><p class="p58-revise-eyebrow">配额方案 · 修改</p><h3>编辑配额方案</h3>
      <p class="p58-revise-version">基于版本 {{ editingPlan.expected_version }}</p>
      <p>下一步核对修改影响，确认执行后才会保存。</p></header>
      <aside class="p58-revise-guide" aria-label="修改步骤说明"><strong>本次修改</strong>
        <ol><li>方案资料</li><li>基础配额</li><li>状态与原因</li></ol>
        <p>取消影响预览会关闭本次修改，不会返回编辑窗。</p>
      </aside>
      <section class="p58-revise-identity" aria-label="方案资料"><h4>方案资料</h4>`,
  );
  replace(
    '<label>名称<input v-model="editingPlan.name" required maxlength="120" /></label',
    '<div class="p58-revise-field"><label>名称<input v-model="editingPlan.name" required maxlength="120" aria-describedby="p58-revise-name-help" /></label><small id="p58-revise-name-help">必填，最多 120 个字符。</small></div',
  );
  replace(
    '<label>说明<textarea v-model="editingPlan.description" maxlength="500"></textarea></label',
    '<div class="p58-revise-field"><label>说明<textarea v-model="editingPlan.description" maxlength="500" aria-describedby="p58-revise-description-help"></textarea></label><small id="p58-revise-description-help">选填，最多 500 个字符。</small></div',
  );
  replace(
    "          ><label\n            >采集任务",
    '          ></section><section class="p58-revise-quotas" aria-label="基础配额"><h4>基础配额</h4><p id="p58-revise-quota-help">三项均填 0–1,000,000,000 的整数；这是配置额度，不是使用量或价格。</p><div class="p58-revise-quota-grid"><label\n            >采集任务',
  );
  for (const key of ["collection_tasks", "open_api_requests", "report_exports"])
    replace(
      `v-model.number="editingPlan.${key}"`,
      `v-model.number="editingPlan.${key}" aria-describedby="p58-revise-quota-help"`,
    );
  replace(
    "          ><label\n            >状态<select",
    '          ></div></section><section class="p58-revise-decision" aria-label="状态与原因"><h4>状态与原因</h4><label\n            >状态<select',
  );
  replace(
    'v-model="editingPlan.reason" required minlength="2" maxlength="500"',
    'v-model="editingPlan.reason" required minlength="2" maxlength="500" aria-describedby="p58-revise-reason-help"',
  );
  replace(
    "          <footer>",
    '          <small id="p58-revise-reason-help">必填，2–500 个字符。说明本次变更原因。</small></section>\n          <footer>',
  );
  replace("保存新版本</button>", "预览修改影响</button>");
  return source.slice(0, start) + dialog + source.slice(end);
}
