import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeSpec, dialogVariants, direction } from "./assets/design-data.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const catalogPath = path.join(repo, "apps/web/src/route-catalog.generated.json");
const webSource = path.join(repo, "apps/web/src");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const routes = catalog.routes;
const mobileOnly = process.argv.includes("--mobile-only");
const desktopOnly = process.argv.includes("--desktop-only");

const slug = (value) => value === "/" ? "root" : value.replace(/^\//, "").replaceAll("/", "__").replaceAll(":", "").replace(/[()*]/g, "").replaceAll(".", "-");
const rel = (value) => value.split(path.sep).join("/");
const lineAt = (source, index) => source.slice(0, index).split("\n").length;
const clean = (value) => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().replaceAll("|", "\\|");

await mkdir(path.join(here, "screens/desktop"), { recursive: true });
await mkdir(path.join(here, "screens/mobile"), { recursive: true });
await mkdir(path.join(here, "boards"), { recursive: true });
await writeFile(path.join(here, "assets/catalog.generated.mjs"), `export const routes = ${JSON.stringify(routes, null, 2)};\n`, "utf8");

const pageRows = routes.map((route, index) => {
  const spec = routeSpec(route), id = String(index + 1).padStart(2, "0"), name = `${id}-${slug(route.path)}.png`;
  return `| ${id} | ${route.title} | \`${route.path}\` | ${route.shell || "公开/账号"} | ${spec.layout} | ${spec.focus} | [桌面](screens/desktop/${name}) / [移动](screens/mobile/${name}) |`;
});
await writeFile(path.join(here, "page-matrix.md"), `# ScoutOps 全页面 UI 优化矩阵\n\n- 路由依据：\`apps/web/src/route-catalog.generated.json\`\n- 设计方向：${direction.name}\n- 覆盖：${routes.length} 条真实路由；每条均有桌面与 390px 移动稿。\n\n| # | 页面 | 路由 | 角色 | 推荐布局 | 首要焦点 | 设计图 |\n| --- | --- | --- | --- | --- | --- | --- |\n${pageRows.join("\n")}\n`, "utf8");

async function listFiles(root) {
  const { readdir } = await import("node:fs/promises"), entries = await readdir(root, { withFileTypes: true }), out = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else if (entry.name.endsWith(".vue")) out.push(full);
  }
  return out;
}

const vueFiles = await listFiles(webSource), buttons = [], dialogs = [];
for (const file of vueFiles) {
  const source = await readFile(file, "utf8"), fileName = rel(path.relative(repo, file));
  for (const match of source.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attrs = match[1], body = clean(match[2]), aria = attrs.match(/aria-label="([^"]+)"/)?.[1], dynamicAria = attrs.match(/:aria-label="([^"]+)"/)?.[1];
    const label = body || aria || (dynamicAria ? `动态：${dynamicAria}` : "图标按钮（需运行时名称）");
    const role = /danger|destructive|delete|删除|停用|暂停|回滚/.test(`${attrs} ${label}`) ? "危险" : /primary|submit/.test(attrs) ? "主/提交" : /icon|aria-label/.test(attrs) && !body ? "图标" : "次/上下文";
    buttons.push([buttons.length + 1, `${fileName}:${lineAt(source, match.index)}`, label, role]);
  }
  for (const match of source.matchAll(/<(dialog)\b([^>]*)>|<[^>]+role="dialog"[^>]*>/g)) {
    const text = source.slice(match.index, match.index + 800), title = clean(text.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/)?.[1] || match[0].match(/aria-label="([^"]+)"/)?.[1] || "动态弹窗");
    const kind = /Credential|凭证|密钥/.test(`${fileName} ${title}`) ? "敏感输入" : /Reason|理由|审核/.test(`${fileName} ${title}`) ? "审计理由" : /Create|Wizard|创建/.test(`${fileName} ${title}`) ? "创建向导" : /Detail|详情/.test(`${fileName} ${title}`) ? "记录详情" : /Confirm|Delete|删除|暂停|回滚/.test(`${fileName} ${title}`) ? "高影响确认" : "业务弹窗";
    dialogs.push([dialogs.length + 1, `${fileName}:${lineAt(source, match.index)}`, title || "动态弹窗", kind]);
  }
}

