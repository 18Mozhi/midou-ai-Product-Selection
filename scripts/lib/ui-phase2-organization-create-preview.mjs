import assert from "node:assert/strict";

// Only the P41 review host applies these presentation changes in memory.
export function organizationCreatePreview(original) {
  let source = original;
  for (const [before, after] of [
    [
      "<h3>新建组织</h3>",
      '<div class="p41-identity"><small>组织创建</small><h3>新建组织</h3><p>建立组织及默认工作区。</p></div>',
    ],
    [
      'placeholder="例如：智能选品团队"',
      'placeholder="例如：智能选品团队" aria-label="组织名称" aria-describedby="p41-name-help"',
    ],
    ['placeholder="例如：midou-team"', 'placeholder="例如：midou-team" aria-label="组织标识"'],
    [
      "        </label>\n        <label>\n          组织标识",
      '          <small id="p41-name-help">2–120 个字符，用于显示组织名称。</small>\n        </label>\n        <label>\n          组织标识',
    ],
    [
      '<select v-model="form.initial_admin_user_id"',
      '<select aria-label="首位组织管理员" aria-describedby="p41-admin-help" v-model="form.initial_admin_user_id"',
    ],
    [
      "          </select>\n        </label>",
      '          </select>\n          <small id="p41-admin-help">这里只列出本次账号概览返回的用户；不指定时使用当前超级管理员。</small>\n        </label>',
    ],
    [
      '<button type="button" @click="close">',
      '<button class="p41-action-secondary" type="button" @click="close">',
    ],
    [
      '<button v-if="step === 2" type="button"',
      '<button class="p41-action-secondary" v-if="step === 2" type="button"',
    ],
    [
      '<button v-if="step === 1" type="button"',
      '<button class="p41-action-primary" v-if="step === 1" type="button"',
    ],
    [
      '<button v-else :disabled="busy">',
      '<button class="p41-action-primary" v-else :disabled="busy">',
    ],
  ]) {
    assert.equal(source.split(before).length, 2, `P41 preview source drift: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}
