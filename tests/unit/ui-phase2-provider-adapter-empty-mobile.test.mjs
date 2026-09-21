import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import { beforeAdapterEmptyMobile } from "../../scripts/lib/ui-phase2-adapter-empty-mobile-baseline.mjs";
import { beforeAdapterPaginationFocus } from "../../scripts/lib/ui-phase2-adapter-pagination-focus-baseline.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const file = "apps/web/src/components/ProviderAdapterCenter.vue";
const stylesheet = "apps/web/src/provider-adapters-empty-mobile.css";
const hash = (value) => createHash("sha256").update(value).digest("hex");

test("P47 approved mobile empty implementation preserves prior runtime outside exact pagination changes", () => {
  const raw = read(file),
    source = beforeAdapterPaginationFocus(raw),
    before = beforeAdapterEmptyMobile(source),
    a = parse(source),
    b = parse(before);
  assert.deepEqual(a.errors, []);
  assert.equal(
    a.descriptor.scriptSetup.content.replace(
      'import "../provider-adapters-empty-mobile.css";\n',
      "",
    ),
    b.descriptor.scriptSetup.content,
  );
  assert.deepEqual(
    a.descriptor.styles.map((s) => [s.content, s.attrs]),
    b.descriptor.styles.map((s) => [s.content, s.attrs]),
  );
  assert.equal((source.match(/adapter-empty-copy-wide/g) || []).length, 4);
  assert.equal((source.match(/adapter-empty-copy-mobile/g) || []).length, 4);
  assert.equal((source.match(/adapter-empty--approved-mobile/g) || []).length, 2);
  compileScript(a.descriptor, { id: "p47-mobile-empty" });
  assert.deepEqual(
    compileTemplate({
      source: a.descriptor.template.content,
      filename: file,
      id: "p47-mobile-empty",
    }).errors,
    [],
  );
  for (const changed of [
    source + "\n//unknown",
    source.replace("input.focus();", "input.blur();"),
    source.replace("heading.focus({ preventScroll: true });", "heading.blur();"),
    source.replace("还没有可查看的来源", "无法查看"),
  ])
    assert.throws(() => beforeAdapterEmptyMobile(changed));
  assert.equal(beforeAdapterEmptyMobile(source.replaceAll("\n", "\r\n")), before);
  assert.throws(() =>
    beforeAdapterPaginationFocus(
      raw.replace("page.value += direction;", "page.value -= direction;"),
    ),
  );
  assert.equal(read(file), raw);
});

test("P47 pre-pagination mobile capture binds exact sources and original mobile/wide/neighbor comparisons", () => {
  const root = "output/playwright/p47-empty-mobile-implementation",
    e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(
    hash(read(`${root}/evidence.json`)),
    "38752bf451c664422f36b1dd00f8c3e2dfb96fa5796969454850ddfcacb3ea99",
  );
  assert.equal(e.kind, "P47-EMPTY-MOBILE-IMPLEMENTATION-r1");
  assert.equal(e.productionMobileEmptyImplemented, true);
  assert.equal(e.reviewOnly, false);
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 36);
  assert.equal(
    e.runs.reduce((n, r) => n + r.checks.length, 0),
    576,
  );
  assert.equal(e.screenshots.length, 96);
  assert.equal(e.comparisons.length, 32);
  const approvedRoot = "output/playwright/p47-empty-review";
  assert.equal(
    hash(read(`${approvedRoot}/evidence.json`)),
    "487b0e1bd664b5d2e5bf0daec40f99dfe71f8dd69c8c8320c24881ccedc65576",
  );
  for (const scene of ["catalog", "search"])
    assert.equal(
      hash(readFileSync(`${root}/current-390-${scene}-empty.png`)),
      hash(readFileSync(`${approvedRoot}/review-390-${scene}-empty.png`)),
      `original approved mobile region: ${scene}`,
    );
  assert.equal(Object.keys(e.sourceHashes).length, 179);
  for (const name of [
    file,
    stylesheet,
    "scripts/verify-provider-adapter-empty-mobile.mjs",
    "scripts/lib/ui-phase2-adapter-empty-mobile-baseline.mjs",
    "apps/web/src/design/provider-adapter-tokens.css",
  ])
    assert.ok(e.sourceHashes[name], name);
  for (const [name, expected] of Object.entries(e.sourceHashes))
    assert.equal(
      hash(name === file ? beforeAdapterPaginationFocus(read(name)) : read(name)),
      expected,
      name,
    );
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(`${root}/${s.file}`);
    assert.equal(hash(bytes), s.sha256, s.file);
    assert.deepEqual(
      [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
      [s.pixelWidth, s.pixelHeight],
    );
  }
  for (const c of e.comparisons) {
    assert.equal(hash(readFileSync(`${root}/${c.actual}`)), c.sha256);
    assert.equal(hash(readFileSync(`${root}/${c.expected}`)), c.sha256);
    const s = e.screenshots.find((s) => s.file === c.actual);
    assert.equal(
      c.expected,
      c.actual.replace(
        "current-",
        s.width <= 760 && s.suffix === "empty" ? "review-" : "baseline-",
      ),
    );
  }
  for (const run of e.runs) {
    const check = (n) => run.checks.find((c) => c.name === n)?.actual;
    assert.equal(check("no extra adapter GET"), 1);
    assert.equal(check("no write requests"), 0);
    assert.equal(check("no request bodies"), true);
    assert.deepEqual(check("no unexpected network"), []);
    assert.deepEqual(check("no runtime errors"), []);
    if (run.scene !== "catalog") {
      assert.equal(check("reset focus target"), "search");
      assert.equal(check("toolbar reset keeps its own focus"), true);
    } else assert.equal(check("registration link reaches P46"), "/platform-admin/providers");
    if (run.mode === "current") assert.equal(check("responsive hidden copy stays hidden"), true);
  }
});

