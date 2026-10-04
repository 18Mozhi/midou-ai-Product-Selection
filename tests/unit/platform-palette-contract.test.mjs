import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

for (const [paletteFile, prefix, count, paths] of [
  [
    "provider-registry-tokens",
    "--p46-",
    22,
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
  const [tokens, css, detailNavigation] = await Promise.all([
    readFile("apps/web/src/design/opportunity-review-tokens.css", "utf8"),
    readFile("apps/web/src/automatic-selection.css", "utf8"),
    readFile("apps/web/src/components/OpportunityDetailNavigation.vue", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(
      /(--so-opportunity(?:-review|-list)-[a-z-]+):\s*(?:#[0-9a-f]{6}|rgb\([^;]+\));/gi,
    ),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [
      ...`${css}\n${detailNavigation}`.matchAll(
        /var\((--so-opportunity(?:-review|-list)-[a-z-]+)\)/g,
      ),
    ].map((match) => match[1]),
  );

  assert.equal(names.size, 25);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^\.opportunity-workspace--review\s*\{/,
  );
  assert.ok(css.startsWith('@import "./design/opportunity-review-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|!important/i);
});

test("opportunity AI colors resolve from a review-route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/opportunity-ai-tokens.css", "utf8"),
    readFile("apps/web/src/opportunity-ai.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--so-opportunity-ai-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-opportunity-ai-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 12);
  assert.equal(declarations.length, names.size, "no duplicate opportunity AI palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(#app \.opportunity-workspace--review\)\s*\{/,
  );
  assert.ok(css.startsWith('@import "./design/opportunity-ai-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test("opportunity feedback and lineage colors resolve from a review-route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/opportunity-p18-workfaces-tokens.css", "utf8"),
    readFile("apps/web/src/opportunity-p18-workfaces.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--so-opportunity-p18-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--so-opportunity-p18-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 21);
  assert.equal(declarations.length, names.size, "no duplicate P18 workface palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(#app \.opportunity-workspace--review\)\s*\{/,
  );
  assert.ok(css.startsWith('@import "./design/opportunity-p18-workfaces-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(|!important/i);
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

test("platform account permissions use their route-scoped palette", async () => {
  const [tokens, css, comparisonCss] = await Promise.all([
    readFile("apps/web/src/design/account-permissions-tokens.css", "utf8"),
    readFile("apps/web/src/components/PlatformAccountCenterPermissions.css", "utf8"),
    readFile("apps/web/src/components/PlatformRoleComparisonPermissions.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--account-permission-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...`${css}\n${comparisonCss}`.matchAll(/var\((--account-permission-[a-z-]+)\)/g)].map(
      (match) => match[1],
    ),
  );

  assert.equal(names.size, 19);
  assert.equal(declarations.length, names.size, "no duplicate account permissions tokens");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.account-center--permissions-c\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "../design/account-permissions-tokens.css";'));
  assert.ok(comparisonCss.startsWith('@import "../design/account-permissions-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(comparisonCss, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("credential asset palette resolves P50 component, modal and status colors in page scope", async () => {
  const [tokens, css, pageCss] = await Promise.all([
    readFile("apps/web/src/design/credential-assets-tokens.css", "utf8"),
    readFile("apps/web/src/credential-assets-c.css", "utf8"),
    readFile("apps/web/src/credential-assets-page-c.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--p50-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...`${css}\n${pageCss}`.matchAll(/var\((--p50-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 31);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.ok(names.has("--p50-success-ready-bg"));
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html body:has\(#app \.credential-center\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/credential-assets-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
  assert.doesNotMatch(pageCss, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
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

  assert.equal(names.size, 16);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.ok(names.has("--review-danger-text"));
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
  const [tokens, css, globalShellCss, tenancyCss] = await Promise.all([
    readFile("apps/web/src/design/tenancy-tokens.css", "utf8"),
    readFile("apps/web/src/styles.css", "utf8"),
    readFile("apps/web/src/signal-ledger.css", "utf8"),
    readFile("apps/web/src/styles/tenancy-workspace.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p08-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const p08OverridesStart = globalShellCss.indexOf(
    "/* P08's approved C entry screen deliberately uses a cool workspace canvas and soft corners. */",
  );
  assert.notEqual(
    p08OverridesStart,
    -1,
    "P08 overrides remain explicitly scoped in the shared shell stylesheet",
  );
  const p08Overrides = globalShellCss.slice(p08OverridesStart);
  const references = new Set(
    [...`${css}\n${globalShellCss}\n${tenancyCss}`.matchAll(/var\((--p08-[a-z-]+)\)/g)].map(
      (match) => match[1],
    ),
  );

  assert.equal(names.size, 24);
  assert.equal(declarations.length, names.size, "no duplicate palette declarations");
  assert.match(tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(), /^\.tenancy-page\s*\{[\s\S]*\}$/);
  assert.ok(css.startsWith('@import "./design/tenancy-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
  assert.doesNotMatch(p08Overrides, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
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

  assert.equal(names.size, 15);
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
  assert.equal(palette.size, 58);
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

test("P13/P23/P24 task workspace colors resolve from one route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/task-workspace-tokens.css", "utf8"),
    readFile("apps/web/src/task-workspace-enhancements.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--tw-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgb\([^;]+\));/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--tw-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 47);
  assert.equal(declarations.length, names.size, "no duplicate task palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.task-workspace--review\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/task-workspace-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P14 trend desk colors resolve from its route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/trend-dashboard-tokens.css", "utf8"),
    readFile("apps/web/src/trends.css", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--trend-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...css.matchAll(/var\((--trend-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 23);
  assert.equal(declarations.length, names.size, "no duplicate trend palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.trend-dashboard--review\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "./design/trend-dashboard-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P38 platform dashboard colors resolve from its route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/platform-dashboard-tokens.css", "utf8"),
    readFile("apps/web/src/styles/platform-dashboard.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--pd-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--pd-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 10);
  assert.equal(
    declarations.length,
    names.size,
    "no duplicate platform dashboard palette declarations",
  );
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.platform-dashboard--review\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "../design/platform-dashboard-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P52 collection operations colors resolve from its route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/collection-ops-tokens.css", "utf8"),
    readFile("apps/web/src/styles/platform-operations.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p52-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p52-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 9);
  assert.equal(
    declarations.length,
    names.size,
    "no duplicate collection operations palette declarations",
  );
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.collection-ops--review\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "../design/collection-ops-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P49 1688 acceptance colors resolve from its route-scoped palette", async () => {
  const [tokens, component] = await Promise.all([
    readFile("apps/web/src/design/acceptance-1688-tokens.css", "utf8"),
    readFile("apps/web/src/components/Alibaba1688AcceptanceCenter.vue", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--acceptance-[a-z-]+):\s*#[0-9a-f]{3,8};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...component.matchAll(/var\((--acceptance-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 16);
  assert.equal(
    declarations.length,
    names.size,
    "no duplicate 1688 acceptance palette declarations",
  );
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.acceptance-1688\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(component.includes('@import "../design/acceptance-1688-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(component, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P63 API coverage colors resolve from its route-scoped palette", async () => {
  const [tokens, component, operationCard] = await Promise.all([
    readFile("apps/web/src/design/api-coverage-tokens.css", "utf8"),
    readFile("apps/web/src/components/ApiCoverageDashboard.vue", "utf8"),
    readFile("apps/web/src/components/ApiCoverageOperationCard.vue", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p63-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...`${component}\n${operationCard}`.matchAll(/var\((--p63-[a-z-]+)\)/g)].map(
      (match) => match[1],
    ),
  );

  assert.equal(names.size, 19);
  assert.equal(declarations.length, names.size, "no duplicate API coverage palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.api-coverage--c\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(component.includes('@import "../design/api-coverage-tokens.css";'));
  assert.ok(operationCard.includes('@import "../design/api-coverage-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(component, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
  assert.doesNotMatch(operationCard, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P58 commercial operations colors resolve from its route-scoped palette", async () => {
  const [tokens, css, component] = await Promise.all([
    readFile("apps/web/src/design/commercial-review-tokens.css", "utf8"),
    readFile("apps/web/src/components/commercial-operations.css", "utf8"),
    readFile("apps/web/src/components/CommercialOperationsCenter.vue", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--so-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...`${css}\n${component}`.matchAll(/var\((--so-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 20);
  assert.equal(declarations.length, names.size, "no duplicate commercial operations declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^(?::global\()?html:has\(body #app \.commercial--review\)\)?\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "../design/commercial-review-tokens.css";'));
  assert.ok(component.includes('@import "../design/commercial-review-tokens.css";'));
  assert.ok([...names].every((name) => references.has(name)));
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
  assert.doesNotMatch(component, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P01 landing redirect colors resolve from its route-scoped palette", async () => {
  const [tokens, component] = await Promise.all([
    readFile("apps/web/src/design/landing-redirect-tokens.css", "utf8"),
    readFile("apps/web/src/components/LandingRedirectSurface.vue", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p01-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...component.matchAll(/var\((--p01-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 13);
  assert.equal(declarations.length, names.size, "no duplicate landing palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^\.landing-redirect\s*\{[\s\S]*\}$/,
  );
  assert.ok(component.includes('@import "../design/landing-redirect-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(component, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P02 login colors resolve from its route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/local-identity-login-tokens.css", "utf8"),
    readFile("apps/web/src/components/local-identity-login.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p02-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p02-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 29);
  assert.equal(declarations.length, names.size, "no duplicate login palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.p02-login-page\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "../design/local-identity-login-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P07 MFA colors resolve from its route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/identity-mfa-tokens.css", "utf8"),
    readFile("apps/web/src/components/local-identity-mfa.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p07-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p07-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 26);
  assert.equal(declarations.length, names.size, "no duplicate MFA palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.p07-mfa-page\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "../design/identity-mfa-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P04 recovery colors resolve from its route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/identity-recovery-tokens.css", "utf8"),
    readFile("apps/web/src/components/local-identity-recovery.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p04-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p04-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 21);
  assert.equal(declarations.length, names.size, "no duplicate identity recovery declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.p04-recovery-page\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "../design/identity-recovery-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P03 registration colors resolve from its route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/identity-registration-tokens.css", "utf8"),
    readFile("apps/web/src/components/local-identity-registration.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p03-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p03-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 19);
  assert.equal(declarations.length, names.size, "no duplicate registration palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.p03-registration-page\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "../design/identity-registration-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P06 password reset colors resolve from its route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/identity-reset-tokens.css", "utf8"),
    readFile("apps/web/src/components/local-identity-reset.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p06-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p06-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 22);
  assert.equal(declarations.length, names.size, "no duplicate password reset declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.p06-reset-page\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "../design/identity-reset-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P05 verification colors resolve from its route-scoped palette", async () => {
  const [tokens, css] = await Promise.all([
    readFile("apps/web/src/design/identity-verification-tokens.css", "utf8"),
    readFile("apps/web/src/components/local-identity-verification.css", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p05-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set([...css.matchAll(/var\((--p05-[a-z-]+)\)/g)].map((match) => match[1]));

  assert.equal(names.size, 17);
  assert.equal(declarations.length, names.size, "no duplicate verification palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.p05-verification-page\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(css.startsWith('@import "../design/identity-verification-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("P73 not-found colors resolve from its route-scoped palette", async () => {
  const [tokens, component] = await Promise.all([
    readFile("apps/web/src/design/not-found-tokens.css", "utf8"),
    readFile("apps/web/src/components/NotFoundPage.vue", "utf8"),
  ]);
  const declarations = [...tokens.matchAll(/(--p73-[a-z-]+):\s*#[0-9a-f]{3,6};/gi)];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...component.matchAll(/var\((--p73-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 11);
  assert.equal(declarations.length, names.size, "no duplicate not-found palette declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.not-found-page--review\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(component.includes('@import "../design/not-found-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(component, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("organization creation wizard colors resolve from the dialog-scoped palette", async () => {
  const [tokens, component] = await Promise.all([
    readFile("apps/web/src/design/organization-wizard-tokens.css", "utf8"),
    readFile("apps/web/src/components/OrganizationCreationWizard.vue", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--ow-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...component.matchAll(/var\((--ow-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 32);
  assert.equal(declarations.length, names.size, "no duplicate organization wizard declarations");
  assert.match(
    tokens.replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    /^html:has\(body #app \.organization-wizard\)\s*\{[\s\S]*\}$/,
  );
  assert.ok(component.includes('@import "../design/organization-wizard-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(component, /#[0-9a-f]{3,8}\b|rgba?\(|rgb\(/i);
});

test("platform account center palettes stay scoped to their distinct account pages", async () => {
  const [tokens, css, adminCss, dialogsCss, usersCss, organizationDialog, userDialog] =
    await Promise.all([
      readFile("apps/web/src/design/account-center-tokens.css", "utf8"),
      readFile("apps/web/src/components/PlatformAccountCenter.css", "utf8"),
      readFile("apps/web/src/components/PlatformAccountCenterAdmin.css", "utf8"),
      readFile("apps/web/src/components/PlatformAccountDialogs.css", "utf8"),
      readFile("apps/web/src/components/PlatformAccountUsersC.css", "utf8"),
      readFile("apps/web/src/components/PlatformOrganizationDetailDialog.vue", "utf8"),
      readFile("apps/web/src/components/PlatformUserDetailDialog.vue", "utf8"),
    ]);
  const declarations = [
    ...tokens.matchAll(
      /(--(?:account-review|account-org|account-users)-[a-z-]+):\s*(?:#[0-9a-f]{3,8}|rgba?\([^;]+\));/gi,
    ),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [
      ...`${css}\n${adminCss}\n${dialogsCss}\n${usersCss}\n${organizationDialog}\n${userDialog}`.matchAll(
        /var\((--(?:account-review|account-org|account-users)-[a-z-]+)\)/g,
      ),
    ].map((match) => match[1]),
  );

  assert.equal(names.size, 79);
  assert.equal(declarations.length, names.size, "no duplicate account center palette declarations");
  assert.match(tokens, /html:has\(body #app \.account-center--review\)/);
  assert.match(tokens, /html:has\(body #app \.account-center--organization-review\)/);
  assert.match(tokens, /html:has\(body #app \.account-center--user-admin-c\)/);
  assert.match(tokens, /html:has\(body #app \.account-center--admins-c\)/);
  assert.ok(css.startsWith('@import "../design/account-center-tokens.css";'));
  assert.ok(adminCss.startsWith('@import "../design/account-center-tokens.css";'));
  assert.ok(dialogsCss.startsWith('@import "../design/account-center-tokens.css";'));
  assert.ok(usersCss.startsWith('@import "../design/account-center-tokens.css";'));
  assert.ok(organizationDialog.includes('@import "../design/account-center-tokens.css";'));
  assert.ok(userDialog.includes('@import "../design/account-center-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(adminCss, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(dialogsCss, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(usersCss, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(organizationDialog, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(userDialog, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test("P48 provider compatibility colors resolve from the modal-scoped palette", async () => {
  const [tokens, component, samplesCss, reviewComponent] = await Promise.all([
    readFile("apps/web/src/design/provider-compatibility-tokens.css", "utf8"),
    readFile("apps/web/src/components/ProviderCompatibilityMatrixDialog.vue", "utf8"),
    readFile("apps/web/src/components/ProviderParserSampleDialog.css", "utf8"),
    readFile("apps/web/src/components/ProviderParserSampleReview.vue", "utf8"),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--p48-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    [...component.matchAll(/var\((--p48-[a-z-]+)\)/g)].map((match) => match[1]),
  );

  assert.equal(names.size, 43);
  assert.equal(declarations.length, names.size, "no duplicate P48 palette declarations");
  assert.match(
    tokens,
    /^\.source-modal\.p48-compatibility-modal,\s*\.source-modal\.p48-parser-samples-modal\s*\{/,
  );
  assert.ok(component.includes('@import "../design/provider-compatibility-tokens.css";'));
  assert.ok(samplesCss.startsWith('@import "../design/provider-compatibility-tokens.css";'));
  assert.ok(reviewComponent.includes('@import "../design/provider-compatibility-tokens.css";'));
  const sampleReferences = new Set(
    [...samplesCss.matchAll(/var\((--p48-[a-z-]+)\)/g)].map((match) => match[1]),
  );
  const reviewReferences = new Set(
    [...reviewComponent.matchAll(/var\((--p48-[a-z-]+)\)/g)].map((match) => match[1]),
  );
  assert.deepEqual(
    [...new Set([...references, ...sampleReferences, ...reviewReferences])].sort(),
    [...names].sort(),
  );
  assert.doesNotMatch(component, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(samplesCss, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(reviewComponent, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test("P48 provider source page colors resolve from its page-scoped palette", async () => {
  const [tokens, ...stylesheets] = await Promise.all([
    readFile("apps/web/src/design/provider-source-tokens.css", "utf8"),
    ...[
      "apps/web/src/components/ProviderSourceCenter.p48.css",
      "apps/web/src/components/ProviderSourceDirectory.css",
      "apps/web/src/components/ProviderSourceConfigurationDialog.css",
    ].map((path) => readFile(path, "utf8")),
  ]);
  const declarations = [
    ...tokens.matchAll(/(--p48-source-[a-z-]+):\s*(?:#[0-9a-f]{3,6}|rgba?\([^;]+\));/gi),
  ];
  const names = new Set(declarations.map((match) => match[1]));
  const references = new Set(
    stylesheets.flatMap((css) =>
      [...css.matchAll(/var\((--p48-source-[a-z-]+)\)/g)].map((match) => match[1]),
    ),
  );

  assert.equal(names.size, 52);
  assert.equal(declarations.length, names.size, "no duplicate P48 source palette declarations");
  assert.match(tokens, /^\.source-center--p48\s*\{/);
  assert.ok(stylesheets[0].startsWith('@import "../design/provider-source-tokens.css";'));
  assert.deepEqual([...references].sort(), [...names].sort());
  for (const css of stylesheets) assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});
