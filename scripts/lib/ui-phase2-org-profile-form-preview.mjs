import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { orgFixtureFile } from "./ui-phase2-shell-org-fixture.mjs";
import { previewOrgReadState } from "./ui-phase2-org-read-state-preview.mjs";

export const orgProfileFormCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/org-profile-form-c.css";
export async function buildProfileConflictFixture() {
  const source = await readFile(orgFixtureFile, "utf8");
  const ast = ts.createSourceFile(orgFixtureFile, source, ts.ScriptTarget.Latest, true),
    matches = [];
  function visit(node) {
    if (
      ts.isObjectLiteralExpression(node) &&
      node.properties.some(
        (prop) =>
          ts.isPropertyAssignment(prop) &&
          prop.name.getText(ast) === "request_id" &&
          prop.initializer.getText(ast) === '"m06-01-conflict"',
      )
    )
      matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(matches.length, 1, "Unique original profile conflict fixture");
  const box = {};
  vm.runInNewContext("globalThis.result=" + matches[0].getText(ast), box);
  return JSON.parse(JSON.stringify(box.result));
}
export const profileFields = [
  ["name", "名称"],
  ["logo_url", "Logo HTTPS 地址"],
  ["timezone", "时区"],
  ["data_retention_days", "数据保留天数"],
  ["default_workspace_id", "默认工作区"],
  ["reason", "变更原因"],
];
export const profileFormScript = `const profileFieldErrors = ref<Record<string, string>>({});
function reflectProfileValidity(event: Event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
  const key = field.dataset.profileField;
  if (!key || (event.type !== "invalid" && !profileFieldErrors.value[key])) return;
  window.setTimeout(() => {
    if (!field.isConnected) return;
    let message = field.validationMessage;
    if (field.validity.valueMissing) message = "请填写此项。";
    else if (field instanceof HTMLInputElement && field.validity.rangeUnderflow) message = "不能小于 " + field.min + "。";
    else if (field instanceof HTMLInputElement && field.validity.rangeOverflow) message = "不能大于 " + field.max + "。";
    profileFieldErrors.value = { ...profileFieldErrors.value, [key]: field.validity.valid ? "" : message };
  }, 0);
}
function submitProfileFromForm(event: SubmitEvent) {
  const trigger = event.submitter;
  if (trigger instanceof HTMLButtonElement && document.activeElement === trigger) {
    const heading = trigger.closest("form")?.querySelector<HTMLElement>("h3");
    if (heading?.isConnected && !heading.closest("[inert]")) heading.focus({ preventScroll: true });
  }
  return submit('/org/admin/profile', { ...form.value, expected_version: data.value.version }, 'PATCH');
}
`;
export function previewOrgProfileForm(source) {
  let result = previewOrgReadState(source);
  const start = result.indexOf('<form\n          class="org-admin-card"'),
    end = result.indexOf("</form>", start) + 7;
  assert.ok(start >= 0 && end > start, "Organization profile form boundary");
  const before = result.slice(start, end);
  let form = before;
  const submitAnchor = `@submit.prevent="
            submit('/org/admin/profile', { ...form, expected_version: data.version }, 'PATCH')
          "`;
  assert.equal(form.split(submitAnchor).length, 2);
  form = form.replace(
    submitAnchor,
    '@submit.prevent="submitProfileFromForm($event)" @invalid.capture="reflectProfileValidity" @input="reflectProfileValidity" @change="reflectProfileValidity"',
  );
  form = form.replace("<h3>更新组织资料</h3>", '<h3 tabindex="-1">更新组织资料</h3>');
  const labels = form.match(/<label\b[\s\S]*?<\/label\s*>/g);
  assert.equal(labels?.length, 6);
  for (let index = 0; index < profileFields.length; index++) {
    const [key, title] = profileFields[index],
      label = labels[index];
    assert.ok(label.includes(`form.${key}`) && label.includes(`>${title}<`), key);
    let updated = label.replace(
      `>${title}<`,
      `><span id="org-profile-label-${key}">${title}</span><`,
    );
    updated = updated.replace(
      /<(input|select|textarea)\b/,
      `<$1 data-profile-field="${key}" aria-labelledby="org-profile-label-${key}" :aria-invalid="profileFieldErrors.${key} ? 'true' : undefined" :aria-describedby="profileFieldErrors.${key} ? 'org-profile-error-${key}${key === "logo_url" ? " org-profile-logo-help" : ""}' : ${key === "logo_url" ? "'org-profile-logo-help'" : "undefined"}"`,
    );
    updated = updated.replace(
      /<\/label(\s*)>/,
      `<small v-if="profileFieldErrors.${key}" id="org-profile-error-${key}" class="org-profile-error" role="status">{{ profileFieldErrors.${key} }}</small></label$1>`,
    );
    if (key === "logo_url")
      updated = updated.replace(
        "<small>仅支持 HTTPS",
        '<small id="org-profile-logo-help">仅支持 HTTPS',
      );
    form = form.replace(label, updated);
  }
  result = result.slice(0, start) + form + result.slice(end);
  const anchor = "async function submit(";
  assert.equal(result.split(anchor).length, 2);
  assert.equal(result.split("本次读取追踪").length, 3, "Two original operation trace labels");
  return result
    .replace(anchor, profileFormScript + anchor)
    .replaceAll("本次读取追踪", "本次操作追踪");
}
