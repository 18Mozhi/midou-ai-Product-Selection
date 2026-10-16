import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";

const root = new URL("../../apps/web/src/components/", import.meta.url);
const developmentOnly =
  /^(?:UiStateShowcase|VerificationFramework|ApiFoundation|MySqlFoundation|RedisFoundation|ConfigBoundary|FileAuditFoundation|DeploymentFoundation)\.vue$/;
function components(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    return entry.isDirectory()
      ? components(file)
      : entry.name.endsWith(".vue") && !developmentOnly.test(entry.name)
        ? [file]
        : [];
  });
}

test("production template copy excludes design IDs and implementation narration", () => {
  const failures = [];
  for (const file of components(root)) {
    const { descriptor, errors } = parse(readFileSync(file, "utf8"));
    assert.deepEqual(errors, [], file.pathname);
    function visit(node) {
      if (node.type === 2) {
        const text = node.content.replace(/\s+/g, " ").trim();
        if (
          /C方向|不新增确认密码字段|不会伪装(?:为)?成功|^P\d{2}\s*[/／·]|^(?:SECURE ACCESS|ACCOUNT REGISTRATION|DATA LEDGER)$/.test(
            text,
          )
        )
          failures.push(`${file.pathname}: ${text}`);
      }
      for (const child of node.children ?? []) visit(child);
    }
    if (descriptor.template) visit(descriptor.template.ast);
  }
  assert.deepEqual(failures, []);
});

test("shared states keep useful actions and uncertainty without internal labels", () => {
  const state = readFileSync(
    new URL("../../apps/web/src/ui/state-contract.ts", import.meta.url),
    "utf8",
  );
  const panel = readFileSync(
    new URL("../../apps/web/src/components/UiStatePanel.vue", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(panel, /copy\.eyebrow/);
  const identity = readFileSync(
    new URL("../../apps/web/src/components/LocalIdentity.vue", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(identity, /class="p02-login-context"|ACCOUNT SIGN IN|密码仅用于本次登录验证/);
  assert.match(state, /结果不明确时，请先核对记录/);
  assert.match(state, /请联系管理员申请访问权限/);
  assert.match(state, /请重新登录后继续/);
  assert.match(panel, /aria-live/);
});
