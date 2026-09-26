import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

for (const [paletteFile, prefix, count, paths] of [
  [
    "provider-registry-tokens",
    "--p46-",
    20,
    ["styles/provider-approved-structure.css", "styles/provider-approved-feedback.css"],
  ],
  [
    "platform-admin-mobile-tokens",
    "--so-admin-mobile-",
    11,
    ["components/PlatformAdminDirectoryMobile.css", "components/PlatformAdminComparisonMobile.css"],
  ],
  ["platform-data-tokens", "--so-data-", 27, ["components/PlatformDataCenter.vue"]],
  [
    "platform-overlay-tokens",
    "--so-workspace-overlay-",
    10,
    ["components/ResponsiveDataView.vue", "components/ResponsiveFilterDrawer.vue"],
  ],
]) {
  test(`${paletteFile} resolves its callers without changing the shared semantic aliases`, async () => {
    const source = await readFile(`apps/web/src/design/${paletteFile}.css`, "utf8");
    const declarations = [...source.matchAll(/(--[a-z-]+[0-9]*[a-z-]*):\s*([^;]+);/g)];
    const names = declarations.map((match) => match[1]);
    assert.equal(names.length, count);
    assert.equal(new Set(names).size, count);
    assert.ok(names.every((name) => name.startsWith(prefix)));
    for (const file of paths) {
      const css = await readFile(`apps/web/src/${file}`, "utf8");
      assert.ok(css.includes(`@import "../design/${paletteFile}.css";`));
      for (const [, name] of css.matchAll(new RegExp(`var\\((${prefix}[a-z-]+)\\)`, "g")))
        assert.ok(names.includes(name), `${file}: undefined ${name}`);
    }
  });
}

for (const [page, count, stylesheet] of [
  ["content", 23, "platform-content"],
  ["governance", 17, "platform-governance"],
  ["platform-notification", 22, "platform-notifications"],
]) {
  test(`${page} palette resolves every page-local color reference`, async () => {
    const [tokens, css] = await Promise.all([
      readFile(`apps/web/src/design/${page}-tokens.css`, "utf8"),
      readFile(`apps/web/src/${stylesheet}.css`, "utf8"),
    ]);
    const declarations = [...tokens.matchAll(/(--so-[a-z-]+):\s*(#[0-9a-f]{6});/g)];
    const palette = new Map(declarations.map((match) => [match[1], match[2]]));
    assert.equal(palette.size, count);
    assert.equal(declarations.length, palette.size, "no duplicate declarations");
    assert.ok(css.startsWith(`@import "./design/${page}-tokens.css";`));
    const references = [...css.matchAll(new RegExp(`var\\((--so-${page}-[a-z-]+)\\)`, "g"))];
    assert.ok(references.length >= count);
    for (const [, name] of references) assert.ok(palette.has(name), `undefined ${name}`);
    for (const name of palette.keys())
      assert.ok(
        references.some((match) => match[1] === name),
        `unused ${name}`,
      );
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  });
}

test("content palette includes the review, filter and record portal boundaries", async () => {
  const tokens = await readFile("apps/web/src/design/content-tokens.css", "utf8");
  const selectors = tokens
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("{")[0]
    .trim();
  assert.deepEqual(
    selectors.split(",").map((selector) => selector.trim()),
    [
      ".platform-content",
      ".platform-content-review",
      ".responsive-filter-drawer--content",
      ".responsive-data-view__overlay--content",
    ],
  );
  assert.doesNotMatch(tokens, /:root|html|body|!important/);
});

test("approval workspace review colors resolve from its page-scoped semantic palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/approval-workspace-tokens.css", "utf8"),
    readFile("apps/web/src/approval-workspace.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--so-approval-review-[a-z-]+):\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-approval-review-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 14);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^\.approval-workspace--review\s*\{/,
  );
  assert.ok(css.startsWith('@import "./design/approval-workspace-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test("opportunity queue and detail colors resolve from their route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/opportunity-review-tokens.css", "utf8"),
    readFile("apps/web/src/automatic-selection.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(
      /(--so-opportunity(?:-review|-list)-[a-z-]+):\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));/gi,
    ),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-opportunity(?:-review|-list)-[a-z-]+)\)/g)].map(
      (match) => match[1],
    ),
  );

  assert.equal(names.size, 23);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^\.opportunity-workspace--review\s*\{/,
  );
  assert.ok(css.startsWith('@import "./design/opportunity-review-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|!important/i);
});

