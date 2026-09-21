import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { teamsAnchorBase, teamsAnchorDriver } from "./lib/ui-phase2-teams-anchor-driver.mjs";

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every((arg) => ["--smoke", "--capture"].includes(arg)));
const capture = args.includes("--capture");
const output = "output/playwright/p33-create-focus-r1";
if (capture) await mkdir(output); // Formal before/after evidence, never overwrite.
process.argv = [process.argv[0], process.argv[1], ...(args.includes("--smoke") ? ["--smoke"] : [])];

const scenario = `
        const trigger = panel.locator(".org-team-overview button");
        check("cancel focus returns only in revised preview", await trigger.evaluate((n) =>
          document.activeElement === n), focusRevision === "revised");
        check("initial cancel preserves original clear-and-close behavior", await form.count(), 0);
        await trigger.focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => document.activeElement?.id === "team-name");
        check("cancel cleared name", await panel.locator("#team-name").inputValue(), "");
        check("cancel cleared reason", await panel.locator("#team-reason").inputValue(), "");
        if (focusRevision === "revised") {
          check("create trigger exposes expanded state", await trigger.getAttribute("aria-expanded"), "true");
          check("expanded control references the actual form", await trigger.getAttribute("aria-controls"),
            await form.getAttribute("id"));
        }
        await panel.locator("#team-name").fill("键盘取消样例，不提交");
        await page.keyboard.press("Shift+Tab");
        check("Shift Tab reaches inline cancel", await form.getByRole("button", { name: "取消", exact: true })
          .evaluate((n) => n === document.activeElement));
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => !document.querySelector(".org-team-create"));
        check("keyboard cancel returns only in revised preview", await trigger.evaluate((n) =>
          n === document.activeElement), focusRevision === "revised");
        if (focusRevision === "revised") {
          check("collapsed state exposed", await trigger.getAttribute("aria-expanded"), "false");
          check("no dangling control reference when form is removed", await trigger.getAttribute("aria-controls"), null);
          check("restored keyboard focus visible and not occluded", await trigger.evaluate((n) => {
            const r = n.getBoundingClientRect(), s = getComputedStyle(n);
            return n.matches(":focus-visible") && parseFloat(s.outlineWidth) > 0 && s.outlineStyle !== "none" &&
              r.top >= 0 && r.bottom <= innerHeight &&
              document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === n;
          }));
        }
        if (focusCapture) {
          await page.evaluate(() => document.fonts.ready);
          const bytes = await page.screenshot({ animations: "disabled" });
          const file = focusRevision + "-" + width + "-keyboard-cancel.png";
          await writeFile(focusOutput + "/" + file, bytes);
          focusScreenshots.push({ file, width, height: 1000, sha256: hash(bytes) });
        }
`;

try {
  for (const revision of ["original", "revised"]) {
    let code = teamsAnchorDriver(await readFile(teamsAnchorBase, "utf8"));
    const replace = (before, after) => {
      assert.equal(code.split(before).length, 2, `Inspect create-focus driver anchor: ${before}`);
      code = code.replace(before, after);
    };
    if (revision === "revised") {
      const helper = pathToFileURL(
        path.resolve("scripts/lib/ui-phase2-teams-create-focus-preview.mjs"),
      ).href;
      code = `import { previewTeamsCreateFocus } from ${JSON.stringify(helper)};\n` + code;
      replace(
        "previewTeamsVue(originals.get(teamsVueFile))",
        "previewTeamsCreateFocus(originals.get(teamsVueFile))",
      );
    }
    code =
      `const focusRevision=${JSON.stringify(revision)}, focusCapture=${capture}, focusOutput=${JSON.stringify(output)}, focusScreenshots=[];\n` +
      code;
    replace(
      "const runs = [],",
      `for (const file of [
      "scripts/lib/ui-phase2-teams-create-focus-preview.mjs",
      "scripts/lib/ui-phase2-teams-anchor-driver.mjs",
      "scripts/verify-ui-phase2-teams-create-focus.mjs",
    ]) sources.add(file);
const runs = [],`,
    );
    const closed =
      '        await page.waitForFunction(() => !document.querySelector(".org-team-create"));';
    replace(closed, closed + scenario);
    replace(
      '    kind: "P33-C-ANCHOR-INTERACTIONS-r1",',
      '    kind: "P33-C-CREATE-FOCUS-r1",\n    focusRevision, focusScreenshots,',
    );
    replace(
      "    boundary:\n",
      '    focusBoundary: "Local before/after inline cancel only. Original r4 layout and production untouched. No writes, success-response focus or complete page acceptance.",\n    boundary:\n',
    );
    replace(
      "Review adds layout, CSS and native list semantics only; current team script/events/models preserved.",
      "Original run uses r4 C layout unchanged. Revised run additionally scopes creation input focus, restores inline cancel focus and exposes expansion semantics; submitCreate/performMemberAction and field models remain unchanged.",
    );
    replace(
      "  if (capture) {\n    await writeFile",
      '  if (focusCapture) await writeFile(focusOutput + "/" + focusRevision + "-evidence.json", JSON.stringify(evidence, null, 2) + "\\n");\n  if (capture) {\n    await writeFile',
    );
    replace(
      "      screenshots: screenshots.length,",
      "      focusRevision,\n      screenshots: focusScreenshots.length,",
    );
    await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
  }
} catch (error) {
  console.error(
    String(error?.stack ?? error).replaceAll(
      /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
      "p33-create-focus-composed",
    ),
  );
  process.exitCode = 1;
}
