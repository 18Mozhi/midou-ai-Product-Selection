import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { chromium } from "playwright";
import { buildOrgDataDesignData } from "./lib/ui-phase2-org-data-design-data.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)) && !(capture && smoke),
);
const root = "design-plans/ui-phase-2-2026-09-07/design";
const design = `${root}/org-data-fields`,
  output = "output/playwright/p35-fields-review";
const source = "apps/web/src/components/OrganizationDataPanel.vue";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const plain = (v) => JSON.parse(JSON.stringify(v));
const child = await text(source),
  fixture = await buildOrgDataDesignData(process.cwd());
const sourceHashes = {};
for (const f of [
  source,
  "tests/e2e/m06-01-organization-admin.spec.ts",
  "scripts/lib/ui-phase2-org-data-design-data.mjs",
  "scripts/verify-ui-phase2-org-data-fields.mjs",
  ...["data.js", "org-data.js", "org-data.css"].map((f) => `${root}/org-data-direction-c/${f}`),
  ...["index.html", "fields.js", "fields.css"].map((f) => `${design}/${f}`),
])
  sourceHashes[f] = hash(await text(f));
const retained = {};
for (const dir of [
  `${root}/org-data-direction-c`,
  "output/playwright/p35-controls-review",
  "output/playwright/p35-export-detail-vue",
]) {
  const e = JSON.parse(await text(`${dir}/evidence.json`));
  for (const s of e.screenshots) assert.equal(hash(await readFile(`${dir}/${s.file}`)), s.sha256);
  retained[dir] = {
    manifest: hash(await text(`${dir}/evidence.json`)),
    pngCount: e.screenshots.length,
  };
}
// Run the current child's actual computed expressions, not a second hand-written filter oracle.
const ast = ts.createSourceFile(
  "child.ts",
  child.split(/<script setup[^>]*>/)[1].split("</script>")[0],
  ts.ScriptTarget.Latest,
  true,
);
const script = ast.statements
  .filter((n) => !ts.isImportDeclaration(n))
  .map((n) => n.getFullText(ast))
  .join("\n");
