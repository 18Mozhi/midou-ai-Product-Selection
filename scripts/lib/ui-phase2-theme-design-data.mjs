import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { ref } from "vue";

export async function loadThemeDesignSource(repo) {
  const read = (file) => readFile(path.join(repo, file), "utf8");
  const themeSource = await read("apps/web/src/design/theme.ts");
  const shellSource = await read("apps/web/src/use-navigation-shell-theme.ts");
  const context = {
    exports: {},
    document: { documentElement: { dataset: {}, style: {} } },
    window: {
      localStorage: {
        setItem() {},
        getItem() {
          return null;
        },
      },
    },
  };
  const run = (source, sandbox) =>
    vm.runInNewContext(
      ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
        .outputText,
      sandbox,
    );
  run(themeSource, context);
  const definitions = context.exports;
  const makeController = (request) => {
    const sandbox = {
      ...context,
      exports: {},
      ref,
      applyTheme: definitions.applyTheme,
      isThemeId: definitions.isThemeId,
    };
    run(shellSource.replace(/^import .*;$/gm, ""), sandbox);
    return sandbox.exports.useNavigationShellTheme(request);
  };
  const ast = ts.createSourceFile("shell.ts", shellSource, ts.ScriptTarget.Latest, true);
  const notices = [];
  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.left.getText(ast) === "themeNotice.value" &&
      ts.isStringLiteral(node.right)
    )
      notices.push(node.right.text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(notices.length, 5);
  return {
    data: JSON.parse(
      JSON.stringify({ themes: definitions.themes, themeIds: definitions.themeIds, notices }),
    ),
    makeController,
  };
}

// Read-only, in-memory execution of current source. These are known-gap probes,
// not green assertions that theme write races have been fixed.
export async function probeThemeWriteGaps(makeController) {
  const writes = [];
  const controller = makeController((url, options) => {
    if (!options) return Promise.resolve({ data: { theme: "deep-ocean", version: 1 } });
    return new Promise((resolve, reject) => writes.push({ resolve, reject, body: options.body }));
  });
  await controller.loadThemePreference();
  const older = controller.chooseTheme("aurora-purple");
  const newer = controller.chooseTheme("cloud-white");
  assert.equal(writes.length, 2);
  writes[1].resolve({ data: { theme: "cloud-white", version: 2 } });
  await newer;
  writes[0].reject(new Error("isolated late failure"));
  await older;
  const observed = controller.activeTheme.value;
  assert.equal(
    observed,
    "deep-ocean",
    "Known-gap behavior changed; review before updating proposal evidence",
  );
  return {
    kind: "known-gap-reproduced-not-fixed",
    scenario: "older PUT failure arrives after newer PUT success",
    expectedLatestIntent: "cloud-white",
    observed,
    expectedVersions: writes.map((write) => write.body.expected_version),
    productionRequests: 0,
  };
}