test("P47 empty CSS is mobile-scoped and reproduces the exact approved five rule declaration sets", () => {
  const css = postcss.parse(read(stylesheet));
  assert.equal(css.nodes.filter((n) => n.type === "atrule").length, 2);
  assert.equal(
    css.nodes.find((n) => n.type === "atrule" && n.name === "import").params,
    '"./design/provider-adapter-tokens.css"',
  );
  const media = css.nodes.find((n) => n.type === "atrule" && n.name === "media");
  assert.equal(media.name, "media");
  assert.equal(media.params, "(max-width: 760px)");
  const global = css.nodes.filter((n) => n.type === "rule");
  assert.equal(global.length, 1);
  assert.match(global[0].selector, /\.adapter-empty-copy-mobile$/);
  assert.deepEqual(
    global[0].nodes.map((n) => [n.prop, n.value]),
    [["display", "none"]],
  );
  css.walkRules((rule) => {
    assert.match(rule.selector, /body:has\(#app \.adapter-center--c\)/);
    assert.match(rule.selector, /\.adapter-empty--approved-mobile/);
    assert.ok(rule.nodes.every((n) => !n.important));
  });
  const approved = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-empty-preview.css"),
  );
  const tokens = read("apps/web/src/design/provider-adapter-tokens.css"),
    palette = new Map();
  postcss.parse(tokens).walkDecls((d) => palette.set(d.prop, d.value));
  const additions =
    "  --p47-empty-canvas: #f6f8fb;\n  --p47-empty-border: #d9e1ec;\n  --p47-empty-ink: #152b49;\n  --p47-empty-muted: #53657c;\n  --p47-empty-accent: #185adb;\n";
  assert.equal(tokens.split(additions).length, 2);
  assert.equal(
    hash(tokens.replace(additions, "")),
    "c6ff4f890f97866b8e8faca8bee234532534ecb014e2acf5ba61567da24600a6",
  );
  assert.doesNotMatch(read(stylesheet), /#[0-9a-f]{3,8}\b/i);
  const resolved = (value) =>
    value
      .replace(/var\((--p47-[a-z-]+)\)/g, (_, name) => {
        assert.ok(palette.has(name), name);
        return palette.get(name);
      })
      .replace(/\bwhite\b/g, "#fff");
  const declarations = (root) => {
    const rules = [];
    root.walkRules((r) => {
      if (!r.selector.includes("adapter-empty-copy-"))
        rules.push(r.nodes.map((n) => [n.prop, resolved(n.value)]));
    });
    return rules;
  };
  assert.deepEqual(declarations(media), declarations(approved));
  assert.deepEqual(
    media.nodes
      .filter((n) => n.type === "rule" && n.selector.includes("adapter-empty-copy-"))
      .map((r) => r.nodes.map((n) => [n.prop, n.value])),
    [[["display", "none"]], [["display", "inline"]]],
  );
});
