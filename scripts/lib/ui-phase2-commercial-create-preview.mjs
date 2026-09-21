import assert from "node:assert/strict";

export function previewCommercialCreate(source) {
  const start = source.indexOf('<dialog ref="createDialogElement"'),
    end = source.indexOf("</dialog>", start) + "</dialog>".length;
  assert.ok(start > 0 && end > start);
  let dialog = source.slice(start, end);
  const replace = (before, after) => {
    assert.equal(dialog.split(before).length, 2, `Unique P58 create anchor: ${before}`);
    dialog = dialog.replace(before, after);
  };
  replace(
    '<dialog ref="createDialogElement"',
    '<dialog class="p58-draft-c" ref="createDialogElement"',
  );
  replace(
    "<h3>创建配额方案草稿</h3>",
    '<h3>创建配额方案草稿</h3><p class="p58-intro">只创建草稿，不启用方案，也不向组织分配额度。</p>',
  );
  replace(
    "          </header>\n          <label",
    `          </header>
          <aside class="p58-draft-guide" aria-label="表单内容说明">
            <strong>填写与核对</strong><ol><li>方案资料</li><li>三项基础配额</li><li>创建原因</li></ol>
            <p>额度是配置值，不是使用量，也不是收费价格。</p>
          </aside>
          <section class="p58-draft-identity" aria-label="方案资料"><h4>方案资料</h4>
          <label`,
  );
  replace("          <fieldset>", "          </section>\n          <fieldset>");
  replace('pattern="[a-z0-9][a-z0-9_-]{0,79}"', 'pattern="[a-z0-9][a-z0-9_\\-]{0,79}"');
  replace(
    '              maxlength="80"',
    '              maxlength="80"\n              aria-describedby="p58-draft-code-help"',
  );
  replace(
    "          ><label>方案名称",
    '          ><small id="p58-draft-code-help">1–80 个字符，以小写字母或数字开头，可包含下划线和连字符。</small><label>方案名称',
  );
  replace(
    '          <label>创建原因<input v-model="plan.reason" required maxlength="500" /></label>',
    '          <section class="p58-draft-reason" aria-label="创建原因说明"><label>创建原因<input v-model="plan.reason" required maxlength="500" aria-describedby="p58-draft-reason-help" /></label><small id="p58-draft-reason-help">说明本次配置目的，最多 500 个字符。</small></section>',
  );
  return source.slice(0, start) + dialog + source.slice(end);
}
