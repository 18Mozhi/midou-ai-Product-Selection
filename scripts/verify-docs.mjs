import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const required = [
  'README.md', 'AGENTS.md', 'new-product-enterprise-blueprint.md',
  'docs/openapi.yaml', 'docs/feature-map.json', 'config/env.example',
  'infra/docker-compose.dev.yml', 'scripts/locate_flow_v4.mjs',
  'scripts/verify-docs.mjs', 'scripts/verify-plans.mjs', 'package.json', '.gitignore',
  'scripts/verify-module.mjs', 'scripts/verify-phase.mjs', 'scripts/verify-all.mjs',
  'scripts/lib/verification-engine.mjs', 'verification/state.json',
  'verification/modules/M00-01.json', 'verification/modules/M00-07.json',
  'verification/modules/M00-02.json', 'config/schema.json',
  'verification/modules/M00-03.json', 'verification/modules/M00-04.json',
  'docs/architecture/m00-03-mysql-foundation.md', 'docs/runbooks/m00-03-mysql-foundation.md',
  'docs/architecture/m00-04-redis-foundation.md', 'docs/runbooks/m00-04-redis-foundation.md',
  'verification/modules/M00-05.json', 'docs/architecture/m00-05-api-foundation.md',
  'docs/runbooks/m00-05-api-foundation.md',
  'verification/modules/M00-06.json', 'docs/architecture/m00-06-file-audit-foundation.md',
  'docs/runbooks/m00-06-file-audit-foundation.md',
  'verification/modules/M00-08.json', 'infra/baota/README.md', 'infra/baota/service-manifest.json',
  'infra/baota/nginx/scoutops.conf.template', 'docs/architecture/m00-08-baota-s0-foundation.md',
  'docs/runbooks/m00-08-baota-s0-foundation.md',
  'verification/modules/M01-01.json', 'docs/architecture/m01-01-local-identity.md',
  'docs/runbooks/m01-01-local-identity.md',
  'docs/architecture/m00-02-config-boundary.md', 'docs/runbooks/m00-02-config-boundary.md',
  'docs/architecture/m00-01-scope.md', 'docs/architecture/m00-07-verification-scope.md',
  'docs/runbooks/m00-01-repository-foundation.md', 'docs/runbooks/m00-07-verification-framework.md',
  'plans/README.md', 'plans/phase-00-foundation.md', 'plans/phase-01-identity-tenancy.md',
  'plans/phase-02-ui-shells.md', 'plans/phase-03-sources-collection.md',
  'plans/phase-04-selection-decision.md', 'plans/phase-05-collaboration-realtime.md',
  'plans/phase-06-admin-open-platform.md', 'plans/phase-07-release-production.md',
  'plans/phase-08-scale-ha.md'
];

for (const file of required) await access(resolve(process.cwd(), file));
JSON.parse(await readFile(resolve(process.cwd(), 'docs/feature-map.json'), 'utf8'));
const openapi = await readFile(resolve(process.cwd(), 'docs/openapi.yaml'), 'utf8');
if (!openapi.startsWith('openapi: 3.0.3')) throw new Error('OpenAPI version declaration is missing.');
console.log(`Documentation gate passed (${required.length} required files).`);
