import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewOrgReadState } from "../../scripts/lib/ui-phase2-org-read-state-preview.mjs";
import {
  previewOrgProfileForm,
  profileFormScript,
  buildProfileConflictFixture,
} from "../../scripts/lib/ui-phase2-org-profile-form-preview.mjs";

test("profile preview preserves original script and every native field constraint and binding", async () => {
  const source = (
    await readFile("apps/web/src/components/OrganizationAdminCenter.vue", "utf8")
  ).replaceAll("\r\n", "\n");
  const previous = previewOrgReadState(source),
    proposed = previewOrgProfileForm(source);
  const before = parse(previous).descriptor,
    after = parse(proposed).descriptor;
  assert.equal(
    after.scriptSetup.content.replace(profileFormScript, ""),
    before.scriptSetup.content,
  );
  const form = (text) =>
    text.slice(
      text.indexOf('<form\n          class="org-admin-card"'),
      text.indexOf("</form>", text.indexOf('<form\n          class="org-admin-card"')) + 7,
    );
  assert.equal(
    previous.replace(form(previous), "FORM"),
    proposed
      .replace(form(proposed), "FORM")
      .replace(profileFormScript, "")
      .replaceAll("本次操作追踪", "本次读取追踪"),
  );
  const nativeTags = (text) => form(text).match(/<(?:input|select|textarea)\b[^>]*>/g);
  assert.deepEqual(
    nativeTags(proposed).map((tag) =>
      tag.replace(
        / (?:data-profile-field|aria-labelledby|:aria-invalid|:aria-describedby)="[^"]*"/g,
        "",
      ),
    ),
    nativeTags(previous),
  );
  assert.ok(!proposed.includes('@input.capture="reflectProfileValidity"'));
  assert.ok(!profileFormScript.includes("preventDefault"));
  const compiled = compileScript(after, { id: "profile-form" });
  assert.deepEqual(
    compileTemplate({
      source: after.template.content,
      filename: "OrganizationAdminCenter.vue",
      id: "profile-form",
      compilerOptions: { bindingMetadata: compiled.bindings },
    }).errors,
    [],
  );
  assert.throws(() =>
    previewOrgProfileForm(
      source.replace('maxlength="120" /></label', 'maxlength="120" /></changed>'),
    ),
  );
});

