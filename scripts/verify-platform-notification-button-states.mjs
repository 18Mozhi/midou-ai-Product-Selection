import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

// Actual dialog components, production CSS order, no business requests.
const flags = process.argv.slice(2),
  capture = flags.includes("--capture-review"),
  primary = flags.includes("--primary");
assert.ok(
  new Set(flags).size === flags.length &&
    flags.every((flag) => ["--capture-review", "--primary"].includes(flag)),
);
const modes = primary ? ["create", "edit", "publish"] : ["cancel"];
const reviewRoot = path.resolve(
  `design-plans/ui-phase-2-2026-09-07/design/platform-notifications-direction-c/${primary ? "primary-button-review-r1" : "button-review-r1"}`,
);
if (capture) await mkdir(reviewRoot);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const styles = [
  ...(await readFile("apps/web/src/main.ts", "utf8")).matchAll(/import "\.\/(.*?\.css)";/g),
];
const entry = "/__p57_buttons.js",
  routePath = "/__p57_buttons";
const host = `import {createApp,h,reactive} from 'vue';
import Dialog from '/src/components/PlatformNotificationActionDialog.vue';
import Editor from '/src/components/PlatformMessageEditor.vue';
import '/src/platform-notifications.css';
${styles.map((m) => `import '/src/${m[1]}';`).join("\n")}
import {applyTheme,applyDensity} from '/src/design/theme';
const params=new URLSearchParams(location.search);
const mode=params.get('mode'),editing=mode==='edit',isEditor=editing||mode==='create';
document.documentElement.dataset.design='signal-ledger';
applyTheme(params.get('theme'),false);applyDensity(params.get('density'));
const state=window.fixture=reactive({open:false,reason:'有效操作原因',submitting:false,writes:0});
const form=reactive({kind:'notification',title:'标题样例',body:'正文样例',category:'system',severity:'info',audience_type:'all_users',organization_id:'',user_id:'',in_app_enabled:true,email_enabled:false,reason:'编辑平台消息',expected_version:editing?3:1});
const submit=()=>{state.writes++;state.submitting=true;};
createApp({render:()=>h('section',{class:'platform-notifications'},[h('button',{onClick:()=>state.open=true},'打开测试窗口'),isEditor?h(Editor,{
 open:state.open,editor:{id:editing?'fixture':''},form,saving:state.submitting,error:'',audienceOptions:{organizations:[],users:[]},onClose:()=>state.open=false,onSave:submit
}):h(Dialog,{
 open:state.open,target:{title:'通知控件本地样例',version:3},action:mode,error:'',
 reason:state.reason,submitting:state.submitting,'onUpdate:reason':value=>state.reason=value,
 onClose:()=>state.open=false,onSubmit:submit
})])}).mount('#app');`;
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, open: false, proxy: {} },
  plugins: [
    {
      name: "p57-button-fixture",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== routePath) return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P57按钮验证</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const results = [],
  failures = [],
  images = [];
let browser;
async function sample(button) {
  return button.evaluate((el) => {
    const css = getComputedStyle(el);
    const token = (name) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${name})`;
      el.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    return {
      color: css.color,
      border: css.borderTopColor,
      background: css.backgroundColor,
      outline: css.outlineColor,
      outlineWidth: css.outlineWidth,
      outlineStyle: css.outlineStyle,
      opacity: css.opacity,
      cursor: css.cursor,
      disabled: el.disabled,
      hover: el.matches(":hover"),
      focus: el.matches(":focus-visible"),
      active: el.matches(":active"),
      danger: token("--so-platform-notification-danger"),
      primary: token("--so-platform-notification-primary"),
      primaryStrong: token("--so-platform-notification-primary-strong"),
      surface: token("--so-platform-notification-surface"),
      focusToken: token("--so-platform-notification-focus"),
    };
  });
}
async function record(page, button, identity, state) {
  // Poll computed CSS, including transitions, before asserting stable visual state.
  const check = async () => {
    const value = await sample(button);
    if (identity.mode === "cancel") {
      assert.equal(value.color, value.danger, `${state}: danger text must remain red`);
      assert.equal(value.border, value.danger, `${state}: danger border must remain red`);
    } else {
      assert.equal(value.color, value.surface, `${state}: primary text must remain white`);
      const expectedBackground =
        ["create", "edit"].includes(identity.mode) &&
        value.hover &&
        !identity.touch &&
        !value.disabled
          ? value.primaryStrong
          : value.primary;
      assert.equal(value.background, expectedBackground, `${state}: primary background token`);
      assert.equal(value.border, expectedBackground, `${state}: primary border token`);
      assert.notEqual(
        value.color,
        value.background,
        `${state}: primary text cannot disappear into background`,
      );
      if (!value.disabled) {
        const luminance = (color) =>
          color
            .match(/\d+/g)
            .slice(0, 3)
            .map(Number)
            .map((v) => v / 255)
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const light = luminance(value.color),
          dark = luminance(value.background);
        assert.ok(
          (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05) >= 4.5,
          `${state}: enabled primary text contrast`,
        );
      }
    }
    if (state.includes("focus")) {
      assert.equal(value.focus, true);
      assert.equal(value.outline, value.focusToken, `${state}: keyboard ring must use local blue`);
      assert.ok(parseFloat(value.outlineWidth) >= 2);
      assert.notEqual(value.outlineStyle, "none");
    }
    if (
      (state.startsWith("invalid") && !["create", "edit"].includes(identity.mode)) ||
      state === "submitting"
    ) {
      assert.equal(value.disabled, true);
      assert.ok(Number(value.opacity) < 1);
      assert.equal(value.cursor, "not-allowed");
    }
    return value;
  };
  try {
    await expect(async () => {
      await check();
    }).toPass({ timeout: 1200 });
  } catch (error) {
    failures.push({
      ...identity,
      state,
      observed: await sample(button),
      error: error.message.split("\n")[0],
    });
  }
  results.push({ ...identity, state, ...(await sample(button)) });
  if (
    capture &&
    identity.theme === "deep-ocean" &&
    identity.density === "compact" &&
    !identity.touch &&
    identity.mode !== "edit" &&
    ["default", "hover-focus", "invalid", "submitting"].includes(state)
  ) {
    const footer = page.locator("dialog[open] footer");
    await footer.scrollIntoViewIfNeeded();
    const box = await footer.boundingBox(),
      viewport = page.viewportSize();
    const clip = {
      x: Math.max(0, box.x - 7),
      y: Math.max(0, box.y - 7),
      width: Math.min(viewport.width, box.x + box.width + 7) - Math.max(0, box.x - 7),
      height: Math.min(viewport.height, box.y + box.height + 7) - Math.max(0, box.y - 7),
    };
    const file = `P57-${identity.width}-${identity.mode}-${state}.png`;
    const bytes = await page.screenshot({
      path: path.join(reviewRoot, file),
      clip,
      animations: "disabled",
    });
    images.push({
      file,
      sha256: sha256(bytes),
      state,
      approval: "pending-user-review",
      scope: "footer only, isolated Vue, local fixture",
    });
  }
}
try {
  await server.listen();
  const port = server.httpServer.address().port;
  console.log(`p57_buttons_host=http://127.0.0.1:${port} pid=${process.pid}`);
  browser = await chromium.launch();
  for (const mode of modes)
    for (const width of [390, 1440])
      for (const theme of ["deep-ocean", "aurora-purple", "cloud-white"])
        for (const density of ["standard", "compact"])
          for (const touch of [false, true]) {
            const identity = { width, theme, density, touch, mode },
              isEditor = ["create", "edit"].includes(mode);
            const context = await browser.newContext({
              viewport: { width, height: 900 },
              hasTouch: touch,
              reducedMotion: "reduce",
            });
            try {
              const page = await context.newPage(),
                unexpected = [],
                errors = [];
              page.on("pageerror", (error) => errors.push(error.message));
              await page.route("**/*", (route) => {
                const url = new URL(route.request().url());
                if (
                  url.hostname === "127.0.0.1" &&
                  url.port === String(port) &&
                  route.request().method() === "GET" &&
                  !url.pathname.startsWith("/api/")
                )
                  return route.continue();
                unexpected.push(url.href);
                return route.abort();
              });
              await page.goto(
                `http://127.0.0.1:${port}${routePath}?theme=${theme}&density=${density}&mode=${mode}`,
              );
              assert.deepEqual(
                await page.evaluate(() => ({
                  coarse: matchMedia("(pointer: coarse)").matches,
                  hover: matchMedia("(hover: hover)").matches,
                  theme: document.documentElement.dataset.theme,
                  density: document.documentElement.dataset.density,
                })),
                { coarse: touch, hover: !touch, theme, density },
              );
              await page.getByRole("button", { name: "打开测试窗口" }).click();
              const dialog = page.getByRole("dialog", {
                  name: isEditor
                    ? mode === "edit"
                      ? "编辑平台消息草稿"
                      : "新建平台消息草稿"
                    : mode === "publish"
                      ? "填写发布原因"
                      : "填写取消草稿原因",
                }),
                field = dialog.getByLabel(isEditor ? "标题" : "操作原因"),
                button = dialog.getByRole("button", {
                  name: isEditor ? "保存草稿" : mode === "publish" ? "确认发布" : "确认取消草稿",
                  exact: true,
                });
              await expect(field).toBeFocused();
              await button.scrollIntoViewIfNeeded();
              await record(page, button, identity, "default");
              if (!touch) {
                await button.hover();
                await expect(button).toBeEnabled();
                assert.equal((await sample(button)).hover, true);
                await record(page, button, identity, "hover");
                await page.mouse.move(0, 0);
              }
              await dialog.locator("footer button").first().focus();
              await page.keyboard.press("Tab");
              await expect(button).toBeFocused();
              await record(page, button, identity, "focus");
              if (!touch) {
                await button.hover();
                await record(page, button, identity, "hover-focus");
                await page.mouse.down();
                assert.equal((await sample(button)).active, true);
                await record(page, button, identity, "active");
                // Release outside: inspect pressed visuals without submitting a synthetic action.
                await page.mouse.move(0, 0);
                await page.mouse.up();
              }
              await field.fill("字");
              if (isEditor) {
                await expect(button).toBeEnabled();
                await button.click();
                assert.equal(await field.evaluate((el) => el.validity.tooShort), true);
                await expect(field).toBeFocused();
                await page.mouse.move(0, 0);
              } else await expect(button).toBeDisabled();
              await record(page, button, identity, "invalid");
              if (!touch) {
                await button.scrollIntoViewIfNeeded();
                const box = await button.boundingBox();
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                assert.equal((await sample(button)).hover, true, JSON.stringify(identity));
                await record(page, button, identity, "invalid-hover");
                await page.mouse.move(0, 0);
              }
              await expect.poll(() => page.evaluate(() => window.fixture.writes)).toBe(0);
              await field.fill("有效操作原因");
              if (touch) await button.tap();
              else await button.click();
              await expect(
                dialog.getByRole("button", { name: isEditor ? "保存中…" : "提交中…" }),
              ).toBeDisabled();
              const pending = dialog.getByRole("button", {
                name: isEditor ? "保存中…" : "提交中…",
              });
              await record(page, pending, identity, "submitting");
              await expect(dialog.locator("form")).toHaveAttribute("aria-busy", "true");
              await expect(field).toBeDisabled();
              await expect.poll(() => page.evaluate(() => window.fixture.writes)).toBe(1);
              await expect(
                dialog.getByRole("button", { name: isEditor ? "关闭" : "取消", exact: true }),
              ).toBeEnabled();
              assert.deepEqual(unexpected, []);
              assert.deepEqual(errors, []);
              if (primary && failures.length)
                throw new Error(
                  JSON.stringify({
                    completed: results.length,
                    failed: failures.length,
                    examples: failures.slice(0, 3),
                  }),
                );
            } finally {
              await context.close();
            }
          }
  console.log(
    JSON.stringify({
      contexts: 24 * modes.length,
      states: results.length,
      failed: failures.length,
      examples: failures.slice(0, 5),
    }),
  );
  assert.equal(failures.length, 0, "Button-state failures are reported above");
  if (capture) {
    const files = new Set([
      "scripts/verify-platform-notification-button-states.mjs",
      "apps/web/src/main.ts",
      "apps/web/vite.config.ts",
      "package-lock.json",
    ]);
    for (const mod of server.moduleGraph.idToModuleMap.values())
      if (
        mod.file?.replaceAll("\\", "/").includes("/apps/web/src/") &&
        /\.(vue|ts|css)$/.test(mod.file)
      )
        files.add(path.relative(process.cwd(), mod.file).replaceAll("\\", "/"));
    const sources = Object.fromEntries(
      await Promise.all(
        [...files].sort().map(async (file) => [file, sha256(await readFile(file))]),
      ),
    );
    await writeFile(
      path.join(reviewRoot, "manifest.json"),
      JSON.stringify(
        {
          scope:
            "P57 dialog footer; themes/densities and emulated coarse/fine pointer, not real-device/full App/full accessibility acceptance",
          images,
          sources,
          results,
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  await browser?.close();
  await server.close();
  console.log(
    `p57_buttons_cleanup=browser-and-server-closed; ${capture ? "review packet retained" : "no artifacts written"}`,
  );
}
