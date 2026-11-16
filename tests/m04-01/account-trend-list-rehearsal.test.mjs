import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../apps/api/dist/app.js";
import { MySqlTrendRepository } from "../../apps/api/dist/mysql-trend-repository.js";
import { shouldUseAccountReadRehearsal } from "../../apps/api/dist/account-read-rehearsal.js";
import { TrendService } from "../../apps/api/dist/trend-service.js";

const base = {
  nodeEnv: "development",
  app: { host: "127.0.0.1" },
  database: { name: "product_scout_scope_rehearsal", host: "127.0.0.1" },
};
const privateTopic = "00000000-0000-4000-8000-000000000123";

test("account trend reads cannot be activated on production or non-local database targets", () => {
  assert.equal(shouldUseAccountReadRehearsal(base), true);
  assert.equal(shouldUseAccountReadRehearsal({ ...base, nodeEnv: "production" }), false);
  assert.equal(shouldUseAccountReadRehearsal({ ...base, app: { host: "0.0.0.0" } }), false);
  for (const db of [
    { host: "10.1.1.1" },
    { name: "product_scout" },
    { readHost: "127.0.0.1" },
    { writeHost: "127.0.0.1" },
  ]) {
    assert.equal(
      shouldUseAccountReadRehearsal({ ...base, database: { ...base.database, ...db } }),
      false,
    );
  }
});

