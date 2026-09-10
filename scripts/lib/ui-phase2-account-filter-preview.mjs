import assert from "node:assert/strict";

// Review-host transformation only. The application never imports this module.
export function accountFilterPreview(source) {
  const forms = [...source.matchAll(/<form class="account-filter"[\s\S]*?<\/form>/g)];
  assert.equal(forms.length, 1, "Review patch requires the exact account filter form");
  const original = forms[0][0];
  assert.ok(original.includes('@submit.prevent="applyFilters"'));
  assert.ok(original.includes('@click="resetFilters"'));
  let form = original.replace(
    '<input v-model="query" :placeholder="searchPlaceholder" />',
    `<label class="p39-filter-field"><span id="p39-query-label">关键词</span>
      <input v-model="query" :placeholder="searchPlaceholder" aria-labelledby="p39-query-label" aria-describedby="p39-query-help" />
      <small id="p39-query-help">概览只展示组织记录。用户邮箱查询结果请到用户管理查看。</small>
    </label>`,
  );
  assert.notEqual(form, original, "Input source contract drift");
  form = form.replace(
    "<select\n",
    '<label class="p39-filter-field"><span>{{ statusLabel }}</span><select\n',
  );
  form = form.replace(
    ':aria-label="statusLabel"',
    ':aria-label="statusLabel" aria-describedby="p39-status-help"',
  );
  form = form.replace(
    "</select\n          >",
    '</select><small id="p39-status-help">“已停用”和“已停用组织”是不同的筛选值。</small></label>\n          ',
  );
  assert.ok(form.includes('id="p39-status-help"'), "Select source contract drift");
  form = form.replace(
    '<button :disabled="refreshing">',
    '<div class="p39-filter-actions"><button :disabled="refreshing">',
  );
  form = form.replace("</form>", "</div></form>");
  return { source: source.replace(original, form), original, form };
}
