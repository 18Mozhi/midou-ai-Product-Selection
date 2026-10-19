import {
  competitorRefreshObservedAtSql,
  competitorRefreshOrderSql,
} from "../../apps/worker/dist/competitor-refresh-policy.js";
const cutoff = new Date("2026-10-19T23:00:00Z"),
  old = new Date("2026-10-19T22:00:00Z"),
  fresh = new Date("2026-10-19T23:30:00Z"),
  future = new Date("2026-10-20T01:00:00Z");
const base = {
  id: "c",
  latest: null,
  created: old,
  snapshotId: "s",
  snapshotCompetitor: "c",
  snapshotOrg: "org",
  snapshotWorkspace: "ws",
  observed: old,
};
function build(name, items, expected) {
  const cs = items
    .map(() => "SELECT ? id,? latest_snapshot_id,? created_at,? organization_id,? workspace_id")
    .join(" UNION ALL ");
  const ss = items
    .map(() => "SELECT ? id,? competitor_id,? organization_id,? workspace_id,? captured_at")
    .join(" UNION ALL ");
  const params = [
    ...items.flatMap((r) => [r.id, r.latest, r.created, "org", "ws"]),
    ...items.flatMap((r) => [
      r.snapshotId,
      r.snapshotCompetitor,
      r.snapshotOrg,
      r.snapshotWorkspace,
      r.observed,
    ]),
    cutoff,
  ];
  return {
    name,
    sql:
      "SELECT c.id FROM (" +
      cs +
      ") c LEFT JOIN (" +
      ss +
      ") s ON s.id=c.latest_snapshot_id AND s.competitor_id=c.id AND s.organization_id=c.organization_id AND s.workspace_id=c.workspace_id WHERE " +
      competitorRefreshObservedAtSql +
      "<=? " +
      competitorRefreshOrderSql.replace(" FOR UPDATE", ""),
    params,
    expected,
  };
}
export function competitorFirstObservationCases() {
  const cases = [
    ["missing first observation is due", {}, ["c"]],
    ["new competitor waits original hour", { created: fresh }, []],
    ["missing observation exact cutoff", { created: cutoff }, ["c"]],
    ["missing future competitor", { created: future }, []],
    ["null creation cannot fabricate age", { created: null }, []],
    ["valid old snapshot keeps cadence", { latest: "s" }, ["c"]],
    ["fresh snapshot ignores older creation", { latest: "s", observed: fresh }, []],
    ["snapshot exact cutoff", { latest: "s", observed: cutoff }, ["c"]],
    ["snapshot future is not due", { latest: "s", observed: future }, []],
    ["dangling snapshot pointer fails closed", { latest: "missing" }, []],
    ["foreign competitor pointer fails closed", { latest: "s", snapshotCompetitor: "other" }, []],
    ["foreign organization pointer fails closed", { latest: "s", snapshotOrg: "other" }, []],
    ["foreign workspace pointer fails closed", { latest: "s", snapshotWorkspace: "other" }, []],
    ["null observed timestamp does not borrow creation", { latest: "s", observed: null }, []],
  ];
  const rows = cases.map(([name, patch, expected]) =>
    build(name, [{ ...base, ...patch }], expected),
  );
  rows.push(
    build(
      "missing observation precedes old observed monitor",
      [
        { ...base, id: "new-primary", snapshotCompetitor: "new-primary" },
        {
          ...base,
          id: "old-monitor",
          latest: "s2",
          snapshotId: "s2",
          snapshotCompetitor: "old-monitor",
          created: new Date("2026-01-01T00:00:00Z"),
          observed: new Date("2026-01-01T00:00:00Z"),
        },
      ],
      ["new-primary"],
    ),
  );
  rows.push(
    build(
      "oldest missing observation first",
      [
        { ...base, id: "b", created: cutoff, snapshotId: "s2", snapshotCompetitor: "b" },
        { ...base, id: "a", snapshotCompetitor: "a" },
      ],
      ["a"],
    ),
  );
  rows.push(
    build(
      "missing observation tie retains id ordering",
      [
        { ...base, id: "b", snapshotCompetitor: "b" },
        { ...base, id: "a", snapshotId: "s2", snapshotCompetitor: "a" },
      ],
      ["a"],
    ),
  );
  rows.push(
    build(
      "observed monitors retain observation ordering",
      [
        {
          ...base,
          id: "b",
          latest: "s1",
          snapshotId: "s1",
          snapshotCompetitor: "b",
          observed: cutoff,
        },
        { ...base, id: "a", latest: "s2", snapshotId: "s2", snapshotCompetitor: "a" },
      ],
      ["a"],
    ),
  );
  return rows;
}
