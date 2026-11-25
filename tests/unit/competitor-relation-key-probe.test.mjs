import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { selectionCompetitorRelevanceSql as sql } from "../../packages/database/dist/selection-completion-policy.js";

const anchor =
  "AND q_relation.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.subquery_id')) USING ascii) ";
const residual =
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.subquery_id'))=BINARY q_relation.id ";

test("competitor relation probes the ASCII key without replacing any original proof", () => {
  assert.equal(sql.split(anchor).length - 1, 1);
  assert.ok(sql.includes(anchor + residual));
  assert.equal(
    createHash("sha256").update(sql.replace(anchor, "")).digest("hex"),
    "3aa9f0067a396082bfe852894bf150f616bc26c25b3884242decfb9ced3d7e20",
  );
});
