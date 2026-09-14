import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import postcss from "postcss";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const palette = read("apps/web/src/design/platform-admin-mobile-tokens.css");
const prefix = '@import "../design/platform-admin-mobile-tokens.css";\n\n';
const scope =
  'html[data-design="signal-ledger"] #app .account-center:has(.account-tabs a[href="/platform-admin/admins"][aria-current="page"])';
// Exact LF source fingerprints at bbde542c, before the local color extraction.
const originals = {
  Comparison: "9b74248f24827e8e1e4800b93090ef1fd680acaebf90754bc238680bebedddde",
  Directory: "4c66844583a8a9711e29b0aa40d40b87ebd7409f53b64933d441b0c8bf46c82c",
};

function values(source) {
  const nodes = postcss.parse(source).nodes.filter((node) => node.type !== "comment");
  assert.equal(nodes.length, 1);
  const media = nodes[0];
  assert.equal(media.type, "atrule");
  assert.equal(media.name, "media");
  assert.equal(media.params, "(max-width: 760px)");
  assert.equal(media.nodes.length, 1);
  const rule = media.nodes[0];
  assert.equal(rule.type, "rule");
  assert.equal(rule.selector.replace(/\s+/g, " "), scope);
  assert.equal(rule.nodes.length, 11);
  const result = new Map();
  for (const declaration of rule.nodes) {
    assert.equal(declaration.type, "decl");
    assert.match(declaration.prop, /^--so-admin-mobile-[a-z-]+$/);
    assert.match(declaration.value, /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/);
    assert.ok(!declaration.important);
    assert.ok(!result.has(declaration.prop));
    result.set(declaration.prop, declaration.value);
  }
  return result;
}

function verify(
  name,
  tokens = palette,
  source = read(`apps/web/src/components/PlatformAdmin${name}Mobile.css`),
) {
  const colors = values(tokens);
  assert.ok(source.startsWith(prefix));
  const expanded = source
    .slice(prefix.length)
    .replace(/var\((--so-admin-mobile-[a-z-]+)\)/g, (_, key) => {
      assert.ok(colors.has(key), `undefined local color: ${key}`);
      return colors.get(key);
    });
  assert.doesNotMatch(expanded, /var\(--so-admin-mobile-/);
  assert.equal(createHash("sha256").update(expanded).digest("hex"), originals[name]);
}

test("P44 colors are restricted to the original mobile C admins scope", () => {
  assert.equal(values(palette).size, 11);
  const parent = read("apps/web/src/components/PlatformAccountCenter.vue");
  for (const name of Object.keys(originals))
    assert.ok(parent.includes(`<style src="./PlatformAdmin${name}Mobile.css"></style>`));
});

for (const name of Object.keys(originals))
  test(`P44 ${name} expansion preserves every original style byte`, () => verify(name));

test("equivalence gate rejects color drift, scope expansion, layout changes and unresolved colors", () => {
  assert.throws(() => verify("Comparison", palette.replace("#294caf", "#294cae")));
  assert.throws(() => verify("Comparison", palette.replace("760px", "761px")));
  assert.throws(() =>
    verify("Comparison", palette.replace("/platform-admin/admins", "/platform-admin/users")),
  );
  assert.throws(() =>
    verify("Comparison", palette.replace("--so-admin-mobile-primary:", "color:")),
  );
  const source = read("apps/web/src/components/PlatformAdminDirectoryMobile.css");
  assert.throws(() => verify("Directory", palette, source.replace("44px", "43px")));
  assert.throws(() =>
    verify(
      "Directory",
      palette,
      source.replace("--so-admin-mobile-text", "--so-admin-mobile-unknown"),
    ),
  );
});
