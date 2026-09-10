import assert from "node:assert/strict";

function once(source, before, after) {
  assert.equal(source.split(before).length, 2, `P42 preview drift: ${before.slice(0, 90)}`);
  return source.replace(before, after);
}
export function organizationDetailPreview(original) {
  let source = original;
  const close =
    '<button type="button" aria-label="关闭组织详情" @click="$emit(\'close\')">关闭</button>';
  const action = `<button
          type="button"
          class="secondary"
          :disabled="busy"
          @click="$emit('toggleStatus', organization)"
        >
          {{ organization.status === "active" ? "停用组织" : "恢复组织" }}
        </button>`;
  source = once(source, close, "");
  source = once(source, action, "");
  source = once(source, "      <header>", '      <aside class="p42-identity"><header>');
  source = once(
    source,
    '      <section class="organization-profile">',
    `      </aside><section class="p42-work"><div class="p42-work-head"><h3>资料与状态</h3>${close}</div><section class="organization-profile">`,
  );
  source = once(
    source,
    "      </details>\n      <footer>",
    `      </details><section class="p42-status-zone"><div><h4>组织状态操作</h4><p>停用或恢复将单独要求填写原因。</p></div>${action.replace('class="secondary"', 'class="secondary p42-status-action" :data-danger="organization.status === \'active\'"')}</section>\n      <footer>`,
  );
  source = once(source, "      </footer>\n    </form>", "      </footer></section>\n    </form>");
  source = once(
    source,
    "{{ organization.member_count ?? 1 }} 人",
    '{{ organization.member_count == null ? "尚未读取" : organization.member_count + " 人" }}',
  );
  source = once(
    source,
    "{{ organization.workspace_count ?? 1 }} 个",
    '{{ organization.workspace_count == null ? "尚未读取" : organization.workspace_count + " 个" }}',
  );
  source = once(source, "未找到该组织", "当前记录中未找到该组织");
  source = once(
    source,
    "该组织可能已被删除，或当前账号已无法访问。请重新加载，或返回组织列表选择其他组织。",
    "本次组织列表没有返回这个目标。可以重新加载，或返回组织列表选择其他组织。",
  );
  source = once(
    source,
    '<button :disabled="busy">保存组织资料</button>',
    '<button class="p42-save" :disabled="busy">保存组织资料</button>',
  );
  return source;
}

export function organizationReasonPreview(original) {
  let source = once(
    original,
    '<dialog ref="reasonDialogElement" :aria-label="reasonTitle" @cancel="handleReasonCancel">',
    '<dialog class="p42-reason-dialog" ref="reasonDialogElement" :aria-label="reasonTitle" @cancel="handleReasonCancel">',
  );
  source = once(
    source,
    "<h3>{{ reasonTitle }}</h3>\n      <p>原因会写入平台审计记录。</p>",
    '<header class="p42-reason-head"><h3>{{ reasonTitle }}</h3><p>原因会写入平台审计记录。</p></header>',
  );
  return source;
}
