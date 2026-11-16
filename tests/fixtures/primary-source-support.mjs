import {
  primarySourceOriginSql,
  primarySourceNewsSql,
  primarySourceAuditSql,
  accountPrimarySourceOriginSql,
  accountPrimarySourceNewsSql,
  accountPrimarySourceAuditSql,
  PRIMARY_SOURCE_SUPPORT_REVISION,
} from "../../apps/worker/dist/primary-source-support.js";
import {
  automaticPrimaryEvidenceSql,
  accountAutomaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";

/** Explicit test-only provenance; never used by production or counted as real evidence. */
export function primarySourceFixtureRead(sql, params, options = {}) {
  if (sql === primarySourceOriginSql || sql === accountPrimarySourceOriginSql)
    return [
      [
        {
          source_type: "trend_topic",
          id: "source-event",
          payload_json: { query: "test product", intelligence_source_record_id: "news" },
        },
      ],
    ];
  if (sql === primarySourceNewsSql || sql === accountPrimarySourceNewsSql)
    return [[{ id: "news", payload_json: { title: "test product news" } }]];
  if (sql === automaticPrimaryDetailEvidenceSql || sql.startsWith("SELECT n.raw_evidence_id,s.captured_at observed_at") && sql.includes("JOIN account_owned_records owner")) return [[]];
  if (sql === automaticPrimaryEvidenceSql || sql === accountAutomaticPrimaryEvidenceSql)
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
  if (sql === primarySourceAuditSql || sql === accountPrimarySourceAuditSql)
    return [
      [
        {
          payload_json: {
            revision: PRIMARY_SOURCE_SUPPORT_REVISION,
            fingerprint: params.at(-1),
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
