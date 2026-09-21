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
  ["content", 18, "platform-content"],
  ["governance", 13, "platform-governance"],
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
