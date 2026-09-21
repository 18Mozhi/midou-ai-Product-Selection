import assert from "node:assert/strict";

export function previewCommercialConfirm(source) {
  const start = source.indexOf('<dialog ref="confirmDialogElement"'),
    end = source.indexOf("</dialog>", start) + "</dialog>".length;
  assert.ok(start > 0 && end > start);
  let dialog = source.slice(start, end);
  const replace = (before, after) => {
    assert.equal(dialog.split(before).length, 2, `Unique P58 confirmation anchor: ${before}`);
    dialog = dialog.replace(before, after);
  };
  replace(
    '<dialog ref="confirmDialogElement"',
    '<dialog class="p58-impact-c" ref="confirmDialogElement"',
  );
  replace(
    "<header>\n            <h3>",
    '<header><p class="p58-impact-eyebrow">核对后执行</p>\n            <h3>',
  );
  replace(
    "          </header>\n          <p>该操作会改变配额方案版本、分配状态或组织额度，并写入平台审计。</p>",
    "          <p>该操作会改变配额方案版本、分配状态或组织额度，并写入平台审计。</p></header>",
  );
  replace(
    "<p>{{ pending.impact.scope }}</p>",
    '<p class="p58-impact-scope">{{ pending.impact.scope }}</p>',
  );
  replace("<span>{{ row.before }}</span", "<span><small>变更前</small>{{ row.before }}</span");
  replace(
    "<strong>{{ row.after }}</strong>",
    "<strong><small>变更后</small>{{ row.after }}</strong>",
  );
  replace(
    "<p>{{ pending.impact.note }}</p>",
    '<p v-if="!pending.impact.rows.length" class="p58-impact-no-rows">本次未提供逐项前后值。请核对以上操作与影响范围。</p><p class="p58-impact-note">{{ pending.impact.note }}</p>',
  );
  replace(
    "          <footer>",
    `          <!-- P58 review submission facts start -->
          <section class="p58-impact-facts" aria-label="待提交信息"><h4>待提交信息</h4><dl>
            <div v-if="pending.body.name !== undefined"><dt>方案名称</dt><dd>{{ pending.body.name }}</dd></div>
            <div v-if="pending.body.description !== undefined"><dt>方案说明</dt><dd>{{ pending.body.description || '未填写说明' }}</dd></div>
            <div v-if="pending.body.expected_version !== undefined && pending.body.expected_version !== null"><dt>请求携带的版本</dt><dd>{{ pending.body.expected_version }}</dd></div>
            <div><dt>变更原因</dt><dd>{{ pending.body.reason }}</dd></div>
          </dl></section>
          <!-- P58 review submission facts end -->
          <footer>`,
  );
  return source.slice(0, start) + dialog + source.slice(end);
}

// Explicit local fixture variations; never production data or a permission/state-machine claim.
export const commercialConfirmScenarios = [
  "edit",
  "activate",
  "retire",
  "assign",
  "renew",
  "suspend",
  "resume",
  "end",
  "adjust",
  "revoke",
];
export function commercialConfirmSample(data, scenario) {
  assert.ok(commercialConfirmScenarios.includes(scenario));
  const sample = structuredClone(data);
  if (scenario === "activate") {
    sample.plans[0].status = "draft";
    sample.summary = { ...sample.summary, active: 0, draft: 1 };
  }
  if (scenario === "resume") sample.assignment.status = "suspended";
  if (scenario === "assign") {
    sample.assignment = null;
    sample.adjustments = [];
    sample.adjustment_pagination = { ...sample.adjustment_pagination, total: 0, total_pages: 1 };
    sample.usage = {};
    sample.effective_quotas = {};
  }
  return sample;
}
