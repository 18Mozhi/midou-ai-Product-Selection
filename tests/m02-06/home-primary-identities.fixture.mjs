// Pure fixture runner: callers supply a read-only MySQL connection and compiled
// production SQL. No schema, data or session configuration is written.
export async function runPrimaryIdentityFixtures(pool, sql) {
  const quote = (value) =>
    value === null
      ? "NULL"
      : typeof value === "number"
        ? String(value)
        : "'" + String(value).replaceAll("'", "''") + "'";
  const table = (rows, columns) =>
    "(" +
    rows
      .map((row) => "SELECT " + columns.map((column, i) => quote(row[i]) + " " + column).join(","))
      .join(" UNION ALL ") +
    ")";
  const cols = {
    opportunities: ["id", "organization_id", "workspace_id", "created_at", "lifecycle_status"],
    opportunity_evidence_links: [
      "opportunity_id",
      "organization_id",
      "workspace_id",
      "raw_evidence_id",
      "created_at",
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
    providers: ["id", "code"],
  };
  const payload = (asin) =>
    JSON.stringify({ asin, canonical_url: "https://www.amazon.com/dp/" + asin });
  const base = () => ({
    opportunities: [["o", "org", "ws", "2026-10-17 12:00:00.000", "active"]],
    opportunity_evidence_links: [
      ["o", "org", "ws", "raw-a", "2026-10-17 12:00:00.000"],
      ["o", "org", "ws", "raw-b", "2026-10-17 13:00:00.000"],
    ],
    normalized_records: [
      [
        "a1",
        "org",
        "ws",
        "provider",
        "raw-a",
        "key-a",
        payload("B000000001"),
        "superseded",
        "2026-10-17 12:00:00.000",
        1,
      ],
      [
        "a2",
        "org",
        "ws",
        "provider",
        "current-a",
        "key-a",
        payload("B000000001"),
        "active",
        "2026-10-18 12:00:00.000",
        2,
      ],
      [
        "b1",
        "org",
        "ws",
        "provider",
        "raw-b",
        "key-b",
        payload("B000000002"),
        "active",
        "2026-10-17 13:00:00.000",
        1,
      ],
    ],
    providers: [["provider", "amazon_product"]],
  });
  const cases = [
    {
      name: "oldest evidence link wins over newer product",
      expected: "B000000001",
      change: () => {},
    },
    {
      name: "latest normalization within first link wins",
      expected: "B000000002",
      change: (d) =>
        d.normalized_records.push([
          "b2",
          "org",
          "ws",
          "provider",
          "raw-a",
          "key-b",
          payload("B000000002"),
          "superseded",
          "2026-10-17 12:30:00.000",
          2,
        ]),
    },
    {
      name: "quarantined seed excluded",
      expected: "B000000002",
      change: (d) => (d.normalized_records[0][7] = "quarantined"),
    },
    {
      name: "inactive current identity excluded",
      expected: "B000000002",
      change: (d) => (d.normalized_records[1][7] = "superseded"),
    },
    {
      name: "current ASIN mismatch excluded",
      expected: "B000000002",
      change: (d) => (d.normalized_records[1][6] = payload("B000000003")),
    },
    {
      name: "invalid current canonical URL excluded",
      expected: "B000000002",
      change: (d) =>
        (d.normalized_records[1][6] = JSON.stringify({
          asin: "B000000001",
          canonical_url: "https://example.com/B000000001",
        })),
    },
    {
      name: "foreign workspace seed excluded",
      expected: "B000000002",
      change: (d) => (d.normalized_records[0][2] = "foreign"),
    },
    {
      name: "foreign organization link excluded",
      expected: "B000000002",
      change: (d) => (d.opportunity_evidence_links[0][1] = "foreign"),
    },
    {
      name: "non Amazon provider excluded",
      expected: null,
      change: (d) => (d.providers[0][1] = "other"),
    },
    {
      name: "historical archived identity still deduplicates",
      expected: "B000000001",
      dailyExpected: null,
      change: (d) => (d.opportunities[0][4] = "archived"),
    },
    {
      name: "future opportunity excluded from historical",
      expected: null,
      dailyExpected: null,
      change: (d) => (d.opportunities[0][3] = "2026-10-19 00:00:00.000"),
    },
    {
      name: "duplicate matching active versions keep same ASIN",
      expected: "B000000001",
      change: (d) =>
        d.normalized_records.push([
          "a3",
          "org",
          "ws",
          "provider",
          "current-a3",
          "key-a",
          payload("B000000001"),
          "active",
          "2026-10-18 13:00:00.000",
          3,
        ]),
    },
  ];
  const results = [];
  for (const item of cases) {
    const data = base();
    item.change(data);
    const fixture = (value) => {
      let query = value.replaceAll(/ FORCE INDEX \([a-z_]+\)/g, "");
      for (const [name, columns] of Object.entries(cols))
        query = query.replaceAll(new RegExp("\\b" + name + "(?= [a-z_])", "g"), () =>
          table(data[name], columns),
        );
      return query;
    };
    const [oldRows] = await pool.query(
      fixture(
        "SELECT " +
          sql.scalar +
          " main_asin FROM opportunities o WHERE o.organization_id=? AND o.workspace_id=? AND o.created_at<?",
      ),
      ["org", "ws", "2026-10-18 00:00:00.000"],
    );
    const old = oldRows[0]?.main_asin ?? null;
    for (const fallback of [false, true]) {
      const grouped = fixture(
        fallback
          ? sql.historical.replace("@@session.group_concat_max_len>=10", "0=1")
          : sql.historical,
      );
      const [rows] = await pool.query(grouped, ["org", "ws", "2026-10-18 00:00:00.000"]);
      const value = rows[0]?.main_asin ?? null;
      if (value !== old || value !== item.expected)
        throw Error(
          item.name +
            ":identity_mismatch:" +
            JSON.stringify({ value, old, expected: item.expected, fallback }),
        );
    }
    const [dailyRows] = await pool.query(fixture(sql.daily), [
      "org",
      "ws",
      "2026-10-17 00:00:00.000",
      "2026-10-18 00:00:00.000",
    ]);
    const daily = dailyRows[0]?.main_asin ?? null;
    if (daily !== (Object.hasOwn(item, "dailyExpected") ? item.dailyExpected : item.expected))
      throw Error(item.name + ":daily_mismatch");
    results.push({ name: item.name, identity: old, fastAndFallback: true, daily: true });
  }
  return results;
}
