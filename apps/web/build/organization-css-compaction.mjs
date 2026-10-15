export function factorClassAlternatives(selectors) {
  if (selectors.length < 2 || selectors.some((selector) => /[()[\]\\]/u.test(selector)))
    return selectors;
  let result = [...selectors];
  while (true) {
    const groups = new Map();
    for (const [index, selector] of result.entries()) {
      const tokens = selector.trim().split(/\s+/u);
      for (const [position, token] of tokens.entries()) {
        if (!/^\.[A-Za-z_][\w-]*$/u.test(token)) continue;
        const key = JSON.stringify([
          position,
          tokens.map((part, i) => (i === position ? null : part)),
        ]);
        const group = groups.get(key) ?? { tokens, position, entries: [] };
        group.entries.push({ index, token });
        groups.set(key, group);
      }
    }
    let best = null;
    for (const group of groups.values()) {
      if (group.entries.length < 2) continue;
      const tokens = [...group.tokens];
      tokens[group.position] = `:is(${group.entries.map((entry) => entry.token).join(",")})`;
      const selector = tokens.join(" ");
      const previous = group.entries.map((entry) => result[entry.index]).join(",");
      const saving = previous.length - selector.length;
      if (saving > 0 && (!best || saving > best.saving)) best = { group, selector, saving };
    }
    if (!best) return result;
    const indices = new Set(best.group.entries.map((entry) => entry.index));
    result = result.flatMap((selector, index) =>
      index === best.group.entries[0].index
        ? [best.selector]
        : indices.has(index)
          ? []
          : [selector],
    );
  }
}

// A class-only :is() alternative has the same specificity as each original class.
// Factor only one top-level compound at a time; functions, attributes and escapes
// are deliberately excluded. Declarations and rule order are never changed.
export function compactOrganizationSelectors() {
  return {
    postcssPlugin: "scoutops-organization-selector-compaction",
    Rule(rule) {
      const source = rule.source?.input?.file?.replaceAll("\\", "/");
      if (!source?.endsWith("/organization-admin.css")) return;
      const before = rule.selectors;
      const after = factorClassAlternatives(before);
      if (after.join(",") !== before.join(",")) rule.selectors = after;
    },
  };
}
