// A topic can be the product's direct origin or the original intelligence
// retained as a scoped trend-signal evidence link. Titles never establish identity.
export const opportunitySourceTopicFilterSql = [
  "EXISTS (SELECT 1 FROM trend_topics tt WHERE tt.id=? ",
  "AND tt.organization_id=o.organization_id AND tt.workspace_id=o.workspace_id AND (",
  "(o.source_type='trend_topic' AND o.source_ref_id=tt.id) OR EXISTS (",
  "SELECT 1 FROM opportunity_evidence_links l JOIN trend_signals ts ON ts.id=l.evidence_id ",
  "AND ts.organization_id=l.organization_id AND ts.workspace_id=l.workspace_id ",
  "WHERE l.opportunity_id=o.id AND l.organization_id=o.organization_id ",
  "AND l.workspace_id=o.workspace_id AND l.evidence_type='trend_signal' AND ts.topic_id=tt.id)))",
].join("");
