import {
  primarySourceOriginSql,
  primarySourceNewsSql,
  primarySourceAuditSql,
  PRIMARY_SOURCE_SUPPORT_REVISION,
} from "../../apps/worker/dist/primary-source-support.js";
import {
  automaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";

/** Explicit test-only provenance; never used by production or counted as real evidence. */
export function primarySourceFixtureRead(sql, params, options = {}) {
  if (sql === primarySourceOriginSql)
    return [
      [
        {
          source_type: "trend_topic",
          id: "source-event",
          payload_json: { query: "test product", intelligence_source_record_id: "news" },
        },
      ],
    ];
  if (sql === primarySourceNewsSql)
    return [[{ id: "news", payload_json: { title: "test product news" } }]];
  if (sql === automaticPrimaryDetailEvidenceSql) return [[]];
  if (sql === automaticPrimaryEvidenceSql)
    return [
      [
        {
          payload_json: {
            asin: options.asin ?? "B0COUNT000",
            title: "Test product",
            price: 10,
            currency: "USD",
          },
        },
      ],
    ];
  if (sql === primarySourceAuditSql)
    return [
      [
        {
          payload_json: {
            revision: PRIMARY_SOURCE_SUPPORT_REVISION,
            fingerprint: params[4],
            primary_asin: options.asin ?? "B0COUNT000",
            origin_event_id: "source-event",
            intelligence_record_id: "news",
            supported: options.supported ?? true,
            rationale: "test-only proof",
          },
        },
      ],
    ];
  return undefined;
}
