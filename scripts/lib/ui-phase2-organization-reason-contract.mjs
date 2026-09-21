import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import * as vue from "vue";
import * as renderer from "vue/server-renderer";

const dialogFile = "apps/web/src/components/AuditedReasonDialog.vue";
function elements(template, tag) {
  const matches = [];
  function visit(node) {
    if (node.type === 1 && node.tag === tag) matches.push(node);
    for (const child of node.children ?? []) visit(child);
  }
  visit(baseParse(template));
  return matches;
}

// P30/P36 share this caller. An optional component prop is not an effective caller limit.
export async function assertOrganizationReasonContract(dialogSource, parentSource) {
  const parent = parse(parentSource).descriptor;
  const parentScript = ts.createSourceFile(
    "OrganizationAdminCenter.vue",
    parent.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  assert.ok(
    parentScript.statements.some(
      (node) =>
        ts.isImportDeclaration(node) &&
        node.importClause?.name?.text === "AuditedReasonDialog" &&
        node.moduleSpecifier.text === "./AuditedReasonDialog.vue",
    ),
    "organization caller must use the actual shared reason dialog",
  );
  const sites = elements(parent.template.content, "AuditedReasonDialog");
  assert.equal(sites.length, 1, "one organization reason caller required");
  for (const prop of sites[0].props) {
    if (prop.type === 6)
      assert.ok(!/^(maximum-?length|maxlength)$/i.test(prop.name), "caller imposes a reason limit");
    if (prop.type === 7 && prop.name === "bind") {
      assert.ok(prop.arg?.isStatic, "opaque reason caller forwarding requires review");
      assert.ok(
        !/^(maximum-?length|maxlength)$/i.test(prop.arg.content),
        "caller imposes a reason limit",
      );
    }
  }

  const parsed = parse(dialogSource, { filename: dialogFile });
  assert.deepEqual(parsed.errors, []);
  const compiled = compileScript(parsed.descriptor, {
    id: "organization-reason-contract",
    inlineTemplate: true,
    templateOptions: { ssr: true },
  }).content;
  const ast = ts.createSourceFile(
    dialogFile,
    compiled,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const code = ast.statements
    .filter((node) => !(ts.isImportDeclaration(node) && node.moduleSpecifier.text.endsWith(".css")))
    .map((node) => node.getText(ast))
    .join("\n");
  const sandbox = {
    exports: {},
    require(name) {
      if (name === "vue") return vue;
      if (name === "vue/server-renderer") return renderer;
      if (name === "../use-modal-dialog")
        return { useModalDialog: () => ({ dialogElement: vue.ref(null), handleCancel: () => {} }) };
      throw new Error(`unexpected reason contract runtime import: ${name}`);
    },
  };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    sandbox,
  );

  async function textareaAttributes(props) {
    const html = await renderer.renderToString(
      vue.createSSRApp(sandbox.exports.default, {
        open: true,
        title: "原因",
        description: "本地字段合同",
        ...props,
      }),
    );
    const inputs = elements(html, "textarea");
    assert.equal(inputs.length, 1, "one rendered reason textarea required");
    return Object.fromEntries(
      inputs[0].props.map((prop) => [prop.name, prop.value?.content ?? ""]),
    );
  }
  const ordinary = await textareaAttributes({});
  assert.equal(ordinary.maxlength, undefined, "unexpected default reason maxlength");
  assert.equal(ordinary.minlength, "2");
  assert.ok(Object.hasOwn(ordinary, "required"));
  const explicit = await textareaAttributes({ maximumLength: 500 });
  assert.equal(explicit.maxlength, "500", "explicit optional reason limit must remain effective");
  return { defaultMaximum: null, explicitMaximum: 500, minimum: 2, required: true };
}
