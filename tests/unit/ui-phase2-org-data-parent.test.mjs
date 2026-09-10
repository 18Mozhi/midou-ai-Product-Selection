import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const output = "output/playwright/p35-parent-read-states";
const e = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");

test("P35 actual App/parent/child source and all128 state images are current", () => {
  assert.equal(e.kind, "P35-PARENT-READ-STATES");
  assert.equal(e.screenshots.length, 128);
  assert.equal(new Set(e.screenshots.map((s) => s.file)).size, 128);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  assert.deepEqual(
    readdirSync(output).sort(),
    [...e.screenshots.map((s) => s.file), "index.html", "evidence.json"].sort(),
  );
  for (const file of [
    "App.vue",
    "api-client.ts",
    "components/NavigationShell.vue",
    "components/OrganizationAdminCenter.vue",
    "components/OrganizationDataPanel.vue",
    "org-data-export-detail.css",
    "navigation-shell-scoped.css",
  ])
    assert.ok(e.sourceHashes[`apps/web/src/${file}`]);
  assert.match(e.boundary, /intercepted fixture HTTP only/);
  assert.match(e.boundary, /C visual approval are not proven/);
  assert.match(e.boundary, /409 is a synthetic client classifier/);
  assert.equal(Object.hasOwn(e, "approved"), false);
});

test("P35 both views/read endpoints/phases/widths cover seven failure classes and recovery", () => {
  assert.equal(e.scenarios.length, 112);
  assert.equal(e.checks.length, 1624);
  assert.deepEqual(
    e.failures.map((f) => f.status),
    [500, 503, 409, 429, 401, 403, 0],
  );
  for (const width of [1440, 390])
    for (const view of ["workspaces", "exports"]) {
      for (const target of ["summary", "data"])
        for (const phase of ["initial", "background"])
          for (const f of e.failures) {
            const matches = e.scenarios.filter(
              (s) =>
                s.width === width &&
                s.view === view &&
                s.target === target &&
                s.phase === phase &&
                s.failure === f.id,
            );
            assert.equal(matches.length, 1);
            const s = matches[0],
              replace = phase === "initial" || [401, 403].includes(f.status),
              name = `${phase}-${target}-${f.id}`;
            assert.equal(s.childVisible, !replace);
            assert.equal(s.state, replace ? f.state : "ready");
            assert.equal(s.attempts, [503, 429, 0].includes(f.status) ? 3 : 1);
            assert.equal(s.recovery, "passed");
            assert.ok(
              e.screenshots.some((s) => s.width === width && s.view === view && s.scene === name),
            );
            const suffixes = [
              "child visibility",
              "bounded existing retry count",
              "successful sibling reads once",
              "retry correlation retained",
              "recovery reads both endpoints once",
              "recovery retains URL query",
              "unrelated query survives",
            ];
            if (!replace)
              suffixes.push(
                "entire old child retained atomically",
                "old data timestamp retained atomically",
                "old summary retained atomically",
                "workspace filter retained",
              );
            for (const suffix of suffixes)
              assert.ok(
                e.checks.some(
                  (c) => c.width === width && c.view === view && c.name === `${name}: ${suffix}`,
                ),
              );
          }
      for (const name of ["initial-loading", "ready", "background-refreshing", "refresh-success"])
        assert.ok(
          e.screenshots.some((s) => s.width === width && s.view === view && s.scene === name),
        );
      for (const name of [
        "pending refresh retains data observed time",
        "successful refresh advances data observed time",
        "no business writes",
        "no unmatched or external requests",
        "no page errors",
        "no business dialogs fabricated",
      ])
        assert.ok(e.checks.some((c) => c.width === width && c.view === view && c.name === name));
    }
});
