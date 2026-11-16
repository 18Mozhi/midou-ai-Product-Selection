import { rehearsalOwns } from "./account-read-rehearsal.js";

// A topic can be the product's direct origin or the original intelligence
// retained as a scoped trend-signal evidence link. Titles never establish identity.
export const opportunitySourceTopicFilterSql = [
  "EXISTS (SELECT 1 FROM trend_topics tt WHERE tt.id=? ",
  "AND tt.organization_id=o.organization_id AND tt.workspace_id=o.workspace_id AND (",
  "(o.source_type='trend_topic' AND o.source_ref_id=tt.id) OR EXISTS (",
  "SELECT 1 FROM opportunity_evidence_links l JOIN trend_signals ts ON ts.id=l.evidence_id ",
  "WHERE l.opportunity_id=o.id AND l.evidence_type='trend_signal' AND ts.topic_id=tt.id)))",
].join("");

const own = (source: string, id: string) => rehearsalOwns(source, id, "oo.account_id");
export const accountOpportunitySourceTopicFilterSql =
  "EXISTS (SELECT 1 FROM trend_topics tt WHERE tt.id=? " +
  `AND ${own("trend_topics", "tt.id")} AND (` +
  "(o.source_type='trend_topic' AND o.source_ref_id=tt.id) OR EXISTS (" +
  "SELECT 1 FROM opportunity_evidence_links l JOIN trend_signals ts ON ts.id=l.evidence_id " +
  "JOIN raw_evidence r ON r.id=l.raw_evidence_id AND r.id=ts.raw_evidence_id AND r.provider_id=l.provider_id " +
  "WHERE l.opportunity_id=o.id AND l.evidence_type='trend_signal' AND ts.topic_id=tt.id AND ts.provider_id=l.provider_id " +
  `AND ${own("opportunity_evidence_links", "l.id")} AND ${own("trend_signals", "ts.id")} AND ${own("raw_evidence", "r.id")})))`;
