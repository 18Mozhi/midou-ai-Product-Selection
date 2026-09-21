import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewShellVue } from "../../scripts/lib/ui-phase2-shell-vue-preview.mjs";
import {
  previewShellAccess,
  shellAccessCopy,
  shellAccessFocus,
  shellAccessCss,
} from "../../scripts/lib/ui-phase2-shell-access-preview.mjs";

const file = "apps/web/src/components/NavigationShell.vue";
const source = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
test("access preview changes only six copy pairs and focus wrapper in original C script", () => {
  const prior = parse(previewShellVue(source)).descriptor;
  const current = parse(previewShellAccess(source)).descriptor;
  let script = current.scriptSetup.content.replace(shellAccessFocus, "");
  for (const [key, before, after] of shellAccessCopy)
    script = script.replace(
      `${key}: [${after.map(JSON.stringify).join(", ")}],`,
      `${key}: [${before.map(JSON.stringify).join(", ")}],`,
    );
  assert.equal(script, prior.scriptSetup.content);
  assert.equal(
    current.template.content
      .replace('<h1 tabindex="-1">{{ stateCopy[0] }}</h1>', "<h1>{{ stateCopy[0] }}</h1>")
      .replace('@click="reviewRecheck"', '@click="load"'),
    prior.template.content,
  );
  const compiled = compileScript(current, { id: "shell-access" });
  assert.deepEqual(
    compileTemplate({
      source: current.template.content,
      filename: file,
      id: "shell-access",
      compilerOptions: { bindingMetadata: compiled.bindings },
    }).errors,
    [],
  );
});
test("access preview preserves original state mapping, link destinations and retry implementation", () => {
  const preview = previewShellAccess(source);
  for (const text of [
    'to="/login"',
    'to="/select-context"',
    'to="/home"',
    'aria-live="polite"',
    "await request<GuardSummary>(`/me/navigation?shell=${shell}`",
  ])
    assert.ok(preview.includes(text));
  assert.ok(!preview.includes("重新登录后返回当前页面"));
  assert.ok(!source.includes("reviewRecheck"));
  assert.throws(() =>
    previewShellAccess(
      source.replace("let navigationSequence = 0;", "let navigationSequence = 1;"),
    ),
  );
});
test("access-only CSS cannot restyle ready pages or hide trace data", async () => {
  const css = await readFile(shellAccessCss, "utf8");
  assert.ok(css.includes('.role-shell.role-shell--review:not([data-state="ready"])'));
  assert.ok(css.includes("overflow-wrap: anywhere"));
  assert.ok(!css.includes("display: none"));
  assert.ok(!css.includes("!important"));
});

test("recheck focus only follows its own focused button and always invokes the original load once", () => {
  for (const scenario of ["owned", "other-focus", "not-button", "missing-heading"]) {
    let loads = 0,
      focused = 0;
    const heading = {
      focus: (options) => {
        assert.equal(options.preventScroll, true);
        focused++;
      },
    };
    class Button {
      closest(selector) {
        assert.equal(selector, ".role-gate-state");
        return {
          querySelector: (selector) => {
            assert.equal(selector, "h1");
            return scenario === "missing-heading" ? null : heading;
          },
        };
      }
    }
    const trigger = scenario === "not-button" ? {} : new Button();
    const document = { activeElement: scenario === "other-focus" ? {} : trigger };
    const context = vm.createContext({
      document,
      HTMLButtonElement: Button,
      load: () => {
        loads++;
      },
      event: { currentTarget: trigger },
    });
    vm.runInContext(
      ts.transpileModule(shellAccessFocus + "reviewRecheck(event);", {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      context,
    );
    assert.equal(loads, 1, scenario);
    assert.equal(focused, scenario === "owned" ? 1 : 0, scenario);
  }
});

test("access capture covers three shells and five HTTP classes with current source and image provenance", async () => {
  const root = "output/playwright/shell-access-vue-c-r1";
  const evidence = JSON.parse(await readFile(`${root}/evidence.json`, "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(evidence.kind, "SHELL-ACCESS-VUE-C-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.userReview, "pending");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 60);
  assert.equal(
    evidence.runs.reduce((n, run) => n + run.checks.length, 0),
    966,
  );
  const expected = ["baseline", "review"].flatMap((mode) =>
    [390, 1440].flatMap((width) =>
      ["member", "organization_admin", "platform_admin"].flatMap((shell) =>
        ["expired", "forbidden", "context_required", "rate_limited", "blocked"].map(
          (state) => `${mode}/${width}/${shell}/${state}`,
        ),
      ),
    ),
  );
  assert.deepEqual(
    evidence.runs.map((run) => `${run.mode}/${run.width}/${run.shell}/${run.state}`).sort(),
    expected.sort(),
  );
  assert.equal(evidence.screenshots.length, 84);
  assert.equal(Object.keys(evidence.sourceHashes).length, 163);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
  for (const shot of evidence.screenshots) {
    const bytes = await readFile(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of evidence.runs) {
    assert.ok(
      run.requests.every((request) => request.key.startsWith("GET ") && request.body === null),
    );
    assert.equal(
      run.checks.find((check) => check.name === "no authorization menu leaked")?.actual,
      0,
    );
  }
});
