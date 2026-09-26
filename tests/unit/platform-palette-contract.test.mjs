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

test("crawler runtime palette keeps approved P53 colors scoped to its review page", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/crawler-runtime-tokens.css", "utf8"),
    readFile("apps/web/src/crawler-runtime.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--so-crawler-c-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-crawler-c-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 10);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^\.crawler-center--review\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/crawler-runtime-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("crawler scheduler palette resolves the approved P70 page and shell colors", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/crawler-scheduler-tokens.css", "utf8"),
    readFile("apps/web/src/crawler-scheduler-c.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--p70-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p70-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 36);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html body:has\(#app \.crawler-scheduler--c\),\s*\.crawler-scheduler--c\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/crawler-scheduler-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("credential asset palette resolves P50 component, modal and status colors in page scope", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/credential-assets-tokens.css", "utf8"),
    readFile("apps/web/src/credential-assets-c.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--p50-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p50-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 30);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html body:has\(#app \.credential-center\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/credential-assets-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("file resilience palette preserves P69 status colors and a page-scoped reduced-motion override", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/file-resilience-tokens.css", "utf8"),
    readFile("apps/web/src/file-resilience.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--file-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--file-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 21);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^\.file-resilience--c\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/file-resilience-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.match(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*html body:has\(#app \.file-resilience--c\) #app \.file-resilience--c \*\s*\{/,
  );
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(|!important/i);
});

test("home dashboard palette uses semantic names for its approved white and attention accents", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/home-dashboard-tokens.css", "utf8"),
    readFile("apps/web/src/home-dashboard.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--home-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--home-(?:white|attention))\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 2);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(), /^\.home-dashboard\s*\{[\s\S]*\}$/);
  assert.ok(css.startsWith('@import "./design/home-dashboard-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("mysql resilience palette keeps P68 shell and evidence colors route-scoped", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/mysql-resilience-tokens.css", "utf8"),
    readFile("apps/web/src/mysql-resilience-c.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--p68-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p68-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 35);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html body:has\(#app \.mysql-resilience--c\),\s*\.mysql-resilience--c\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/mysql-resilience-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("notification inbox palette resolves approved P26 colors in its review scope", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/notification-inbox-tokens.css", "utf8"),
    readFile("apps/web/src/notification-center.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--review-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--review-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 15);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^\.notification-center--review\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/notification-inbox-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("open platform palette resolves the approved P60 page and shell colors", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/open-platform-tokens.css", "utf8"),
    readFile("apps/web/src/open-platform-c.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--p60-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p60-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 17);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^\.role-shell:has\(\.open-platform--c\)\s*\{[\s\S]*\}\s*\.open-platform--c\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/open-platform-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("sourcing palette resolves its original colors and overrides without important", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/sourcing-tokens.css", "utf8"),
    readFile("apps/web/src/sourcing.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(
      /(--so-sourcing-review-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\)|var\(--so-(?:text|panel)\));/gi,
    ),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-sourcing-review-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 12);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.sourcing-workspace--review\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/sourcing-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(|!important/i);
  assert.match(css, /#app \.sourcing-workspace--review button\.danger\s*\{/);
  assert.match(
    css,
    /#app \.sourcing-workspace--review \.sourcing-layout > aside button\.selected\s*\{/,
  );
});

test("organization admin palette resolves its approved C page colors in route scope", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/organization-admin-tokens.css", "utf8"),
    readFile("apps/web/src/organization-admin.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--oa-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--oa-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 22);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.org-admin-center\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/roles-tokens.css";'));
  assert.ok(css.includes('@import "./design/organization-admin-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P08 tenancy palette resolves its original C direction colors in page scope", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/tenancy-tokens.css", "utf8"),
    readFile("apps/web/src/styles.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p08-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p08-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 19);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(), /^\.tenancy-page\s*\{[\s\S]*\}$/);
  assert.ok(css.startsWith('@import "./design/tenancy-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("organization audit palette resolves its original C direction colors in route scope", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/organization-audit-tokens.css", "utf8"),
    readFile("apps/web/src/organization-audit.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--org-audit-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--org-audit-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 10);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.org-admin-center \.org-audit-panel\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/organization-audit-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P62 platform log palette keeps the reviewed color contract route-scoped", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/platform-log-center-tokens.css", "utf8"),
    readFile("apps/web/src/platform-log-center-c.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p62-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p62-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 16);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.platform-log-center--c\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/platform-log-center-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("provider source filter palette resolves its local controls without broadening scope", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/provider-source-filters-tokens.css", "utf8"),
    readFile("apps/web/src/components/ProviderSourceFilters.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--source-filter-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--source-filter-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 7);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(), /^\.source-filter\s*\{[\s\S]*\}$/);
  assert.ok(css.startsWith('@import "../design/provider-source-filters-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(|!important/i);
  assert.match(css, /#app \.source-filter \.source-filter-toggle/);
});

test("P61 platform status palette resolves its shell and feedback colors in route scope", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/platform-status-center-tokens.css", "utf8"),
    readFile("apps/web/src/platform-status-center-c.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p61-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p61-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 15);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.platform-management--status-c\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/platform-status-center-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(|\bwhite\b/i);
});

test("P22 cost rule palette resolves its approved workbench colors in route scope", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/cost-rule-tokens.css", "utf8"),
    readFile("apps/web/src/profit.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--p22-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p22-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 14);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.cost-console--review\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/cost-rule-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P67 Redis palette resolves route colors from one page-scoped source", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/redis-resilience-tokens.css", "utf8"),
    readFile("apps/web/src/redis-resilience.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--rr-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--rr-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 22);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.redis-resilience--c\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/redis-resilience-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("report center palette resolves its approved colors only on the review route", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/report-center-tokens.css", "utf8"),
    readFile("apps/web/src/report-center.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--report-review-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--report-review-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 13);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.report-center--review\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/report-center-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("runtime topology palette resolves the P68 route shell and state colors", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/runtime-topology-tokens.css", "utf8"),
    readFile("apps/web/src/runtime-topology-c.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--topology-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--topology-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 31);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.topology-center--c\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/runtime-topology-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P17 scoring palette resolves the reviewed console and modal colors in route scope", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/scoring-tokens.css", "utf8"),
    readFile("apps/web/src/scoring.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--p17-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p17-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 21);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.score-rules--review\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/scoring-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P59 security operations palette resolves route colors and elevation tokens", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/security-operations-tokens.css", "utf8"),
    readFile("apps/web/src/security-operations-c.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--p59-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p59-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 17);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.security-ops--c\)\s*\{[\s\S]*\}$/,
  );
  assert.match(
    css,
    /^(?:\/\*[\s\S]*?\*\/\s*)?@import "\.\/design\/security-operations-tokens\.css";/,
  );
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
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
