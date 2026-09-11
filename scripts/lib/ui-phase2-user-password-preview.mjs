import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";

// Isolated presentation only. No password, target, permission or write logic changes.
export function userPasswordPreview(original) {
  let source = original;
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `P43 password source drift: ${before}`);
    source = source.replace(before, after);
  };
  replace('ref="passwordDialogElement"', 'ref="passwordDialogElement" class="p43-security-sheet"');
  replace('ref="reasonDialogElement"', 'ref="reasonDialogElement" class="p43-reason-sheet"');
  replace(
    "<h3>强制重置密码</h3>",
    '<header class="p43-security-heading"><small>登录安全 / 临时密码</small><h3>强制重置密码</h3>',
  );
  replace(
    "<p>保存后会撤销该用户全部活动会话，并要求首次登录修改密码。</p>",
    '<p>保存后会撤销该用户全部活动会话，并要求首次登录修改密码。</p></header><div class="p43-security-content">',
  );
  replace(
    'v-model="passwordForm.temporary_password"',
    'v-model="passwordForm.temporary_password" aria-describedby="p43-password-help"',
  );
  replace(
    '      <footer>\n        <button type="button" @click="emit(\'closePassword\')">',
    '      <small id="p43-password-help">12–128个字符。下一步填写操作原因，确认执行后才会提交。</small><footer>\n        <button type="button" @click="emit(\'closePassword\')">',
  );
  replace(
    '        <button :disabled="busy">确认重置</button>\n      </footer>',
    '        <button :disabled="busy">确认重置</button>\n      </footer></div>',
  );
  replace(
    "<h3>{{ reasonTitle }}</h3>",
    '<header class="p43-security-heading"><small>操作确认 / 审计说明</small><h3>{{ reasonTitle }}</h3>',
  );
  replace(
    "<p>原因会写入平台审计记录。</p>",
    '<p>原因会写入平台审计记录。</p></header><div class="p43-security-content">',
  );
  replace(':value="reasonText"', ':value="reasonText" aria-describedby="p43-reason-help"');
  replace(
    '      <footer>\n        <button type="button" @click="emit(\'closeReason\')">',
    '      <small id="p43-reason-help">请填写2–300个字符的操作原因。</small><footer>\n        <button type="button" @click="emit(\'closeReason\')">',
  );
  replace(
    '        <button :disabled="busy">确认执行</button>\n      </footer>',
    '        <button :disabled="busy">确认执行</button>\n      </footer></div>',
  );
  assert.deepEqual(parse(source).errors, []);
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  return source;
}
