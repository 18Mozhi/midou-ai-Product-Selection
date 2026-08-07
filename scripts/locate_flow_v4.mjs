import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const query = process.argv.slice(2).join(' ').trim().toLowerCase();
if (!query) {
  console.error('Usage: node scripts/locate_flow_v4.mjs "keyword"');
  process.exitCode = 1;
} else {
  const mapPath = resolve(process.cwd(), 'docs', 'feature-map.json');
  const map = JSON.parse(await readFile(mapPath, 'utf8'));
  const sections = ['routes', 'apiGroups', 'runtime', 'externalDependencies'];
  const matches = sections.flatMap((section) =>
    (map[section] ?? [])
      .filter((entry) => Object.values(entry).join(' ').toLowerCase().includes(query))
      .map((entry) => ({ section, ...entry }))
  );

  console.log(JSON.stringify({ query, source: 'docs/feature-map.json', matches }, null, 2));
  if (matches.length === 0) process.exitCode = 2;
}
