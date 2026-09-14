import path from "node:path";

// Vite's module graph does not expose CSS folded into an owner by PostCSS @import.
// Include only literal local stylesheet imports from already observed CSS/Vue sources.
export async function includeImportedStyleSources(sources, read) {
  const root = path.resolve("apps/web/src");
  const pending = [...sources];
  const seen = new Set();
  while (pending.length) {
    const file = pending.shift();
    if (seen.has(file) || !/\.(css|vue)$/.test(file)) continue;
    seen.add(file);
    const source = await read(file);
    for (const [, relative] of source.matchAll(/@import\s+["'](\.[^"']+\.css)["']\s*;/g)) {
      const absolute = path.resolve(path.dirname(file), relative);
      const fromRoot = path.relative(root, absolute);
      if (fromRoot.startsWith("..") || path.isAbsolute(fromRoot))
        throw new Error(`Stylesheet import leaves web source: ${file}`);
      const imported = path.relative(process.cwd(), absolute).replaceAll("\\", "/");
      sources.add(imported);
      pending.push(imported);
    }
  }
}
