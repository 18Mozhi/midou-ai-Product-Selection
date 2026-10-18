import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { splitSqlStatements } from "../../scripts/apply-deployment-migrations.mjs";

const migration = "0075_competitor_opportunity_identity.up.sql";
const prepared = "59bbc39a4954d19342a95de8a2fc0508bffd5a80";

test("identity migration changes only the key and down never deletes conflicting facts", async () => {
  const up = await readFile(`database/migrations/${migration}`, "utf8");
  const down = await readFile(
    "database/migrations/0075_competitor_opportunity_identity.down.sql",
    "utf8",
  );
  assert.equal(splitSqlStatements(up).length, 1);
  assert.equal(splitSqlStatements(down).length, 1);
  assert.match(
    up,
    /ADD UNIQUE KEY `uq_competitor_identity` \(`organization_id`,`workspace_id`,`market`,`source_site`,`external_id`,`opportunity_id`\)/,
  );
  assert.doesNotMatch(up + down, /(?:^|;)\s*(?:DELETE|UPDATE|INSERT|DROP TABLE|CREATE TABLE)/m);
  assert.doesNotMatch(up, /ADD COLUMN|GENERATED/);
  const [runner, deploy, manifest] = await Promise.all([
    readFile("scripts/apply-deployment-migrations.mjs", "utf8"),
    readFile("scripts/deploy-baota.py", "utf8"),
    readFile("infra/baota/single-backend-release-manifest.json", "utf8"),
  ]);
  assert.ok(runner.includes(`"${migration}"`));
  assert.ok(deploy.includes(`0074_provider_terms_permanent.up.sql ${migration}`));
  assert.equal(JSON.parse(manifest).migrationVersion, migration);
  assert.equal(JSON.parse(manifest).migrationPrerequisiteBuild, prepared);
});

test("deployment rejects old or unknown runtime before upload and accepts the actual prepared ancestor", () => {
  const output = execFileSync(
    "python",
    [
      "-B",
      "-c",
      `
import runpy
from pathlib import Path
d=runpy.run_path('scripts/deploy-baota.py')
verify=d['verify_opportunity_identity_migration_base']
known={'migration_version':'0074_provider_terms_permanent.up.sql','build_sha':'${prepared}'}
verify(Path.cwd(),known)
verify(Path.cwd(),dict(known,migration_version='${migration}'))
for invalid in [{},dict(known,build_sha='d7789c6dacdf7ab1d373f89ddc96224f8806f309'),dict(known,migration_version='unknown')]:
    try: verify(Path.cwd(),invalid)
    except RuntimeError: pass
    else: raise AssertionError('unsafe base accepted')
print('passed')
`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(output.trim(), "passed");
});

test("rollback 0075 may use prepared code but never a pre-contract target; guard precedes panel stop", () => {
  const output = execFileSync(
    "python",
    [
      "-B",
      "-c",
      `
import runpy
d=runpy.run_path('scripts/single-backend-rollback.py')
verify=d['validate_identity_rollback_target']
current='${migration}'
verify(current,current,'a'*40)
verify(current,'0074_provider_terms_permanent.up.sql','${prepared}')
verify('0074_provider_terms_permanent.up.sql',current,'a'*40)
for version,sha in [('0074_provider_terms_permanent.up.sql','d7789c6dacdf7ab1d373f89ddc96224f8806f309'),(None,'a'*40),('unknown','a'*40)]:
    try: verify(current,version,sha)
    except RuntimeError: pass
    else: raise AssertionError('unsafe rollback accepted')
source=d['exchange_source']('/www/wwwroot/ai选品','a'*40,'b'*40)
compile(source,'rollback_generated','exec')
assert source.index("validate_identity_rollback_target(migration(release)")<source.index("action(python,'StopProject'")
print('passed')
`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(output.trim(), "passed");
});