function fixture({
  ready = true,
  accountReadRehearsal = true,
  grouped = false,
  native = false,
  wrongSharedOwner = false,
} = {}) {
  const events = [];
  const now = new Date("2026-01-01T00:00:00Z");
  const records = {
    primary: [
      { id: "shared1", topic_key: "one", title: "Shared one", followed: "1" },
      { id: "shared2", topic_key: "two", title: "Shared two", followed: "0" },
    ],
    alice: [{ id: "private", topic_key: "one", title: "Alice private" }],
  };
  if (grouped)
    records.primary.splice(1, 0, {
      id: "historical",
      topic_key: "one",
      title: "Historical variant",
      followed: "0",
    });
  const pool = {
    async query(sql, args) {
      events.push(sql);
      if (sql.includes("FROM account_ownership_cutover")) {
        assert.match(sql, /contract_version=25/);
        return [ready ? [{ slot: "current" }] : []];
      }
      if (sql.startsWith("SHOW COLUMNS FROM trend_topics")) {
        return [
          (native ? ["account_id"] : ["organization_id", "workspace_id"]).map((Field) => ({
            Field,
          })),
        ];
      }
      if (!accountReadRehearsal) {
        assert.doesNotMatch(sql, /account_owned_records/);
        assert.match(sql, /t.organization_id=\? AND t.workspace_id=\?/);
        return [[{ total: 0 }]].map((rows) => (sql.startsWith("SELECT COUNT") ? rows : []));
      }
      assert.doesNotMatch(sql, /organization_id|workspace_id/);
      if (sql.includes("WHERE t.id=? AND ao.account_id=?")) {
        assert.match(sql, /ao\.account_id=cut\.primary_account_id/);
        assert.equal(sql.includes("t.account_id=ao.account_id"), native);
        assert.deepEqual(args, [args[2], privateTopic, args[2]]);
        return [
          args[2] === "alice" && !wrongSharedOwner
            ? [
                {
                  id: privateTopic,
                  title: "Alice private",
                  market: "US",
                  language: "en",
                  first_seen_at: now,
                  last_seen_at: now,
                  source_fresh_at: now,
                  heat_value: 1,
                  signal_count: 1,
                  source_count: 1,
                  version: 1,
                },
              ]
            : [],
        ];
      }
      if (sql.includes("FROM trend_topic_keywords WHERE")) {
        assert.match(sql, /ao.source_table='trend_topic_keywords'/);
        assert.deepEqual(args, [privateTopic, "alice"]);
        return [[{ keyword: "owned keyword" }]];
      }
      if (sql.includes("trend_events WHERE resource_type=")) {
        assert.match(sql, /ao.source_table='trend_events'/);
        assert.deepEqual(args, [privateTopic, "alice"]);
        return [
          [
            {
              actor_id: "alice",
              occurred_at: now,
              payload_json: { status: "active", reason: "reviewed", version: 1 },
            },
          ],
        ];
      }
      if (sql.includes("FROM trend_signals") && sql.includes("WHERE topic_id=?")) {
        assert.match(sql, /ao.source_table='trend_signals'/);
        assert.match(
          sql,
          native
            ? /se.account_id=\?[\s\S]+source_table='raw_evidence'/
            : /eo.source_table='raw_evidence'/,
        );
        assert.deepEqual(args.slice(0, 3), [privateTopic, "alice", "alice"]);
        if (sql.includes("GROUP BY provider_id"))
          return [
            [
              {
                provider_id: "source",
                source_label: "Provider",
                at: "2026-01-01",
                signal_count: 1,
              },
            ],
          ];
        if (sql.includes("GROUP BY DATE_FORMAT"))
          return [[{ at: "2026-01-01", signal_count: 1, source_count: 1 }]];
        assert.match(sql, /ORDER BY published_at DESC,id DESC LIMIT \? OFFSET \?/);
        assert.equal(args[3], 101);
        return [
          [
            {
              id: "signal",
              title: "Owned evidence",
              publisher: "Provider",
              canonical_url: "https://example.invalid/source",
              raw_evidence_id: "raw",
              provider_id: "source",
              published_at: now,
              observed_at: now,
            },
          ],
        ];
      }
      if (sql.includes("FROM trend_signals s")) {
        assert.match(sql, /so.account_id=\? AND s.topic_id IN/);
        assert.match(sql, /so2.account_id=so.account_id/);
        assert.match(sql, /nowner.account_id=so.account_id/);
        assert.match(sql, /towner.source_id=s.topic_id/);
        assert.match(sql, /n.raw_evidence_id=s.raw_evidence_id/);
        assert.match(sql, /n.provider_id=s.provider_id/);
        if (native) {
          assert.match(sql, /n.account_id=so.account_id/);
          assert.match(sql, /se.account_id=so2.account_id/);
          assert.match(sql, /se.account_id=so.account_id/);
        }
        return [
          args[1].map((id) => ({
            topic_id: id,
            image_url: `https://example.invalid/${args[0]}/${id}.png`,
          })),
        ];
      }
      assert.match(sql, /ao.source_table='trend_topics' AND ao.source_id=t.id/);
      assert.match(sql, /WHERE ao.account_id=\?/);
      assert.match(
        sql,
        /ao\.reason='exclusive_owner'.*ao\.reason IN \('shared','unassigned'\).*ao\.account_id=cut\.primary_account_id/,
      );
      assert.equal(sql.includes("t.account_id=ao.account_id"), native);
      assert.match(sql, /ko.account_id=\?/);
      const aggregate = sql.startsWith("SELECT COUNT") || sql.startsWith("SELECT t.topic_key");
      const accountId = aggregate ? args[0] : args[1];
      const accountOffset = aggregate ? 0 : 1;
      assert.equal(args[accountOffset + 2], accountId);
      const matched = wrongSharedOwner && accountId === "alice" ? [] : (records[accountId] ?? []);
      const keys = [...new Set(matched.map((row) => row.topic_key))];
      if (sql.startsWith("SELECT COUNT")) return [[{ total: keys.length }]];
      if (aggregate) {
        assert.match(sql, /GROUP BY t.topic_key.*LIMIT \? OFFSET \?/);
        return [
          keys.slice(args.at(-1), args.at(-1) + args.at(-2)).map((topic_key) => ({ topic_key })),
        ];
      }
      assert.equal(args[0], accountId);
      if (sql.includes("AND EXISTS (SELECT 1 FROM account_trend_topic_follows"))
        assert.equal(args.at(-2), accountId);
      return [
        matched
          .filter((row) => args.at(-1).includes(row.topic_key))
          .map((row) => ({
            ...row,
            market: "US",
            language: "en",
            first_seen_at: now,
            last_seen_at: now,
            source_fresh_at: now,
            heat_value: 0,
            signal_count: 0,
            source_count: 0,
            version: 1,
            status: "active",
          })),
      ];
    },
  };
  const app = buildApp({
    trends: {
      accountReadRehearsal,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
      service: new TrendService(new MySqlTrendRepository(pool)),
      auth: {
        async authenticate(id) {
          return {
            user: { id, email_verified_at: id === "unverified" ? null : now },
            session: { id: "s" },
          };
        },
      },
      authorization: {
        async resolveSession() {
          assert.equal(accountReadRehearsal, false);
          events.push("resolve_legacy_scope");
          return { context: { organization_id: "org", workspace_id: "legacy" } };
        },
        async authorize() {
          assert.equal(accountReadRehearsal, false);
          events.push("legacy_permission");
        },
      },
    },
  });
  return {
    app,
    events,
    list: (id) =>
      app.inject({
        url: "/api/v1/trends?q=test&followed=true&page_size=1&account_id=primary&workspace_id=legacy",
        headers: { cookie: `scoutops_session=${id}` },
      }),
  };
}

test("account pagination counts topics, keeps matching history IDs, and never includes another owner", async () => {
  const { app } = fixture({ grouped: true, native: true });
  try {
    const load = (page) =>
      app.inject({
        url: `/api/v1/trends?q=test&page_size=1&page=${page}`,
        headers: { cookie: "scoutops_session=primary" },
      });
    const first = await load(1);
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().meta.total, 2);
    assert.deepEqual(
      first.json().data[0].topic_variants.map(({ id }) => id),
      ["shared1", "historical"],
    );
    const second = await load(2);
    assert.equal(second.statusCode, 200, second.body);
    assert.deepEqual(
      second.json().data.map(({ id }) => id),
      ["shared2"],
    );
    assert.equal(second.json().data[0].topic_variants, undefined);
  } finally {
    await app.close();
  }
});