test("automation rules palette resolves every page-local color reference", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/automation-rule-tokens.css", "utf8"),
    readFile("apps/web/src/automation-rules.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--so-automation-rule-[a-z-]+):\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-automation-rule-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 15);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(), /^\.automation-center--review\s*\{/);
  assert.ok(css.startsWith('@import "./design/automation-rule-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("backup recovery palette resolves page and portal colors without broadening scope", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/backup-recovery-tokens.css", "utf8"),
    readFile("apps/web/src/backup-recovery-center-c.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--so-backup-c-[a-z-]+):\s*#[0-9a-f]{6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-backup-c-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 11);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html body:has\(\.backup-center--c\),\s*\.backup-center\.backup-center--c\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/backup-recovery-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("capacity boundary palette resolves the page and scoped shell color references", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/capacity-boundary-tokens.css", "utf8"),
    readFile("apps/web/src/capacity-boundary-c.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--so-capacity-c-[a-z-]+):\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-capacity-c-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 35);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html body:has\(#app \.capacity-boundary--c\),\s*\.capacity-boundary--c\s*\{[\s\S]*\}$/,
  );
  assert.ok(
    css.startsWith(
      '/* P71 route-scoped C layout; inherited shell composition is isolated to this page. */\n@import "./design/capacity-boundary-tokens.css";',
    ),
  );
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("collection task palette resolves the reviewed workspace colors", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/collection-task-tokens.css", "utf8"),
    readFile("apps/web/src/collection-tasks.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--so-collection-task-c-[a-z-]+):\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-collection-task-c-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 9);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^\.collection-task-center--review\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/collection-task-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("competitor review palette resolves P19/P20 colors and scoped cascade overrides", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/competitor-review-tokens.css", "utf8"),
    readFile("apps/web/src/competitor.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--so-competitor-c-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-competitor-c-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 12);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^\.competitor-monitor--review\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/competitor-review-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(
    css.slice(css.indexOf("#app .competitor-monitor--review")),
    /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(|!important/i,
  );
  assert.doesNotMatch(css, /!important/);
});

test("P47 palette resolves page, portal detail and feedback without broadening activation", async () => {
  const tokens = await readFile("apps/web/src/design/provider-adapter-tokens.css", "utf8");
  const declarations = [...tokens.matchAll(/(--p47-[a-z-]+):\s*([^;]+);/g)];
  const palette = new Map(declarations.map((match) => [match[1], match[2]]));
  assert.equal(palette.size, 42);
  assert.equal(declarations.length, palette.size);
  assert.equal(
    tokens
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("{")[0]
      .trim(),
    "html:has(body #app .adapter-center--c)",
  );
  assert.equal(palette.get("--p47-scrim"), "rgba(15, 31, 53, 0.55)");
  const used = new Set();
  for (const name of [
    "provider-adapters-c-page",
    "provider-adapters-c-detail",
    "provider-adapters-c-feedback",
    "provider-adapters-empty-mobile",
  ]) {
    const css = await readFile(`apps/web/src/${name}.css`, "utf8");
    assert.ok(css.startsWith('@import "./design/provider-adapter-tokens.css";'));
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
    for (const [, name] of css.matchAll(/var\((--p47-[a-z-]+)\)/g)) {
      assert.ok(palette.has(name), `undefined ${name}`);
      used.add(name);
    }
  }
  // These four existing reserved roles remain unchanged; do not remove them in a palette move.
  assert.deepEqual([...palette.keys()].filter((name) => !used.has(name)).sort(), [
    "--p47-error",
    "--p47-on-accent-border",
    "--p47-on-accent-muted",
    "--p47-scrim",
  ]);
});
