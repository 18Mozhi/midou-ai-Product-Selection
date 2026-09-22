import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";

const componentPath = "apps/web/src/components/PlatformOrganizationDetailDialog.vue";
const dialogPath = "apps/web/src/components/PlatformAccountDialogs.vue";
const parentPath = "apps/web/src/components/PlatformAccountCenter.vue";
const component = readFileSync(componentPath, "utf8");
const dialog = readFileSync(dialogPath, "utf8");
const parent = readFileSync(parentPath, "utf8");

test("P42 production detail has separate identity and editable work regions", () => {
  const parsed = parse(component, { filename: componentPath });
  assert.deepEqual(parsed.errors, []);
  const template = parsed.descriptor.template.content;
  const styles = parsed.descriptor.styles.map((style) => style.content).join("\n");
  assert.match(template, /class="p42-identity"/);
  assert.match(template, /class="p42-work"/);
  assert.match(template, /class="p42-actions"/);
  assert.match(styles, /position: sticky/);
  assert.match(component, /member_count == null \? "尚未读取"/);
  assert.match(component, /workspace_count == null\s*\? "尚未读取"/);
  assert.match(template, /本次组织列表没有返回这个目标/);
  assert.match(template, /不能单独说明组织已删除/);
});

test("P42 production controls preserve the current API validation boundaries", () => {
  const parsed = parse(component);
  const template = parsed.descriptor.template.content;
  const styles = parsed.descriptor.styles.map((style) => style.content).join("\n");
  assert.match(template, /minlength="2"/);
  assert.match(template, /maxlength="120"/);
  assert.match(template, /maxlength="64"/);
  assert.match(template, /min="30"/);
  assert.match(template, /max="3650"/);
  assert.match(template, /step="1"/);
  assert.match(template, /@click="\$emit\('retry'\)"/);
  assert.match(parent, /:refreshing="refreshing"/);
  assert.match(parent, /:refresh-warning="organizationRefreshWarning"/);
  assert.match(parent, /@retry="retryOrganizationRead"/);
  assert.match(template, /class="p42-status-action"/);
  assert.match(template, /class="p42-save"/);
  assert.match(styles, /:focus-visible/);
  assert.match(dialog, /p42-reason-dialog/);
  assert.match(dialog, /p42-reason-head/);
});
