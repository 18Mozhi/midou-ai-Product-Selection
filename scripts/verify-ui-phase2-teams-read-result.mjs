import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const base = "scripts/verify-ui-phase2-teams-create-states.mjs";
const expected = "692d4a99de832980b014726cde94d541538d41f29bdd9ee20a4646edd56c08c2";
const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every((arg) => ["--smoke", "--capture"].includes(arg)));
const statuses = args.includes("--smoke") ? [500] : [500, 403];
if (args.includes("--capture")) {
  for (const status of statuses) {
    const dir = `output/playwright/p33-read-result-${status}-r2`;
    let exists = true;
    try {
      await access(dir);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      exists = false;
    }
    assert.equal(exists, false, `Refuse to overwrite ${dir}`);
  }
}

const scenario = `
      check("read failure preserves permission state", await page.locator(".org-admin-center").getAttribute("data-state"), readFailureStatus === 403 ? "forbidden" : "ready");
      if (readFailureStatus === 403) check("denied team content remains hidden", await panel.count(), 0);
      else check("failed reload retains eleven old rows", await panel.locator(".org-team-metrics b").first().textContent(), "11");
      const warning = page.locator(".team-create-read-failure");
      await warning.waitFor();
      check("new feedback stays white instead of inherited alert red", await warning.evaluate(n => getComputedStyle(n).backgroundColor), "rgb(255, 255, 255)");
      check("read explanation has readable navy on cool grey", await warning.locator(".team-create-read-explanation").evaluate(n => [getComputedStyle(n).color,getComputedStyle(n).backgroundColor]), ["rgb(23, 54, 111)","rgb(237, 242, 250)"]);
      check("eyebrow has no inherited warning background", await warning.locator(".team-create-read-eyebrow").evaluate(n => getComputedStyle(n).backgroundColor), "rgba(0, 0, 0, 0)");
      check("saved fact and read failure are distinct", await warning.locator("h3").textContent(), "团队已创建，列表暂未更新");
      check("read failure no longer overwritten by success kind", await page.locator(".org-admin-notice").getAttribute("data-kind"), "error");
      check("write completed once and form remains closed", await form.count(), 0);
      check("read-only recovery explanation visible", (await warning.textContent()).includes("不会再次创建团队"));
      await shot("saved-read-failed", ".team-create-read-failure");
      await warning.locator("summary").focus();
      await page.keyboard.press("Enter");
      check("technical details open with keyboard", await warning.locator("details").getAttribute("open"), "");
      const traces = await warning.locator("code").allTextContents();
      check("write trace remains the 201 response trace", traces[0], "p33-create-local-write");
      check("failed read has separate nonempty trace", Boolean(traces[1]) && traces[1] !== traces[0]);
      await shot("separate-traces", ".team-create-read-failure");
      failRead = false;
      holdRecoveryRead = true;
      await warning.getByRole("button", { name: "重新读取列表", exact: true }).click();
      await page.waitForFunction(() => document.querySelector(".team-create-read-failure")?.getAttribute("aria-busy") === "true");
      check("recovery has a disabled busy button", await warning.getByRole("button").isDisabled());
      check("retry issues no additional create", writes().length, 3);
      await shot("recovery-pending", ".team-create-read-failure");
      assert.equal(typeof releaseRead, "function");
      releaseRead();
      await page.waitForFunction(() => !document.querySelector(".team-create-read-failure"));
      check("successful recovery exposes actual twelve fixture rows", await panel.locator(".org-team-metrics b").first().textContent(), "12");
      check("recovery reports list update, not another creation", (await page.locator(".org-admin-notice").textContent()).includes("团队列表已更新。"));
      await shot("recovered", ".org-admin-notice");
`;

