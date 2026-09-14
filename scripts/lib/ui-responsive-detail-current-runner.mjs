import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const originalDetailDriverHash =
  "f891a55fde3c5732f05e19266a4396a25280308d322cdbd3aba5bf2bfd6ae2ef";

// Adapt only the isolated test host. Actual Vue and all original assertions stay intact.
export function buildDetailCurrentRunner(source, appearance, reducedMotion) {
  assert.ok(["default", "governance", "content"].includes(appearance));
  assert.ok(["reduce", "no-preference"].includes(reducedMotion));
  let runner = source.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(runner).digest("hex"),
    originalDetailDriverHash,
    "Inspect the original driver before adapting changed tests",
  );
  function replace(before, after) {
    assert.equal(runner.split(before).length, 2, before);
    runner = runner.replace(before, after);
  }
  replace('const capture = process.argv.includes("--capture");', "const capture = false;");
  replace(
    'assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));',
    'assert.equal(process.argv.length, 2, "Current interaction verifier takes no arguments");',
  );
  replace("import {createApp,h,ref} from 'vue';", "import {createApp,h,ref,KeepAlive} from 'vue';");
  replace(
    "window.__fixture={rows,mounted,rich};",
    "const active=ref(true),Away={render:()=>h('p',{id:'away-page'},'缓存外页面')};\n" +
      "window.__fixture={rows,mounted,rich,active};",
  );
  replace(
    " mounted.value?h(View,{rows:rows.value,",
    ` mounted.value?h(KeepAlive,null,{default:()=>active.value?h(View,{appearance:'${appearance}',rows:rows.value,`,
  );
  replace(" }):null,", " }):h(Away)}):null,");
  replace('      reducedMotion: "reduce",', `      reducedMotion: "${reducedMotion}",`);
  replace(
    "          url.port === String(port) &&",
    '          route.request().method() === "GET" &&\n          url.port === String(port) &&',
  );
  replace(
    "      await page.goto(`http://127.0.0.1:${port}/__responsive_focus`);",
    "      await page.goto(`http://127.0.0.1:${port}/__responsive_focus`);\n" +
      "      await expect(page.locator('#background'), 'fixture must mount before keyboard checks').toBeVisible().catch(error => {\n" +
      `        throw new Error(JSON.stringify({appearance: '${appearance}', reducedMotion: '${reducedMotion}', width, errors, requests, failure: error.message}));\n` +
      "      });",
  );
  // Check local page errors and transport on desktop too, before its early continue.
  replace(
    '        await expect(page.getByRole("table")).toBeVisible();',
    '        await expect(page.getByRole("table")).toBeVisible();\n' +
      "        assert.deepEqual(errors, []);\n        assert.deepEqual(requests, []);",
  );
  replace(
    '      await expect(close).toBeFocused();\n      await expect(page.locator("#app")).toHaveAttribute("inert", "");',
    "      await expect(close).toBeFocused();\n" +
      `      await expect(page.locator('.responsive-data-view')).toHaveAttribute('data-appearance', '${appearance}');\n` +
      "      assert.deepEqual(await page.locator('.responsive-data-view__overlay').evaluate(node => ({\n" +
      "        governance: node.classList.contains('responsive-data-view__overlay--governance'),\n" +
      "        content: node.classList.contains('responsive-data-view__overlay--content')\n" +
      `      })), {governance: ${appearance === "governance"}, content: ${appearance === "content"}});\n` +
      (appearance === "default"
        ? ""
        : `      assert.deepEqual(await drawer.evaluate(node => {
        const style = getComputedStyle(node);
        return {background: style.backgroundColor, color: style.color,
          border: style.borderLeftColor, primary: style.getPropertyValue('--so-primary').trim()};
      }), {background: 'rgb(255, 255, 255)', color: 'rgb(23, 36, 61)',
        border: 'rgb(207, 217, 232)', primary: '${appearance === "governance" ? "#2d63cd" : "#2558bd"}'});
      checks.push({width, name: 'teleported drawer computed palette matches the existing C appearance'});
`) +
      '      await expect(page.locator("#app")).toHaveAttribute("inert", "");',
  );
  replace(
    "      await page.evaluate(() => (window.__fixture.mounted.value = false));",
    `      // Real Vue KeepAlive lifecycle, while the detail is open.
      await page.evaluate(() => (window.__fixture.active.value = false));
      await expect(page.locator('#away-page')).toBeVisible();
      await expect(drawer).toHaveCount(0);
      await restored();
      await page.locator('#background').click();
      await expect(page.locator('#background')).toBeFocused();
      await page.evaluate(() => (window.__fixture.active.value = true));
      await expect(trigger).toBeVisible();
      await expect(drawer).toHaveCount(0);
      await expect(page.locator('#background')).toBeFocused();
      await restored();
      await trigger.click();
      await expect(close).toBeFocused();
      for (const key of ['Tab', 'Shift+Tab']) {
        await page.keyboard.press(key);
        await expect(close).toBeFocused();
      }
      checks.push({width, name: 'actual KeepAlive exit releases inert; return does not reopen or steal focus; reopen traps both directions'});
      await page.evaluate(() => (window.__fixture.mounted.value = false));`,
  );
  replace(
    "  JSON.stringify({ checks: checks.length, screenshots: screenshots.length, processesClosed: true }),",
    `  JSON.stringify({ appearance: '${appearance}', reducedMotion: '${reducedMotion}', checks, screenshots: screenshots.length, processesClosed: true }),`,
  );
  return runner;
}
