// Run against a read-only MySQL 5.7 connection. Derived rows only; no tables or data written.
export async function runAutomaticPrimaryQueryFixtures(pool, sql) {
  const quote = (v) =>
    typeof v === "number"
      ? String(v)
      : v === null
        ? "NULL"
        : "'" + String(v).replaceAll("'", "''") + "'";
  const columns = {
    opportunities: ["id", "organization_id", "workspace_id"],
    opportunity_evidence_links: [
      "opportunity_id",
      "organization_id",
      "workspace_id",
      "raw_evidence_id",
      "created_at",
      "observed_at",
    ],
    normalized_records: [
      "id",
      "organization_id",
      "workspace_id",
      "provider_id",
      "raw_evidence_id",
      "record_key",
      "payload_json",
      "status",
      "created_at",
      "record_version",
    ],
    providers: ["id", "code", "status"],
  };
  const payload = (asin, price) =>
    JSON.stringify({
      asin,
      title: "Observed " + asin,
      price,
      currency: "USD",
      canonical_url: "https://www.amazon.com/dp/" + asin,
    });
  const base = () => ({
    opportunities: [["opp", "org", "ws"]],
    opportunity_evidence_links: [
      ["opp", "org", "ws", "raw-a", "2026-10-17 10:00:00", "2026-10-17 10:00:00"],
      ["opp", "org", "ws", "raw-b", "2026-10-17 11:00:00", "2026-10-17 11:00:00"],
    ],
    normalized_records: [
      [
        "a1",
        "org",
        "ws",
        "amazon",
        "raw-a",
        "key-a",
        payload("B000000001", 10),
        "superseded",
        "2026-10-17 10:00:00",
        1,
      ],
      [
        "a2",
        "org",
        "ws",
        "amazon",
        "current-a",
        "key-a",
        payload("B000000001", 20),
        "active",
        "2026-10-17 12:00:00",
        2,
      ],
      [
        "b1",
        "org",
        "ws",
        "amazon",
        "raw-b",
        "key-b",
        payload("B000000002", 30),
        "active",
        "2026-10-17 11:00:00",
        1,
      ],
    ],
    providers: [["amazon", "amazon_product", "enabled"]],
  });
  const cases = [
    { name: "original-linked-identity-current-version", expected: "current-a", mutate: () => {} },
    {
      name: "quarantined-current-is-excluded",
      expected: "raw-b",
      mutate: (d) => (d.normalized_records[1][7] = "quarantined"),
    },
    {
      name: "cross-workspace-current-is-excluded",
      expected: "raw-b",
      mutate: (d) => (d.normalized_records[1][2] = "foreign"),
    },
    {
      name: "changed-asin-cannot-replace-seed",
      expected: "raw-b",
      mutate: (d) => (d.normalized_records[1][6] = payload("B000000003", 90)),
    },
    {
      name: "malformed-original-url-is-excluded",
      expected: "raw-b",
      mutate: (d) => {
        d.normalized_records[0][6] = JSON.stringify({
          asin: "B000000001",
          canonical_url: "https://evil.test/dp/B000000001",
        });
      },
    },
    {
      name: "latest-active-version-is-atomic",
      expected: "current-a3",
      mutate: (d) =>
        d.normalized_records.push([
          "a3",
          "org",
          "ws",
          "amazon",
          "current-a3",
          "key-a",
          payload("B000000001", null),
          "active",
          "2026-10-17 13:00:00",
          3,
        ]),
    },
    {
      name: "disabled-provider-status-is-preserved",
      expected: "current-a",
      mutate: (d) => (d.providers[0][2] = "disabled"),
    },
    {
      name: "no-current-source-gives-no-facts",
      expected: null,
      mutate: (d) => {
        d.normalized_records[1][7] = "quarantined";
        d.normalized_records[2][7] = "quarantined";
      },
    },
  ];
  const results = [];
  for (const item of cases) {
    const data = base();
    item.mutate(data);
    const fixture = (query) => {
      query = query.replaceAll(/ FORCE INDEX \([a-z_]+\)/g, "");
      for (const [name, cols] of Object.entries(columns))
        query = query.replaceAll(
          new RegExp("\\b" + name + "(?= [a-z_])", "g"),
          () =>
            "(" +
            data[name]
              .map((row) => "SELECT " + cols.map((col, i) => quote(row[i]) + " " + col).join(","))
              .join(" UNION ALL ") +
            ")",
        );
      return query;
    };
    const [expected] = await pool.query(fixture(sql.reference), ["opp", "org", "ws"]);
    const [actual] = await pool.query(fixture(sql.current), ["opp", "org", "ws"]);
    if (
      JSON.stringify(actual) !== JSON.stringify(expected) ||
      (actual[0]?.raw_evidence_id ?? null) !== item.expected
    )
      throw Error(item.name + ":facts_mismatch");
    results.push({ name: item.name, matched: true });
    const [foreign] = await pool.query(fixture(sql.current), ["opp", "org", "foreign"]);
    if (foreign.length) throw Error(item.name + ":scope_leak");
  }
  return results;
}
