import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { userCreatePreview } from "./ui-phase2-user-create-preview.mjs";

// Shared C field composition, mounted through the actual P44 administrator entry.
export function adminCreatePreview(original) {
  let source = userCreatePreview(original);
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `P44 creation source drift: ${before}`);
    source = source.replace(before, after);
  };
  replace("<small>账号管理 / 创建</small>", "<small>平台管理 / 新建账号</small>");
  replace(
    'v-model="userForm.platform_role_code"',
    'v-model="userForm.platform_role_code" aria-describedby="p44-platform-role-help"',
  );
  replace(
    "</option>\n        </select></label\n      >\n      <label\n        >加入组织",
    '</option>\n        </select></label\n      ><small id="p44-platform-role-help">从管理员页打开时默认运营管理员；选择普通用户则不授予平台角色。</small>\n      <label\n        >加入组织',
  );
  assert.deepEqual(parse(source).errors, []);
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  return source;
}
