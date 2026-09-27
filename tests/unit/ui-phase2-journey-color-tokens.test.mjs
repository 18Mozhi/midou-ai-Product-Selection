import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("P16 semantic tokens preserve approved colors and use the shared theme-aware surface", async () => {
  const css = (await readFile("apps/web/src/selection-journey.css", "utf8")).replaceAll(
    "\r\n",
    "\n",
  );
  const tokens = await readFile("apps/web/src/design/selection-tokens.css", "utf8");
  const block = tokens.match(/html #app \.selection-journey \{([^}]+)\}/);
  assert.ok(block, "P16 palette must stay scoped, not override global theme roles");
  const values = new Map(
    [...block[1].matchAll(/(--so-selection-[\w-]+):\s*(#[\da-f]+|var\(--so-panel\));/g)].map(
      (m) => [m[1], m[2]],
    ),
  );
  assert.equal(values.size, 24);
  assert.equal([...values.values()].filter((value) => value.startsWith("#")).length, 23);
  assert.equal(values.get("--so-selection-surface"), "var(--so-panel)");
  assert.equal((tokens.match(/--so-selection-/g) ?? []).length, values.size);
  assert.ok(
    css.startsWith('@import "./design/selection-tokens.css";\n\n'),
    "isolated consumers must load palette too",
  );
  const expanded = css
    .replace('@import "./design/selection-tokens.css";\n\n', "")
    .replace(/var\((--so-selection-[\w-]+)\)/g, (_, name) => {
      assert.ok(values.has(name), `Unresolved P16 color role: ${name}`);
      return values.get(name);
    });
  // Frozen normalized source at 2b5a8898, with only the 10 former #fff surfaces delegated
  // to the shared theme role. Layout, states, density and the other approved colors are exact.
  assert.equal(
    createHash("sha256").update(expanded).digest("hex"),
    "ffada31fdd189c2c226c5c7c5135c49adaa83971e9e23d8bf0343f89f0640bfd",
  );
});
