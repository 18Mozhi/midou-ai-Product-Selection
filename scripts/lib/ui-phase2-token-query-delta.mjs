import assert from "node:assert/strict";

// Exact inverse of the P36 query-only patch. Other business code stays byte-identical.
// Behavioral regression tests separately exercise these real watch callbacks.
const changes = [
  [
    String.raw`import { computed, ref, watch } from "vue";`,
    String.raw`import { computed, nextTick, ref, watch } from "vue";`,
  ],
  [
    String.raw``,
    String.raw`const queryOwnerPath = route.path,
  pendingQueryWrites = new Map<string, number>();
let restoringQuery = false,
  queryRestoreGeneration = 0,
  queryWriteGeneration = 0;

`,
  ],
  [
    String.raw`watch([tokenQuery, statusFilter, scopeFilter, tokenSort], () => (tokenPage.value = 1));
`,
    String.raw`watch([tokenQuery, statusFilter, scopeFilter, tokenSort], () => {
  if (!restoringQuery) tokenPage.value = 1;
});
`,
  ],
  [
    String.raw`watch(
  [tokenQuery, statusFilter, scopeFilter, tokenSort, tokenPage],
  () => {
    const query = { ...route.query } as Record<string, string | string[] | null | undefined>;
    setQuery(query, "org_token_query", tokenQuery.value, "");
    setQuery(query, "org_token_status", statusFilter.value, "all");
    setQuery(query, "org_token_scope", scopeFilter.value, "all");
    setQuery(query, "org_token_sort", tokenSort.value, "created_desc");
    setQuery(query, "org_token_page", String(tokenPage.value), "1");
    void router.replace({ query });
  },
  { flush: "post" },
);
`,
    String.raw`watch(
  [tokenQuery, statusFilter, scopeFilter, tokenSort, tokenPage],
  () => {
    if (restoringQuery || route.path !== queryOwnerPath) return;
    const query = { ...route.query } as Record<string, string | string[] | null | undefined>;
    setQuery(query, "org_token_query", tokenQuery.value, "");
    setQuery(query, "org_token_status", statusFilter.value, "all");
    setQuery(query, "org_token_scope", scopeFilter.value, "all");
    setQuery(query, "org_token_sort", tokenSort.value, "created_desc");
    setQuery(query, "org_token_page", String(tokenPage.value), "1");
    const key = queryFingerprint(query);
    if (key === queryFingerprint(route.query)) return;
    const generation = ++queryWriteGeneration;
    pendingQueryWrites.set(key, generation);
    const settled = () => {
      if (pendingQueryWrites.get(key) === generation) pendingQueryWrites.delete(key);
    };
    void Promise.resolve(router.replace({ query })).then(settled, settled);
  },
  { flush: "post" },
);
`,
  ],
  [
    String.raw``,
    String.raw`watch(
  [() => route.path, () => route.query],
  async () => {
    if (route.path !== queryOwnerPath || pendingQueryWrites.has(queryFingerprint(route.query)))
      return;
    const generation = ++queryRestoreGeneration;
    restoringQuery = true;
    tokenQuery.value = queryText("org_token_query");
    statusFilter.value = queryChoice(
      "org_token_status",
      ["all", "active", "expiring", "never_used", "revoked", "rotated", "expired"],
      "all",
    ) as TokenStatusFilter;
    scopeFilter.value = queryChoice(
      "org_token_scope",
      ["all", "task:read", "trend:read", "opportunity:read", "report:read"],
      "all",
    );
    tokenSort.value = queryChoice(
      "org_token_sort",
      ["created_desc", "expires_asc", "last_used_desc", "name_asc", "status_asc"],
      "created_desc",
    );
    tokenPage.value = queryPage("org_token_page");
    // Keep the reset watcher and URL writer inside the same restoration batch.
    await nextTick();
    if (queryRestoreGeneration === generation) restoringQuery = false;
  },
  { flush: "sync" },
);

function queryFingerprint(query: Record<string, unknown>) {
  return JSON.stringify(
    Object.keys(query)
      .sort()
      .map((key) => [key, query[key]]),
  );
}

`,
  ],
];

export function undoTokenQuerySync(source) {
  source = source.replaceAll("\r\n", "\n");
  if (!source.includes(changes[0][1])) return source;
  for (const [before, after] of changes) {
    assert.equal(source.split(after).length, 2, "Exact P36 query synchronization delta");
    source = source.replace(after, before);
  }
  return source;
}
