import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const base = "design-plans/ui-phase-2-2026-09-07/design";
const output = `${base}/teams-fields-direction-c`;
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const parent = JSON.parse(await readFile(`${base}/teams-direction-c/evidence.json`, "utf8"));
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
for (const file of ["index.html", "fields.css", "fields.js"]
  .map((f) => `${output}/${f}`)
  .concat(
    `${base}/teams-controls-direction-c/controls.css`,
    "scripts/verify-ui-phase2-teams-fields-c.mjs",
  ))
  sourceHashes[file] = hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n"));
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
}
const checks = [],
  screenshots = [],
  observations = [];
let fields, combinations;
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(/^https?:/u, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.resolve(output, "index.html")).href);
      await page.waitForFunction(() => !!window.TEAM_FIELDS_C);
      ({ fields, combinations } = await page.evaluate(() => ({
        fields: window.TEAM_FIELDS_C.fields,
        combinations: window.TEAM_FIELDS_C.combinations,
      })));
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const prepare = async (id, variant) => {
        await page.evaluate(([i, v]) => window.TEAM_FIELDS_C.prepare(i, v), [id, variant]);
        await page.waitForFunction(() => {
          const n = document.querySelector("#filters");
          return !n || n.open === window.TEAMS_C.state().filtersOpen;
        });
      };
      const state = () => page.evaluate(() => window.TEAMS_C.state());
      const shot = async (scene, selector, meta = {}) => {
        check(
          `${scene}: no page overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        await page.mouse.move(1, 1);
        const file = `${scene}-${width}.png`,
          bytes = await page.locator(selector).screenshot();
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          scene,
          width,
          pageId: "P33",
          scope: "offline-field-proposal-not-production",
          sha256: hash(bytes),
          ...meta,
        });
      };
      for (const field of fields)
        for (const variant of field.states) {
          await prepare(field.id, variant);
          const input = page.locator(field.selector),
            key = `${field.id}-${variant}`;
          const p = await input.evaluate((n) => ({
            disabled: n.disabled,
            required: n.required,
            max: n.maxLength,
            label: !!document.querySelector(`label[for="${n.id}"]`),
            size: parseFloat(getComputedStyle(n).fontSize),
            height: n.getBoundingClientRect().height,
            help: (n.getAttribute("aria-describedby") || "")
              .split(" ")
              .filter(Boolean)
              .every((id) => !!document.getElementById(id)),
          }));
          check(
            `${key}: label readable target and linked help`,
            p.label && p.size >= 16 && p.height >= 44 && p.help,
          );
          check(
            `${key}: source editable and required`,
            [p.disabled, p.required],
            [false, field.required],
          );
          if (field.max) {
            check(`${key}: source max`, p.max, field.max);
            check(
              `${key}: counter`,
              await page.locator(`#${field.id}-field-count`).innerText(),
              `${(await input.inputValue()).length}/${field.max}`,
            );
          }
          if (field.required && ["empty", "whitespace"].includes(variant)) {
            check(`${key}: linked inline error`, await input.getAttribute("aria-invalid"), "true");
            check(`${key}: no write`, (await state()).intents, []);
          }
          if (!field.required && ["empty", "whitespace"].includes(variant))
            check(
              `${key}: optional not invalid`,
              (await input.getAttribute("aria-invalid")) === "true",
              false,
            );
          if (variant === "corrected")
            check(
              `${key}: error clears on correction`,
              await input.getAttribute("aria-invalid"),
              "false",
            );
          if (variant === "focus") {
            await input.focus();
            check(
              `${key}: visible keyboard focus`,
              await input.evaluate(
                (n) =>
                  n === document.activeElement &&
                  n.matches(":focus-visible") &&
                  getComputedStyle(n).outlineWidth === "3px",
              ),
            );
          }
          if (["lead", "member"].includes(field.id)) {
            const current = await state();
            const activeIds = current.members.filter((m) => m.status === "active").map((m) => m.id);
            check(
              `${key}: exact active member options including locked`,
              await input.locator("option").evaluateAll((ns) => ns.map((n) => n.value)),
              ["", ...activeIds],
            );
            if (["locked", "admin", "buyer"].includes(variant)) {
              const chosen = current.members.find(
                (m) =>
                  m.id ===
                  (field.id === "lead" ? current.form.lead_membership_id : current.memberId),
              );
              check(
                `${key}: selected identity`,
                variant === "locked"
                  ? chosen.account_status === "locked"
                  : chosen.roles.includes(
                      variant === "admin" ? "organization_admin" : "procurement_member",
                    ),
              );
            }
          }
          if (variant === "pending") {
            const creation = field.model.startsWith("form.");
            const buttons = creation
              ? ["#create-submit", "#cancel-create"]
              : ['[data-member-action="assign"]', '[data-member-action="remove"]'];
            check(
              `${key}: actions disabled`,
              await Promise.all(buttons.map((s) => page.locator(s).isDisabled())),
              [true, true],
            );
            if (field.id === "lead" || field.id === "member") await input.selectOption("");
            else await input.fill("提交期间后续编辑");
            const current = await state();
            check(
              `${key}: live draft stays editable`,
              creation ? current.form[field.model.slice(5)] : current.memberId,
              await input.inputValue(),
            );
            check(`${key}: editing never writes`, current.intents, []);
          }
          if (variant === "boundary") {
            await input.focus();
            await input.press("End");
            await input.press("x");
            check(
              `${key}: native length blocks extra character`,
              (await input.inputValue()).length,
              field.max,
            );
          }
          if (field.id === "query") {
            const current = await state(),
              q = current.query.trim().toLowerCase();
            const count = current.items.filter((t) =>
              [t.name, t.lead_email, t.default_workflow_key].some((v) =>
                String(v || "")
                  .toLowerCase()
                  .includes(q),
              ),
            ).length;
            check(
              `${key}: exact search result count`,
              await page.locator(".team-list li").count(),
              Math.min(8, count),
            );
            if (variant === "cleared") check(`${key}: cleared model`, current.query, "");
          }
          if (field.id === "sort") {
            check(
              `${key}: exact options`,
              await input.locator("option").evaluateAll((ns) => ns.map((n) => n.value)),
              ["name_asc", "members_desc", "updated_desc"],
            );
            if (!["default", "focus"].includes(variant))
              check(`${key}: exact sort model`, (await state()).sort, variant);
          }
          await shot(
            key,
            ["query", "sort"].includes(field.id) ? ".filter-fields" : `[data-field="${field.id}"]`,
            { field: field.id, variant },
          );
        }
      for (const scene of Object.keys(combinations)) {
        await prepare(scene);
        await shot(
          `composition-${scene}`,
          scene.startsWith("member") ? "#relationship" : "#create-form",
          {
            composition: true,
          },
        );
      }
      await prepare("create-ready");
      await page.locator("#team-name").fill("  北美新品团队  ");
      await page.locator("#team-lead").selectOption("");
      await page.locator("#team-workflow").fill("   ");
      await page.locator("#team-reason").fill("  划分协作职责  ");
      await page.evaluate(() => window.TEAMS_C.setMode("hold"));
      await page.locator("#create-submit").click();
      const submitted = await state();
      check("optional blanks exact trimmed intent", submitted.intents, [
        {
          url: "/org/admin/teams",
          method: "POST",
          body: {
            name: "北美新品团队",
            lead_membership_id: "",
            default_workflow_key: "",
            reason: "划分协作职责",
          },
        },
      ]);
      await page.locator("#create-submit").evaluate((n) => n.click());
      check("disabled submit no duplicate", (await state()).intents, submitted.intents);
      await prepare("workflow", "free-text");
      await page.evaluate(() => window.TEAMS_C.setMode("hold"));
      await page.locator("#create-submit").click();
      check(
        "free workflow key is not existence validated",
        (await state()).intents[0].body.default_workflow_key,
        "待配置流程-key",
      );
      await prepare("create-ready");
      await page.locator("#cancel-create").click();
      check("cancel clears four fields", (await state()).form, {
        name: "",
        lead_membership_id: "",
        default_workflow_key: "",
        reason: "",
      });
      check(
        "cancel closes form without write",
        [await page.locator("#create-form").count(), (await state()).intents],
        [0, []],
      );
      check("no browser errors", errors, []);
      check("no HTTP", requests, []);
      check("no cookies", await context.cookies(), []);
      check(
        "no storage",
        await page.evaluate(() => localStorage.length + sessionStorage.length),
        0,
      );
      observations.push({
        width,
        exactCreateIntent: submitted.intents[0],
        fieldsRemainEditable: true,
        noProductionWrites: true,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  assert.equal(
    screenshots.length,
    2 * (fields.reduce((n, f) => n + f.states.length, 0) + Object.keys(combinations).length),
  );
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        kind: "TEAMS-FIELDS-C-r1",
        approval: "pending-user-review",
        boundary:
          "Independent field proposal, not real Vue or production. Source field contracts retained; inline error presentation proposed. Shared reason dialog excluded. Pending editable snapshot does not decide later-draft completion policy or OG-G02.",
        sourceHashes,
        fields,
        combinations,
        checks,
        observations,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  const groups = [
    ...fields.map((f) => ({ label: f.label, shots: screenshots.filter((s) => s.field === f.id) })),
    ...Object.entries(combinations).map(([key, [, label]]) => ({
      label,
      shots: screenshots.filter((s) => s.scene === `composition-${key}`),
    })),
  ];
  const header = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P33 字段与组合图册</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d;margin:24px}section{background:white;padding:20px;margin:24px 0;border-left:4px solid #254a9c}a{color:#193b80}
.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}figure{margin:0}img{max-width:100%;height:360px;object-fit:contain;object-position:top left}h2{font-size:21px}</style>
<h1>P33 字段与表单组合</h1><p>7字段、9组合、${screenshots.length}张双端图。全部待审，不是线上截图或整页验收。</p><p><a href="README.md">边界与验证</a> · <a href="index.html">交互原型</a></p>`;
  const body = groups
    .map(
      (g) =>
        `<section><h2>${g.label}</h2><div class="shots">` +
        g.shots
          .map(
            (s) =>
              `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.width}px"></a><figcaption>${s.scene} / ${s.width}px</figcaption></figure>`,
          )
          .join("") +
        "</div></section>",
    )
    .join("");
  await writeFile(`${output}/gallery.html`, header + body + "</html>");
} else if (!smoke) {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(observations, previous.observations);
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    browserClosed: true,
    noProductionWrites: true,
  }),
);
