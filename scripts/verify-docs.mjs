import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const required = [
  'README.md', 'AGENTS.md', 'new-product-enterprise-blueprint.md',
  'docs/openapi.yaml', 'docs/feature-map.json', 'config/env.example',
  'infra/docker-compose.dev.yml', 'scripts/locate_flow_v4.mjs',
  'scripts/verify-docs.mjs', 'scripts/verify-plans.mjs', 'package.json', '.gitignore',
  'scripts/verify-module.mjs', 'scripts/verify-phase.mjs', 'scripts/verify-all.mjs', 'scripts/verify-functional.mjs',
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
  'verification/modules/M01-02.json', 'docs/architecture/m01-02-mfa-identity-adapters.md',
  'docs/runbooks/m01-02-mfa-identity-adapters.md',
  'verification/modules/M01-03.json', 'docs/architecture/m01-03-tenancy-context.md',
  'docs/runbooks/m01-03-tenancy-context.md',
  'verification/modules/M01-04.json', 'docs/architecture/m01-04-rbac-data-scope.md',
  'docs/runbooks/m01-04-rbac-data-scope.md',
  'verification/modules/M01-05.json', 'docs/architecture/m01-05-resource-grants.md',
  'docs/runbooks/m01-05-resource-grants.md',
  'verification/modules/M02-01.json', 'docs/architecture/m02-01-design-tokens-themes.md',
  'docs/runbooks/m02-01-design-tokens-themes.md',
  'verification/modules/M02-02.json', 'docs/architecture/m02-02-auth-onboarding-pages.md',
  'docs/runbooks/m02-02-auth-onboarding-pages.md',
  'verification/modules/M02-03.json', 'docs/architecture/m02-03-navigation-shells.md',
  'docs/runbooks/m02-03-navigation-shells.md',
  'verification/modules/M02-04.json', 'docs/architecture/m02-04-common-ui-states.md',
  'docs/runbooks/m02-04-common-ui-states.md',
  'verification/modules/M02-05.json', 'docs/architecture/m02-05-discovery.md',
  'docs/runbooks/m02-05-discovery.md',
  'verification/modules/M02-06.json', 'docs/architecture/m02-06-home-mobile.md',
  'docs/runbooks/m02-06-home-mobile.md',
  'verification/modules/M03-01.json', 'docs/architecture/m03-01-provider-registry.md',
  'docs/runbooks/m03-01-provider-registry.md',
  'verification/modules/M03-02.json', 'docs/architecture/m03-02-credential-assets.md',
  'docs/runbooks/m03-02-credential-assets.md',
  'verification/modules/M03-03.json', 'docs/architecture/m03-03-provider-adapters.md',
  'docs/runbooks/m03-03-provider-adapters.md',
  'verification/modules/M03-04.json', 'docs/architecture/m03-04-playwright-crawler.md',
  'docs/runbooks/m03-04-playwright-crawler.md',
  'docs/architecture/m00-02-config-boundary.md', 'docs/runbooks/m00-02-config-boundary.md',
  'docs/architecture/m00-01-scope.md', 'docs/architecture/m00-07-verification-scope.md',
  'docs/runbooks/m00-01-repository-foundation.md', 'docs/runbooks/m00-07-verification-framework.md',
  'plans/README.md', 'plans/phase-00-foundation.md', 'plans/phase-01-identity-tenancy.md',
  'plans/phase-02-ui-shells.md', 'plans/phase-03-sources-collection.md',
  'plans/phase-04-selection-decision.md', 'plans/phase-05-collaboration-realtime.md',
  'plans/phase-06-admin-open-platform.md', 'plans/phase-07-release-production.md',
  'plans/phase-08-scale-ha.md'
  ,'verification/modules/M06-02.json', 'docs/architecture/m06-02-platform-dashboard.md',
  'docs/runbooks/m06-02-platform-dashboard.md'
  ,'verification/modules/M06-03.json', 'docs/architecture/m06-03-collection-console.md',
  'docs/runbooks/m06-03-collection-console.md'
  ,'verification/modules/M06-04.json', 'docs/architecture/m06-04-security-operations.md',
  'verification/modules/M06-05.json', 'docs/architecture/m06-05-open-platform.md', 'docs/runbooks/m06-05-open-platform.md',
  'verification/modules/M06-06.json', 'docs/architecture/m06-06-commercial.md', 'docs/runbooks/m06-06-commercial.md',
  'verification/release-matrix.json', 'scripts/verify-release-matrix.mjs',
  'verification/modules/M07-01.json', 'docs/architecture/m07-01-release-matrix.md',
  'docs/runbooks/m07-01-release-matrix.md',
  'verification/security-gate.json', 'scripts/verify-security-gate.mjs',
  'verification/modules/M07-02.json', 'docs/architecture/m07-02-security-gate.md',
  'docs/runbooks/m07-02-security-gate.md',
  'scripts/verify-baota-deployment.mjs', 'verification/baota-production-evidence.schema.json',
  'verification/modules/M07-03.json', 'docs/architecture/m07-03-baota-deployment.md',
  'docs/runbooks/m07-03-baota-deployment.md',
  'docs/runbooks/m06-04-security-operations.md'
];

for (const file of required) await access(resolve(process.cwd(), file));
const featureMap = JSON.parse(await readFile(resolve(process.cwd(), 'docs/feature-map.json'), 'utf8'));
const routeCounts = new Map();
for (const route of featureMap.routes ?? []) routeCounts.set(route.path, (routeCounts.get(route.path) ?? 0) + 1);
const duplicateRoutes = [...routeCounts].filter(([, count]) => count > 1).map(([path]) => path);
if (duplicateRoutes.length) throw new Error(`Feature Map contains duplicate routes: ${duplicateRoutes.join(', ')}`);
const openapi = await readFile(resolve(process.cwd(), 'docs/openapi.yaml'), 'utf8');
if (!openapi.startsWith('openapi: 3.0.3')) throw new Error('OpenAPI version declaration is missing.');
const [readme, blueprint, deployment] = await Promise.all([
  readFile(resolve(process.cwd(), 'README.md'), 'utf8'),
  readFile(resolve(process.cwd(), 'new-product-enterprise-blueprint.md'), 'utf8'),
  readFile(resolve(process.cwd(), 'infra/baota/README.md'), 'utf8'),
]);
const deploymentTruth = `${readme}\n${blueprint}\n${deployment}`;
for (const path of ['/www/wwwroot/ai选品/frontend', '/www/wwwroot/ai选品/backend', '/www/wwwroot/ai选品/python']) {
  if (!deploymentTruth.includes(path)) throw new Error(`Fixed BaoTa path is missing from canonical docs: ${path}`);
}
if (/ai选品\/current|使用版本目录、?`current`|`current` 原子/.test(deploymentTruth)) throw new Error('Canonical deployment docs still describe the retired current/releases topology.');
console.log(`Documentation gate passed (${required.length} required files).`);
