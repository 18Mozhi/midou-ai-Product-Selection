/** Derived tables exercise the real MySQL 5.7 predicate without changing any stored rows. */
export function buildPublicRssRecoveryQueryFixtures(sql, codes) {
  const id = "00000000-0000-4000-8000-000000000015";
  const actor = "00000000-0000-4000-8000-000000000016";
  const baseline = {
    status: "enabled",
    access_mode: "public_rss",
    terms_review_status: "approved",
    terms_version: "owner-reviewed",
    terms_permanent: 1,
    terms_expires_at: null,
    parser_version: "syndication-feed-v1",
    code: "feed_techcrunch",
    actor_status: "active",
    circuit_state: "open",
    error: "timeout",
    opened: "2026-10-18 02:00:00",
    checked: "2026-10-18 01:50:00",
    health: "degraded",
  };
  const cases = [
    ["approved permanent source", {}, true],
    ["future review expiry", { terms_permanent: 0, terms_expires_at: "2026-10-18 04:00:00" }, true],
    ["pending review", { terms_review_status: "pending" }, false],
    ["disabled source", { status: "disabled" }, false],
    ["expired review", { terms_permanent: 0, terms_expires_at: "2026-10-18 02:59:00" }, false],
    ["blank review version", { terms_version: "" }, false],
    ["inactive actor", { actor_status: "disabled" }, false],
    ["unregistered source", { code: "unregistered" }, false],
    ["browser source", { access_mode: "authenticated_browser" }, false],
    ["unsupported parser", { parser_version: "google-news-fixed-rss-v1" }, false],
    ["permanent denial", { error: "permission_denied" }, false],
    ["closed circuit", { circuit_state: "closed" }, false],
    ["incident cooling", { opened: "2026-10-18 02:56:00" }, false],
    ["probe cooling", { checked: "2026-10-18 02:56:00" }, false],
    ["blocked since incident", { health: "blocked", checked: "2026-10-18 02:10:00" }, false],
    ["old blocked check predates incident", { health: "blocked" }, true],
    ["no previous health", { checked: null, health: null }, true],
  ];
  const literal = (value) =>
    value == null
      ? "NULL"
      : typeof value === "number"
        ? String(value)
        : `'${String(value).replaceAll("'", "''")}'`;
  return cases.map(([name, change, eligible]) => {
    const value = { ...baseline, ...change };
    const provider = {
      id,
      version: 2,
      ...Object.fromEntries(
        [
          "status",
          "access_mode",
          "terms_review_status",
          "terms_version",
          "terms_permanent",
          "terms_expires_at",
          "parser_version",
          "code",
        ].map((key) => [key, value[key]]),
      ),
    };
    const select = (row) =>
      `(SELECT ${Object.entries(row)
        .map(([key, item]) => `${literal(item)} ${key}`)
        .join(",")})`;
    const query = sql
      .replace("FROM providers p", () => `FROM ${select(provider)} p`)
      .replace(
        "JOIN users recovery_actor",
        () => `JOIN ${select({ id: actor, status: value.actor_status })} recovery_actor`,
      )
      .replace(
        "JOIN provider_runtime_circuits c",
        () =>
          `JOIN ${select({ provider_id: id, state: value.circuit_state, last_error_code: value.error, opened_at: value.opened })} c`,
      )
      .replace(
        "JOIN provider_adapter_health h",
        () =>
          `JOIN ${select({ provider_id: id, health_status: value.health, last_checked_at: value.checked })} h`,
      );
    return {
      name,
      query,
      params: [
        actor,
        "2026-10-18 03:00:00",
        ...codes,
        "2026-10-18 02:55:00",
        "2026-10-18 02:55:00",
      ],
      expected: eligible ? [id] : [],
    };
  });
}
