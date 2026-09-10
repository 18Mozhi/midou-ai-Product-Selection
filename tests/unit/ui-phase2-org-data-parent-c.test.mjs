import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const output = "output/playwright/p35-parent-c-review";
const e = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");

test("P35 parent C proposal pins its actual-parent basis and every deliverable without approval", () => {
  assert.equal(e.approval, "pending-parent-region-review");
  assert.match(e.scope, /Offline HTML C proposal/);
  assert.match(e.scope, /no new runtime\/API\/permissions or user approval/);
  assert.equal(e.scenes.length, 17);
  assert.equal(e.screenshots.length, 276);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  assert.deepEqual(
    readdirSync(output).sort(),
    [...e.screenshots.map((s) => s.file), "index.html", "evidence.json"].sort(),
  );
  assert.ok(e.sourceHashes["output/playwright/p35-parent-read-states/evidence.json"]);
});

test("P35 both views and widths contain exact state, keyboard and read-only recovery coverage", () => {
  for (const width of [1440, 390])
    for (const view of ["workspaces", "exports"]) {
      const shots = e.screenshots.filter((s) => s.width === width && s.view === view);
      const checks = new Set(
        e.checks.filter((c) => c.width === width && c.view === view).map((c) => c.name),
      );
      for (const scene of e.scenes) {
        const variants = [
          "composition",
          ...(!scene.busy ? ["refresh-focus"] : []),
          ...(scene.replace && scene.failure ? ["retry-focus"] : []),
          ...(scene.failure ? ["trace-focus", "trace-open"] : []),
        ];
        assert.deepEqual(
          shots
            .filter((s) => s.scene === scene.id)
            .map((s) => s.variant)
            .sort(),
          variants.sort(),
        );
        for (const suffix of [
          "retained region",
          "reading semantics",
          "refresh disabled",
          "data unchanged",
          "no overflow",
        ])
          assert.ok(checks.has(`${scene.id}: ${suffix}`));
        if (scene.failure) {
          assert.equal(
            scene.replace,
            scene.phase === "initial" || [401, 403].includes(scene.failure.status),
          );
          assert.ok(checks.has(`${scene.id}: source visibility agreement`));
          assert.ok(checks.has(`${scene.id}: trace closes without read`));
        }
      }
      for (const name of [
        "refresh preserves both filter/page sets",
        "refresh preserves original facts",
        "refresh exact GET intentions",
        "disabled refresh has no repeated intention",
        "reading still allows input and preserves focus",
        "retry records only two existing GETs",
        "no business dialogs",
        "no HTTP or external requests",
        "no page errors",
      ])
        assert.ok(checks.has(name), name);
    }
});
