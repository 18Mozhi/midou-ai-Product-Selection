import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("P16 semantic tokens preserve every approved CSS declaration and stay scoped", async () => {
  const css = (await readFile("apps/web/src/selection-journey.css", "utf8")).replaceAll(
    "\r\n",
    "\n",
  );
  const tokens = await readFile("apps/web/src/design/selection-tokens.css", "utf8");
  const block = tokens.match(/html #app \.selection-journey \{([^}]+)\}/);
  assert.ok(block, "P16 palette must stay scoped, not override global theme roles");
  const values = new Map(
    [...block[1].matchAll(/(--so-selection-[\w-]+):\s*(#[\da-f]+);/g)].map((m) => [m[1], m[2]]),
  );
  assert.equal(values.size, 24);
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
  // Frozen normalized source at 2b5a8898; includes all layout, states, density and colors.
  assert.equal(
    createHash("sha256").update(expanded).digest("hex"),
    "a848229c6c668111e08f2fdef9f63724b4b29dbb745622d1fac5eff480a1af08",
  );
});
