import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

export const readReviewSource = async (file) =>
  (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
export const reviewHash = (value) => createHash("sha256").update(value).digest("hex");

// Local-only actual Vue host. The caller must intercept API traffic before navigating.
export async function withVueReview({ pageId, routePath, transforms, styles, files }, run) {
  const component = "apps/web/src/components/PlatformAccountCenter.vue";
  const cssFiles = [
    ...(await readReviewSource("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
  ].map((m) => "apps/web/src/" + m[1]);
  const sources = new Set([
    component,
    ...styles,
    ...cssFiles,
    ...files,
    "apps/web/src/main.ts",
    "apps/web/vite.config.ts",
    "scripts/lib/ui-phase2-vue-review-host.mjs",
  ]);
  async function imports(file) {
    for (const m of (await readReviewSource(file)).matchAll(
      /(?:from\s+|import\s*|src=)["'](\.[^"']+)["']/g,
    )) {
      let candidate = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
      if (!path.posix.extname(candidate)) candidate += ".ts";
      if (sources.has(candidate)) continue;
      sources.add(candidate);
      await imports(candidate);
    }
  }
  // Scripts and source helper imports are evidence dependencies too.
  for (const file of [component, ...files.filter((file) => file.startsWith("scripts/"))])
    await imports(file);
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      [...sources].sort().map(async (f) => [f, reviewHash(await readReviewSource(f))]),
    ),
  );
  const originals = {},
    transformed = {};
  for (const [file, transform] of Object.entries(transforms)) {
    assert.ok(sources.has(file), `Missing transform source binding: ${file}`);
    originals[file] = await readReviewSource(file);
    transformed[file] = transform(originals[file]);
  }
  const transformedHashes = Object.fromEntries(
    Object.entries(transformed).map(([f, s]) => [f, reviewHash(s)]),
  );
  const entry = `/__${pageId.toLowerCase()}_vue_review.js`;
  const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory,useRoute} from 'vue-router';import Current from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
${styles.map((f) => `import '/@fs/${path.resolve(f).replaceAll("\\", "/")}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p39-filter-preview','p39-create-preview','p39-page-preview','p40-list-preview');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const app=createApp({setup(){const route=useRoute();return()=>h('main',[h('p',{class:'preview-disclaimer'},'${pageId} / C方向 · 实际Vue逻辑 + 审核模板与样式 · 测试数据，未上线'),h(Current,{apiBaseUrl:'/api/v1',routePath:route.path,organizationId:route.path.startsWith('${routePath}/')&&!route.path.endsWith('/new')?route.path.split('/').at(-1):''})])}}).use(router);await router.isReady();app.mount('#app');`;
  const probe = reservePort();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const server = await createServer({
    configFile: path.resolve("apps/web/vite.config.ts"),
    logLevel: "error",
    server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
    plugins: [
      {
        name: "isolated-vue-review",
        enforce: "pre",
        resolveId: (id) => (id === entry ? entry : undefined),
        load: (id) => (id === entry ? host : undefined),
        transform(source, id) {
          for (const [file, code] of Object.entries(transformed)) {
            if (id.replaceAll("\\", "/") !== path.resolve(file).replaceAll("\\", "/")) continue;
            assert.equal(source.replaceAll("\r\n", "\n"), originals[file]);
            return { code, map: null };
          }
          return null;
        },
        configureServer(instance) {
          instance.middlewares.use((req, res, next) => {
            if (!req.url?.split("?")[0].startsWith(routePath)) return next();
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(
              `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${pageId} Vue审核</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
            );
          });
        },
      },
    ],
  });
  let browser;
  try {
    await server.listen();
    const origin = `http://127.0.0.1:${port}`;
    console.log(`vue_review_host ${origin}`);
    browser = await chromium.launch();
    return await run({ browser, origin, sourceHashes, transformedHashes });
  } finally {
    await browser?.close();
    await server.close();
  }
}