test("profile validity reflection waits for native handlers and never mutates field values", () => {
  const callbacks = [];
  class Input {}
  class Select {}
  class Textarea {}
  const box = {
    ref: (value) => ({ value }),
    HTMLInputElement: Input,
    HTMLSelectElement: Select,
    HTMLTextAreaElement: Textarea,
    window: {
      setTimeout: (fn, delay) => {
        assert.equal(delay, 0);
        callbacks.push(fn);
      },
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      profileFormScript +
        "globalThis.reflect=reflectProfileValidity;globalThis.errors=profileFieldErrors;",
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    box,
  );
  const field = Object.assign(new Input(), {
    dataset: { profileField: "name" },
    isConnected: true,
    value: "",
    validationMessage: "native-required",
    validity: { valid: false, valueMissing: true },
  });
  box.reflect({ type: "invalid", target: field });
  assert.deepEqual(JSON.parse(JSON.stringify(box.errors.value)), {});
  callbacks.shift()();
  assert.equal(box.errors.value.name, "请填写此项。");
  field.value = "仍应保留输入";
  field.validationMessage = "";
  field.validity = { valid: true };
  box.reflect({ type: "input", target: field });
  callbacks.shift()();
  assert.equal(box.errors.value.name, "");
  assert.equal(field.value, "仍应保留输入");
  field.dataset.profileField = "logo_url";
  field.validity = { valid: false };
  field.validationMessage = "before native invalid handler";
  box.reflect({ type: "invalid", target: field });
  field.validationMessage = "Logo 地址必须以 https:// 开头，或保持为空。";
  callbacks.shift()();
  assert.equal(box.errors.value.logo_url, field.validationMessage);
  box.reflect({ type: "invalid", target: field });
  field.isConnected = false;
  field.validationMessage = "detached mutation";
  callbacks.shift()();
  assert.notEqual(box.errors.value.logo_url, "detached mutation");
});

test("profile submit wrapper retains versioned PATCH arguments and only moves its own focus", () => {
  for (const active of [true, false])
    for (const connected of [true, false])
      for (const inert of [true, false]) {
        let focused = 0;
        const calls = [];
        const heading = {
          isConnected: connected,
          closest: () => (inert ? {} : null),
          focus: (options) => {
            assert.deepEqual(JSON.parse(JSON.stringify(options)), { preventScroll: true });
            focused++;
          },
        };
        class Button {
          closest() {
            return { querySelector: () => heading };
          }
        }
        const trigger = new Button(),
          box = {
            ref: (value) => ({ value }),
            HTMLButtonElement: Button,
            document: { activeElement: active ? trigger : {} },
            form: { value: { name: "原输入", reason: "原原因" } },
            data: { value: { version: 3 } },
            submit: (...args) => {
              calls.push(args);
              return "original-submit";
            },
          };
        vm.runInNewContext(
          ts.transpileModule(profileFormScript + "globalThis.run=submitProfileFromForm;", {
            compilerOptions: { target: ts.ScriptTarget.ES2022 },
          }).outputText,
          box,
        );
        assert.equal(box.run({ submitter: trigger }), "original-submit");
        assert.equal(focused, active && connected && !inert ? 1 : 0);
        assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
          [
            "/org/admin/profile",
            { name: "原输入", reason: "原原因", expected_version: 3 },
            "PATCH",
          ],
        ]);
      }
});
test("profile conflict response comes from the original M06-01 fixture", async () => {
  assert.deepEqual(await buildProfileConflictFixture(), {
    error: {
      code: "organization_version_conflict",
      message: "organization_version_conflict",
      action_hint: "刷新页面后重试。",
    },
    request_id: "m06-01-conflict",
    trace_id: "m06-01-conflict",
  });
});
test("profile packet binds current sources, visible errors and one local conflict PATCH per run", async () => {
  const root = "output/playwright/org-profile-form-vue-c-r3",
    evidence = JSON.parse(await readFile(`${root}/evidence.json`, "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(evidence.kind, "ORG-PROFILE-FORM-VUE-C-r3");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.userReview, "pending");
  assert.equal(evidence.processesClosed, true);
  assert.deepEqual(
    evidence.runs.map((r) => `${r.mode}/${r.width}`),
    ["baseline/390", "baseline/1440", "review/390", "review/1440"],
  );
  assert.equal(evidence.screenshots.length, 22);
  assert.equal(Object.keys(evidence.sourceHashes).length, 180);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
  for (const shot of evidence.screenshots) {
    const bytes = await readFile(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of evidence.runs) {
    const actual = (name) => run.checks.find((c) => c.name === name)?.actual;
    assert.equal(run.requests.filter((r) => r.key.startsWith("PATCH ")).length, 1);
    assert.equal(actual("idempotency and request headers present"), true);
    assert.equal(actual("no automatic PATCH retry"), 1);
    assert.equal(actual("no automatic reread on conflict"), 1);
    assert.equal(actual("conflict retains submitted draft"), "本地版本冲突草稿");
    assert.equal(actual("conflict retains reason"), "本地表单审核原因");
    assert.equal(actual("no save success claim"), 0);
    assert.deepEqual(actual("no unexpected network"), []);
    assert.deepEqual(actual("no runtime errors"), []);
    for (const key of [
      "name-required",
      "reason-required",
      "timezone-required",
      "logo-https",
      "retention-low",
      "retention-high",
    ]) {
      assert.equal(actual(key + " blocks native submission"), 0);
      assert.equal(actual(key + " invalid"), true);
      if (run.mode === "review") {
        assert.equal(actual(key + " linked visible error"), true);
        assert.equal(actual(key + " capture is after keyboard blur"), true);
        assert.equal(actual(key + " clears only presentation after valid input").valid, true);
      }
    }
    if (run.mode === "review") assert.equal(actual("saving focus observation").heading, true);
    else assert.equal(actual("saving focus observation").body, true);
  }
});