try {
  for (const status of statuses) {
    let code = (await readFile(base, "utf8")).replaceAll("\r\n", "\n");
    assert.equal(
      createHash("sha256").update(code).digest("hex"),
      expected,
      "Inspect changed r2 state driver",
    );
    const replace = (before, after) => {
      assert.equal(code.split(before).length, 2, `Inspect read-result driver anchor: ${before}`);
      code = code.replace(before, after);
    };
    code =
      `import { previewTeamsReadResult, teamsParentFile, teamsReadResultComponent } from "./lib/ui-phase2-teams-read-result-preview.mjs";\nconst readFailureStatus = ${status};\n` +
      code;
    replace(
      'const output = "output/playwright/p33-create-states-r2";',
      `const output = "output/playwright/p33-read-result-${status}-r2";`,
    );
    replace("[shellFile, teamsVueFile].map", "[shellFile, teamsVueFile, teamsParentFile].map");
    replace(
      "const replacements = new Map([",
      "const replacements = new Map([\n  [teamsParentFile, previewTeamsReadResult(originals.get(teamsParentFile))],",
    );
    replace(
      "const runs = [],",
      `for (const file of [teamsReadResultComponent,
      "scripts/lib/ui-phase2-teams-read-result-preview.mjs", "scripts/verify-ui-phase2-teams-read-result.mjs"
    ]) sources.add(file);
const runs = [],`,
    );
    replace(
      "    let releaseWrite;",
      "    let releaseWrite, releaseRead, holdRecoveryRead = false;",
    );
    replace(
      '        if (key === "GET /api/v1/org/admin/teams" && failRead)\n          return route.fulfill({ status: 500, json: {} });',
      `        if (key === "GET /api/v1/org/admin/teams" && failRead)
          return route.fulfill({ status: readFailureStatus, json: {} });
        if (key === "GET /api/v1/org/admin/teams" && holdRecoveryRead) {
          await new Promise((done) => { releaseRead = done; });
          releaseRead = undefined;
          holdRecoveryRead = false;
        }`,
    );
    const start = code.indexOf('      check(\n        "known OG-G02: stale eleven rows'),
      end = code.indexOf('      check("only three explicitly intercepted', start);
    assert.ok(start > 0 && end > start);
    code = code.slice(0, start) + scenario + code.slice(end);
    replace(
      '        "one initial and two post-save teams reads",\n        requests.filter((r) => r.key === "GET /api/v1/org/admin/teams").length,\n        3,',
      '        "initial, two post-save reads and explicit recovery",\n        requests.filter((r) => r.key === "GET /api/v1/org/admin/teams").length,\n        4,',
    );
    replace(
      '        knownUnresolved:\n          "OG-G02 write success masks reload failure; this is reproduced, not fixed or accepted.",',
      '        readFailureStatus,\n        remaining: "Preview correction only; real writes/RBAC and all other OG-G02 cases remain unverified.",',
    );
    replace("      releaseWrite?.();", "      releaseWrite?.();\n      releaseRead?.();");
    replace(
      '    kind: "P33-C-CREATE-STATES-r2",',
      '    kind: "P33-C-READ-RESULT-r2",\n    readFailureStatus,',
    );
    replace(
      "Actual App/router/unchanged parent.",
      "Actual App/router with scoped parent read-result preview.",
    );
    replace(
      "OG-G02 refresh failure overwrite reproduced, not fixed;",
      "P33 creation read-failure feedback corrected in this preview; other OG-G02/lifecycle cases remain;",
    );
    const ast = ts.createSourceFile(base, code, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements.filter(ts.isImportDeclaration).reverse()) {
      const specifier = node.moduleSpecifier.text;
      const resolved = specifier.startsWith(".")
        ? pathToFileURL(path.resolve(path.dirname(base), specifier)).href
        : import.meta.resolve(specifier);
      code =
        code.slice(0, node.moduleSpecifier.getStart(ast)) +
        JSON.stringify(resolved) +
        code.slice(node.moduleSpecifier.end);
    }
    await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
  }
} catch (error) {
  console.error(
    String(error?.stack ?? error).replaceAll(
      /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
      "p33-read-result-composed",
    ),
  );
  process.exitCode = 1;
}
