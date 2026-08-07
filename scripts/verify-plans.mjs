import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const phaseFiles = [
  'phase-00-foundation.md',
  'phase-01-identity-tenancy.md',
  'phase-02-ui-shells.md',
  'phase-03-sources-collection.md',
  'phase-04-selection-decision.md',
  'phase-05-collaboration-realtime.md',
  'phase-06-admin-open-platform.md',
  'phase-07-release-production.md',
  'phase-08-scale-ha.md'
];

const root = process.cwd();
const readPlan = (file) => readFile(resolve(root, 'plans', file), 'utf8');
const overview = await readFile(resolve(root, 'plans', 'README.md'), 'utf8');
const seenModules = new Set();
let moduleCount = 0;

for (const file of phaseFiles) {
  const content = await readPlan(file);
  if (!content.startsWith('# P')) throw new Error(`${file}: missing phase heading.`);
  const lineCount = content.split(/\r?\n/).length;
  if (lineCount < 1000) throw new Error(`${file}: expected at least 1,000 lines, found ${lineCount}.`);
  if (!content.includes('自动验收')) throw new Error(`${file}: missing automated acceptance column.`);
  const rows = content.matchAll(/^### (M\d{2}-\d{2}) 原子任务索引$/gm);
  let count = 0;
  for (const row of rows) {
    const id = row[1];
    if (seenModules.has(id)) throw new Error(`${file}: duplicate module ${id}.`);
    seenModules.add(id);
    count += 1;
  }
  if (count < 5) throw new Error(`${file}: expected at least five independently verifiable modules.`);
  moduleCount += count;
}

if (moduleCount < 50) throw new Error(`Expected at least 50 micro-modules, found ${moduleCount}.`);
for (let phase = 0; phase <= 8; phase += 1) {
  const label = `P${String(phase).padStart(2, '0')}`;
  if (!overview.includes(label)) throw new Error(`plans/README.md: missing ${label}.`);
}
console.log(`Plan structure passed (${phaseFiles.length} phases, ${moduleCount} micro-modules).`);
