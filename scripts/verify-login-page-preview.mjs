import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { loginPagePlugin, loginPageSources } from "./lib/login-page-preview.mjs";

const args = process.argv.slice(2);
const smoke = process.env.P02_SMOKE === "1";
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);

const widths = process.env.P02_VIEWPORT
  ? [Number.parseInt(process.env.P02_VIEWPORT, 10)]
  : smoke
    ? [390]
    : [1440, 390];
const motions = process.env.P02_MOTION
  ? [process.env.P02_MOTION]
  : smoke
    ? ["reduce"]
    : ["reduce", "no-preference"];
assert.deepEqual(
  widths.every((value) => [390, 1440].includes(value)),
  true,
);
assert.deepEqual(
  motions.every((value) => ["reduce", "no-preference"].includes(value)),
  true,
);

const output = args.length
  ? path.resolve(`output/playwright/p02-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output, { recursive: true });
const previous = output
  ? await readFile(path.join(output, "manifest.json"), "utf8")
      .then(JSON.parse)
      .catch(() => null)
  : null;

const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));

const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [loginPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});

const hash = (value) => createHash("sha256").update(value).digest("hex");
const images = [];
const results = [];
let browser;

try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P02 actual Vue review ${origin}`);

  for (const width of widths) {
    for (const motion of motions) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const errors = [];
      const unexpected = [];
      const requests = [];
      let loginRequests = 0;
      let checks = 0;

      const check = (actual, expected, label) => {
        assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`);
        checks++;
      };
      const capture = async (page, name) => {
        await page.evaluate(
          () =>
            new Promise((resolve) => {
              window.scrollTo(0, 0);
              requestAnimationFrame(() => {
                window.scrollTo(0, 0);
                resolve();
              });
            }),
        );
        const bytes = await page.screenshot({ animations: "disabled" });
        const file = `${width}-${name}.png`;
        await writeFile(path.join(output, file), bytes);
        images.push({
          file,
          sha256: hash(bytes),
          pixelWidth: bytes.readUInt32BE(16),
          pixelHeight: bytes.readUInt32BE(20),
        });
      };

      try {
        context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
        await context.route("**/*", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== origin) return route.abort();
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (request.method() !== "POST" || url.pathname !== "/api/v1/auth/login") {
            unexpected.push(`${request.method()} ${url.pathname}`);
            return route.abort();
          }
          requests.push({
            method: request.method(),
            path: url.pathname,
            body: request.postDataJSON(),
          });
          loginRequests++;
          return route.fulfill({
            status: 202,
            json: {
              data:
                loginRequests === 1
                  ? { mfa_required: true }
                  : {
                      security_setup: {
                        required: true,
                        must_change_password: true,
                        must_enroll_mfa: true,
                      },
                    },
              request_id: loginRequests === 1 ? "p02-mfa-review" : "p02-seed-review",
              trace_id: loginRequests === 1 ? "p02-mfa-review" : "p02-seed-review",
            },
          });
        });

        const page = await context.newPage();
        await page.goto(origin + "/login", { waitUntil: "domcontentloaded" });
        const root = page.locator(".identity-page--review");
        await root.waitFor();
        check(await root.locator("h1").count(), 1, "single task h1");
        check(await root.locator(".identity-story").count(), 0, "old marketing side rail removed");
        check(await page.getByLabel("账号").count(), 1, "identifier input is visible");
        check(await page.getByLabel("密码").count(), 1, "password input is visible");
        check(
          await root.getByRole("button", { name: "登录", exact: true }).count(),
          1,
          "one primary login action",
        );
        check(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          "login has no overflow",
        );
        const loginButton = root.getByRole("button", { name: "登录", exact: true });
        if (output && motion === "reduce") await capture(page, "login");
        await loginButton.focus();
        check(
          await loginButton.evaluate((node) => getComputedStyle(node).outlineWidth),
          "3px",
          "login focus visible",
        );
        await page.getByLabel("账号").fill("member@example.test");
        await page.getByLabel("密码").fill("Long-enough-password-123!");
        await loginButton.click();
        await page.getByLabel("认证器验证码或恢复码").waitFor();
        check(await root.getAttribute("data-mode"), "mfa-challenge", "login enters MFA challenge");
        check(
          await root.getByText("密码已验证，请输入认证器验证码或恢复码。", { exact: true }).count(),
          1,
          "challenge explains its safety boundary",
        );
        check(
          await root.locator(".p02-context li.is-current").getByText("认证器挑战").count(),
          1,
          "challenge step current",
        );
        if (output && motion === "reduce") await capture(page, "challenge");
        check(
          requests[0],
          {
            method: "POST",
            path: "/api/v1/auth/login",
            body: { identifier: "member@example.test", password: "Long-enough-password-123!" },
          },
          "MFA login request contract",
        );

        const seed = await context.newPage();
        await seed.goto(origin + "/login?mode=login&review=seed", {
          waitUntil: "domcontentloaded",
        });
        await seed.getByLabel("账号").fill("seed@example.test");
        await seed.getByLabel("密码").fill("Long-enough-password-456!");
        await seed.getByRole("button", { name: "登录", exact: true }).click();
        await seed.getByTestId("security-setup").waitFor();
        const seedRoot = seed.locator(".identity-page--review");
        check(
          await seedRoot.getAttribute("data-mode"),
          "security-setup",
          "login enters seed security setup",
        );
        check(
          await seed.getByRole("button", { name: "修改密码并撤销当前会话", exact: true }).count(),
          1,
          "seed setup preserves its forced change action",
        );
        check(
          await seed.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          "seed setup has no overflow",
        );
        if (output && motion === "reduce") await capture(seed, "seed-setup");
        check(
          requests[1],
          {
            method: "POST",
            path: "/api/v1/auth/login",
            body: { identifier: "seed@example.test", password: "Long-enough-password-456!" },
          },
          "seed login request contract",
        );
        check(unexpected, [], "no unexpected api");
        check(errors, [], "no page errors");
        results.push({ width, motion, checks, requests: requests.length });
        console.log(JSON.stringify({ width, motion, checks, requests: requests.length }));
      } finally {
        await context.close();
      }
    }
  }

  const sources = new Set(loginPageSources);
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    const file = module.file && path.relative(process.cwd(), module.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css|json)$/.test(file)
    )
      sources.add(file);
  }
  const allImages = [...(previous?.images ?? []), ...images]
    .filter(
      (item, index, values) => values.findLastIndex((value) => value.file === item.file) === index,
    )
    .sort((a, b) => a.file.localeCompare(b.file));
  const allResults = [...(previous?.results ?? []), ...results]
    .filter(
      (item, index, values) =>
        values.findLastIndex(
          (value) => value.width === item.width && value.motion === item.motion,
        ) === index,
    )
    .sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion));
  if (output)
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P02",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "local actual Vue C review; login responses are locally intercepted for MFA and seed setup only",
          sources: Object.fromEntries(
            await Promise.all(
              [...sources].sort().map(async (file) => [file, hash(await readFile(file))]),
            ),
          ),
          images: allImages,
          results: allResults,
        },
        null,
        2,
      ) + "\n",
    );
  console.log(
    JSON.stringify({
      groups: allResults.length,
      checks: allResults.reduce((sum, result) => sum + result.checks, 0),
      requests: allResults.reduce((sum, result) => sum + result.requests, 0),
      images: allImages.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