const buttonRows = buttons.map(([id, loc, label, role]) => `| ${id} | [${loc}](${path.posix.join("../..", loc.split(":")[0])}#L${loc.split(":").pop()}) | ${label} | ${role} |`).join("\n");
await writeFile(path.join(here, "button-inventory.md"), `# 按钮逐项清单\n\n共扫描 ${buttons.length} 个真实 \`<button>\`。视觉稿不改变业务语义；统一要求 44px 热区、默认/悬停/聚焦/按下/禁用/处理中六态，图标按钮必须有可读名称。完整状态图见 [按钮系统](boards/button-system.png)。\n\n| # | 源码位置 | 当前文字或表达式 | 建议层级 |\n| --- | --- | --- | --- |\n${buttonRows}\n`, "utf8");
const dialogRows = dialogs.map(([id, loc, title, kind]) => `| ${id} | [${loc}](${path.posix.join("../..", loc.split(":")[0])}#L${loc.split(":").pop()}) | ${title} | ${kind} |`).join("\n");
await writeFile(path.join(here, "dialog-inventory.md"), `# 弹窗逐项清单\n\n共扫描 ${dialogs.length} 个 \`<dialog>\` / \`role="dialog"\` 实例。统一要求：标题即动作、影响范围置顶、取消可达、Esc 语义明确、提交失败留在当前弹窗、技术标识折叠。对应 10 类图见 \`boards/dialog-*.png\`。\n\n| # | 源码位置 | 当前标题 | 归一类型 |\n| --- | --- | --- | --- |\n${dialogRows}\n`, "utf8");

const contentTypes = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".md": "text/markdown; charset=utf-8" };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1"), requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const file = path.resolve(here, `.${requested}`);
    if (!file.startsWith(here) || !existsSync(file)) throw new Error("not found");
    response.writeHead(200, { "content-type": contentTypes[path.extname(file)] || "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404); response.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port, base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });

async function captureRoute(route, index, viewport, folder) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(`${base}/screen.html?route=${encodeURIComponent(route.path)}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(here, `screens/${folder}/${String(index + 1).padStart(2, "0")}-${slug(route.path)}.png`), fullPage: true });
  await page.close();
}
for (let start = 0; start < routes.length; start += 4) {
  const batch = routes.slice(start, start + 4);
  await Promise.all(batch.flatMap((route, offset) => mobileOnly
    ? [captureRoute(route, start + offset, { width: 390, height: 844 }, "mobile")]
    : desktopOnly
      ? [captureRoute(route, start + offset, { width: 1440, height: 1000 }, "desktop")]
      : [
          captureRoute(route, start + offset, { width: 1440, height: 1000 }, "desktop"),
          captureRoute(route, start + offset, { width: 390, height: 844 }, "mobile"),
        ]));
  process.stdout.write(`pages ${Math.min(start + 4, routes.length)}/${routes.length}\n`);
}
for (const board of mobileOnly ? [] : ["tokens", "buttons", "states"]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/system.html?board=${board}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(here, `boards/${board === "tokens" ? "design" : board}-system.png`), fullPage: true });
  await page.close();
}
for (const [id] of mobileOnly ? [] : dialogVariants) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/system.html?board=dialog&variant=${id}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(here, `boards/dialog-${id}.png`), fullPage: true });
  await page.close();
}
await browser.close();
await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
console.log(`generated ${mobileOnly ? routes.length : desktopOnly ? routes.length + 13 : routes.length * 2 + 13} images, ${buttons.length} buttons, ${dialogs.length} dialogs`);