test("account-scoped HTTP list uses only session identity, including total, follow and media", async () => {
  const f = fixture();
  try {
    for (const [id, expectedRow, expectedTotal] of [
      ["alice", "private", 1],
      ["primary", "shared1", 2],
    ]) {
      const response = await f.list(id);
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.headers["cache-control"], "private, no-store");
      assert.equal(response.json().meta.total, expectedTotal);
      assert.deepEqual(
        response.json().data.map((row) => [row.id, row.image_url]),
        [[expectedRow, `https://example.invalid/${id}/${expectedRow}.png`]],
      );
    }
    const calls = f.events.length;
    assert.equal((await f.list("unverified")).statusCode, 403);
    assert.equal((await f.app.inject({ url: "/api/v1/trends" })).statusCode, 401);
    assert.equal(f.events.length, calls);
  } finally {
    await f.app.close();
  }
});

test("shared ownership cannot appear in a non-primary account's grouped list or direct detail", async () => {
  const f = fixture({ native: true, wrongSharedOwner: true });
  try {
    const list = await f.list("alice");
    assert.equal(list.statusCode, 200, list.body);
    assert.equal(list.json().meta.total, 0);
    assert.deepEqual(list.json().data, []);
    const detail = await f.app.inject({
      url: `/api/v1/trends/${privateTopic}`,
      headers: { cookie: "scoutops_session=alice" },
    });
    assert.equal(detail.statusCode, 404, detail.body);
  } finally {
    await f.app.close();
  }
});

test("MySQL string-valued EXISTS maps '0' to not followed and '1' to followed", async () => {
  const f = fixture();
  try {
    const response = await f.app.inject({
      url: "/api/v1/trends?q=test&page_size=2",
      headers: { cookie: "scoutops_session=primary" },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(
      response.json().data.map(({ id, followed }) => [id, followed]),
      [
        ["shared1", true],
        ["shared2", false],
      ],
    );
  } finally {
    await f.app.close();
  }
});

test("missing account backfill fails closed and default mode retains legacy permission checks", async () => {
  const unready = fixture({ ready: false });
  const legacy = fixture({ accountReadRehearsal: false });
  try {
    const failure = await unready.list("alice");
    assert.equal(failure.statusCode, 503, failure.body);
    assert.equal(failure.json().error.code, "account_ownership_not_ready");
    assert.equal(unready.events.length, 1);
    const response = await legacy.list("alice");
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(legacy.events.slice(0, 2), ["resolve_legacy_scope", "legacy_permission"]);
  } finally {
    await Promise.all([unready.app.close(), legacy.app.close()]);
  }
});

test("account detail checks root ownership before reading protected child records", async () => {
  const f = fixture({ native: true });
  const get = (id) =>
    f.app.inject({
      url: `/api/v1/trends/${privateTopic}?account_id=alice`,
      headers: { cookie: `scoutops_session=${id}` },
    });
  try {
    await f.app.ready();
    for (const [method, url] of [
      ["POST", "/api/v1/trends/monitoring-rules"],
      ["GET", "/api/v1/trends/change-requests"],
      ["POST", "/api/v1/trends/change-requests"],
      ["POST", "/api/v1/trends/change-requests/:id/decisions"],
    ])
      assert.equal(f.app.hasRoute({ method, url }), false, `${method} ${url}`);
    assert.equal(f.app.hasRoute({ method: "PUT", url: "/api/v1/trends/:id/follow" }), true);
    const denied = await get("primary");
    assert.equal(denied.statusCode, 404, denied.body);
    assert.equal(f.events.length, 3, "receipt, shape and root only; no child queries on denial");
    const allowed = await get("alice");
    assert.equal(allowed.statusCode, 200, allowed.body);
    assert.equal(allowed.headers["cache-control"], "private, no-store");
    const detail = allowed.json().data;
    assert.deepEqual(
      detail.keywords.map((x) => x.keyword),
      ["owned keyword"],
    );
    assert.deepEqual(
      detail.evidence.map((x) => x.raw_evidence_id),
      ["raw"],
    );
    assert.equal(detail.timeline[0].signal_count, 1);
    assert.deepEqual(detail.evidence_pagination, { page: 1, has_more: false });
    assert.equal(detail.timeline_sources[0].source_id, "source");
    assert.equal(detail.relevance_history[0].reason, "reviewed");
    assert.equal(detail.organization_id, undefined);
    assert.equal(detail.workspace_id, undefined);
  } finally {
    await f.app.close();
  }
});

test("account detail paginates original evidence within the owned topic and rejects invalid pages", async () => {
  const f = fixture({ native: true });
  const get = (page) =>
    f.app.inject({
      url: `/api/v1/trends/${privateTopic}?evidence_page=${page}`,
      headers: { cookie: "scoutops_session=alice" },
    });
  try {
    assert.equal((await get("0")).statusCode, 400);
    assert.equal(f.events.length, 0);
    const result = await get("2");
    assert.equal(result.statusCode, 200, result.body);
    assert.deepEqual(result.json().data.evidence_pagination, { page: 2, has_more: false });
  } finally {
    await f.app.close();
  }
});