const models = [...child.matchAll(/v-model="([^"]+)"/g)].map((m) => m[1]);
assert.equal(models.length, 8);
function expected(state, fields) {
  const box = {
    defineProps: () => ({ data: state.data }),
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace: () => Promise.resolve() }),
    ref: (value) => ({ value }),
    computed: (fn) => ({
      get value() {
        return fn();
      },
    }),
    watch: () => {},
  };
  vm.runInNewContext(
    ts.transpileModule(
      `${script}\nglobalThis.result={${models.join(",")}, filteredWorkspaces, filteredExports};`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
    ).outputText,
    box,
  );
  for (const f of fields) {
    const [kind, key] = f.id.split("-");
    box.result[f.model].value = state[kind][key];
  }
  return plain(
    (state.view === "workspaces"
      ? box.result.filteredWorkspaces
      : box.result.filteredExports
    ).value.map((r) => r.id),
  );
}
if (!smoke && !capture) {
  const prior = JSON.parse(await text(`${output}/evidence.json`));
  assert.deepEqual(prior.sourceHashes, sourceHashes);
  assert.deepEqual(prior.retained, retained);
  for (const s of prior.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
}
if (capture) await mkdir(output, { recursive: true });
const checks = [],
  screenshots = [],
  interactions = [];
let fields;
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        requests = [],
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(/^https?:/u, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.resolve(design, "index.html")).href);
      await page.waitForFunction(() => !!window.ORG_DATA_FIELDS_C);
      fields = await page.evaluate(() => window.ORG_DATA_FIELDS_C.fields);
      assert.deepEqual(
        fields.map((f) => f.model),
        models,
      );
      const prepare = async (kind) => {
        await page.evaluate(
          (kind) => window.ORG_DATA_C.scene(kind === "workspace" ? "normal" : "exports"),
          kind,
        );
        if (width <= 760) await page.locator("#filters-toggle").click();
        await page.locator(".filters[data-field-review]").waitFor({ state: "visible" });
        await page.mouse.move(0, 0);
        await page.evaluate(() => document.activeElement?.blur());
      };
      const inspect = async (name, locator, focus = false) => {
        const state = await page.evaluate(() => window.ORG_DATA_C.state());
        const kind = state.view === "workspaces" ? "workspace" : "export";
        const ids = await page.evaluate(
          (k) => window.ORG_DATA_C.filtered(k).map((r) => r.id),
          kind,
        );
        assert.deepEqual(ids, expected(state, fields), name);
        assert.deepEqual(state.data.comparisons, fixture.comparisons);
        assert.deepEqual(state.data.exports, fixture.exports);
        assert.equal(state[kind].page, 1);
        assert.deepEqual(state.intents, []);
        const metrics = await locator.evaluate((n) => {
          const controls = n.matches("input,select")
            ? [n]
            : [...n.querySelectorAll("input,select")];
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            controls: controls.map((c) => ({
              id: c.id,
              height: c.getBoundingClientRect().height,
              font: getComputedStyle(c).fontSize,
              required: c.required,
              maxlength: c.getAttribute("maxlength"),
              invalid: c.getAttribute("aria-invalid"),
              help: document.getElementById(c.getAttribute("aria-describedby"))?.textContent,
              label: document.getElementById(c.getAttribute("aria-labelledby"))?.textContent,
            })),
            focus: n.matches(":focus-visible"),
            outline: getComputedStyle(n).outlineWidth,
          };
        });
        assert.equal(metrics.overflow, false, name);
        for (const c of metrics.controls) {
          assert.ok(
            c.height >= 44 && parseFloat(c.font) >= 16 && c.help && c.label,
            JSON.stringify(c),
          );
          assert.equal(c.required, false);
          assert.equal(c.maxlength, null);
          assert.equal(c.invalid, null);
        }
        if (focus) {
          assert.equal(metrics.focus, true);
          assert.equal(metrics.outline, "3px");
        }
        checks.push({ name, width, ids, metrics });
        if (capture) {
          const file = `${name}-${width}.png`;
          // Field crops include label and adjacent help. Compositions include the filter region only.
          const target = (await locator.evaluate((n) => n.matches("input,select")))
            ? locator.locator("..")
            : locator;
          await target.screenshot({ path: `${output}/${file}`, animations: "disabled" });
          screenshots.push({
            file,
            name,
            width,
            sha256: hash(await readFile(`${output}/${file}`)),
          });
        }
      };
      for (const field of fields) {
        const [kind] = field.id.split("-");
        await prepare(kind);
        const input = page.locator(`#${field.id}`);
        const options = await input.evaluate((n) =>
          n.tagName === "SELECT"
            ? [...n.options].map((o) => [o.value, o.textContent.trim()])
            : null,
        );
        if (options) {
          const select = child.match(
            new RegExp(`<select v-model="${field.model}">([\\s\\S]*?)</select>`),
          )[1];
          const fixed = [...select.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(
            (m) => [m[1], m[2].trim()],
          );
          const actual =
            field.model === "exportWorkspace"
              ? [
                  ...fixed,
                  ...[
                    ...new Set(
                      fixture.exports.map((r) => String(r.workspace_name || "未命名工作区")),
                    ),
                  ]
                    .sort((a, b) => a.localeCompare(b, "zh-CN"))
                    .map((v) => [v, v]),
                ]
              : fixed;
          assert.deepEqual(options, actual, field.model);
        }
        const states = smoke
          ? ["focus"]
          : [
              "default",
              "hover",
              "focus",
              ...(options
                ? options.map((_, i) => `option-${i}`)
                : ["filled", "whitespace", "long", "no-match", "id-excluded"]),
            ];
        for (const state of states) {
          await prepare(kind);
          if (state === "hover") await input.hover();
          if (state === "focus") {
            await page.keyboard.press("Tab");
            await input.focus();
          }
          if (state.startsWith("option-"))
            await input.selectOption(options[Number(state.split("-")[1])][0]);
          const values = {
            filled: kind === "workspace" ? "  新品决策  " : "  等待重试  ",
            whitespace: "   ",
            long: "长".repeat(220),
            "no-match": "没有对应记录",
            "id-excluded": kind === "workspace" ? fixture.comparisons[0].id : fixture.exports[0].id,
          };
          if (Object.hasOwn(values, state)) {
            await input.fill(values[state]);
            assert.equal(await input.inputValue(), values[state]);
          }
          if (state === "hover") assert.ok(await input.evaluate((n) => n.matches(":hover")));
          await inspect(`${field.id}-${state}`, input, state === "focus");
        }
      }
      for (const kind of ["workspace", "export"]) {
        await prepare(kind);
        const currentFields = fields.filter((f) => f.id.startsWith(`${kind}-`));
        const search = page.locator(`#${kind}-query`);
        await search.focus();
        await search.pressSequentially("新品", { delay: 20 });
        assert.equal(await search.inputValue(), "新品");
        assert.equal(
          await search.evaluate((n) => n === document.activeElement && n.selectionStart === 2),
          true,
        );
        await search.press("Home");
        await search.pressSequentially("审核", { delay: 20 });
        assert.equal(await search.inputValue(), "审核新品");
        for (const f of currentFields.slice(1)) {
          await page.keyboard.press("Tab");
          assert.equal(await page.evaluate(() => document.activeElement.id), f.id);
        }
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.id), "reset");
        interactions.push({
          kind,
          width,
          action: "typing-caret-and-tab-order",
          fields: currentFields.map((f) => f.id),
        });
        await prepare(kind);
        await inspect(`${kind}-composition-default`, page.locator(".field-review-region"));
        await page.locator('[data-page="1"]').click();
        const query = page.locator(`#${kind}-query`);
        await query.fill(kind === "workspace" ? "新品" : "团队");
        await page
          .locator(`#${kind}-status`)
          .selectOption(kind === "workspace" ? "active" : "retry_scheduled");
        await inspect(`${kind}-composition-filtered`, page.locator(".field-review-region"));
        await query.fill("不存在的审核记录");
        await inspect(`${kind}-composition-empty`, page.locator(".field-review-region"));
        const other = kind === "workspace" ? "export" : "workspace";
        // Preserve non-default filters in the other view during the actual reset click.
        await page
          .locator(`[data-view="${other === "workspace" ? "workspaces" : "exports"}"]`)
          .click();
        await page.locator(`#${other}-query`).fill("新品");
        await page
          .locator(`[data-view="${kind === "workspace" ? "workspaces" : "exports"}"]`)
          .click();
        const before = await page.evaluate(() => window.ORG_DATA_C.state());
        await page.locator("#reset").click();
        const after = await page.evaluate(() => window.ORG_DATA_C.state());
        assert.deepEqual(after[other], before[other]);
        assert.equal(after[kind].query, "");
        assert.equal(after[kind].status, "all");
        assert.equal(after[kind].sort, kind === "workspace" ? "total_desc" : "created_desc");
        if (kind === "export") {
          assert.equal(after.export.type, "all");
          assert.equal(after.export.workspace, "all");
        }
        assert.equal(await query.evaluate((n) => n === document.activeElement), true);
        interactions.push({
          kind,
          width,
          action: "reset-current-view-only",
          retainedOther: after[other],
        });
        await inspect(`${kind}-composition-reset`, page.locator(".field-review-region"));
      }
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        version: "P35-fields-C-r1",
        boundary:
          "Independent HTML proposal using unchanged C renderer; actual source computed ID oracle, not mounted Vue/API/RBAC/production. No field approvals implied. Native popup rendering/history/lifecycle/whole-page remain pending.",
        sourceHashes,
        retained,
        fields,
        checks,
        interactions,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>P35 筛选字段待审</title><style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px;background:#edf1f6;color:#202c3d}img{max-width:100%;border:1px solid #dbe1e9}article{background:white;padding:20px;margin:24px 0}a{color:#254a9c}</style><h1>P35 筛选字段 · 独立设计待审</h1><p>原始测试样例；非实际 Vue、接口或生产验收。单张通过不代表全部通过。</p>${screenshots.map((s) => `<article id="${s.name}-${s.width}"><h2>${s.name} / ${s.width}</h2><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.name} ${s.width}"></a></article>`).join("")}</html>`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    fields: fields.length,
    interactions: interactions.length,
    screenshots: screenshots.length,
    capture,
    smoke,
    retained,
    cleanup: "Browser contexts closed; file URL only, no server, HTTP or temporary fixture files",
  }),
);
