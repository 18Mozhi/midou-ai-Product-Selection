import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";

// Review-only composition. All native fields, conditions and handlers stay original.
export function userCreatePreview(original) {
  let source = original;
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `P43 create source drift: ${before}`);
    source = source.replace(before, after);
  };
  replace(
    'ref="createUserDialogElement"',
    'ref="createUserDialogElement" class="p43-user-onboarding"',
  );
  replace(
    "<h3>{{ createUserTitle }}</h3>",
    '<aside class="p43-user-intro"><small>账号管理 / 创建</small><h3>{{ createUserTitle }}</h3>',
  );
  replace(
    "<p>账号立即可用；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。</p>",
    '<p>账号立即可用；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。</p></aside><div class="p43-user-fields-body">',
  );
  replace(
    "<label>邮箱<input",
    '<section class="p43-user-field-group"><header><h4>账号身份</h4><p>填写登录邮箱与首次登录使用的临时密码。</p></header><label>邮箱<input',
  );
  replace('maxlength="254" />', 'maxlength="254" aria-describedby="p43-create-email-help" />');
  replace(
    "      <label\n        >临时密码",
    '      <small id="p43-create-email-help">邮箱为必填项，最多254个字符。</small><label\n        >临时密码',
  );
  replace(
    'v-model="userForm.temporary_password"',
    'v-model="userForm.temporary_password" aria-describedby="p43-create-password-help"',
  );
  replace(
    "      <label\n        >平台角色",
    '      <small id="p43-create-password-help">12–128个字符，首次登录后必须修改。</small></section><section class="p43-user-field-group"><header><h4>权限与归属</h4><p>平台角色与组织角色分别设置；可暂不加入组织。</p></header><label\n        >平台角色',
  );
  replace(
    '      <footer>\n        <button type="button" @click="emit(\'closeCreateUser\')">',
    '      </section><footer>\n        <button type="button" @click="emit(\'closeCreateUser\')">',
  );
  replace(
    '        <button :disabled="busy">确认创建</button>\n      </footer>',
    '        <button :disabled="busy">确认创建</button>\n      </footer></div>',
  );
  assert.deepEqual(parse(source).errors, []);
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  return source;
}
