import {
  selectionPrimaryAsinSql,
  currentProductVersionJoinSql,
  competitorDetailEvidenceSql,
} from "@scoutops/database";
import { selectPrimaryObservation } from "@scoutops/provider-sources";
import { normalizedProductFields } from "./automatic-selection-evaluation.js";

/** Both rows remain atomic facts with their original evidence/time. */
export const primaryProductEvidence = <T extends Record<string, unknown>>(
  linked?: T,
  detail?: T,
): T | undefined => {
  const observation = (row: T | undefined) => {
    if (!row) return undefined;
    let payload: unknown;
    try {
      payload =
        typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
    } catch {
      payload = {};
    }
    const fields = normalizedProductFields(payload);
    return {
      value: row,
      observedAt: row.observed_at,
      price: fields.price,
      currency: fields.currency,
    };
  };
  return selectPrimaryObservation(observation(linked), observation(detail));
};

/** Search from actual primary facts, never an editable opportunity label. */
export const automaticPrimaryTitleSql =
  "(SELECT JSON_UNQUOTE(JSON_EXTRACT(n_title.payload_json,'$.title')) " +
  "FROM opportunity_evidence_links l_title " +
  currentProductVersionJoinSql("l_title", "n_title") +
  "JOIN providers p_title ON p_title.id=n_title.provider_id AND p_title.code='amazon_product' " +
  "WHERE l_title.opportunity_id=o.id AND l_title.organization_id=o.organization_id " +
  "AND l_title.workspace_id=o.workspace_id " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_title.payload_json,'$.asin')))=BINARY o.primary_asin " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n_title.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n_title.payload_json,'$.asin')),'([/?#]|$)') " +
  "AND JSON_TYPE(JSON_EXTRACT(n_title.payload_json,'$.title'))='STRING' " +
  "AND LENGTH(TRIM(JSON_UNQUOTE(JSON_EXTRACT(n_title.payload_json,'$.title'))))>0 " +
  "ORDER BY n_title.created_at DESC,n_title.id DESC LIMIT 1)";

/** Correlated to materialized opportunity alias o with its resolved primary_asin. */
export const automaticPrimaryImageSql =
  "COALESCE((SELECT JSON_UNQUOTE(JSON_EXTRACT(n_image.payload_json,'$.image_url')) " +
  "FROM opportunity_evidence_links l_image " +
  currentProductVersionJoinSql("l_image", "n_image") +
  "JOIN providers p_image ON p_image.id=n_image.provider_id AND p_image.code='amazon_product' " +
  "WHERE l_image.opportunity_id=o.id AND l_image.organization_id=o.organization_id " +
  "AND l_image.workspace_id=o.workspace_id " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_image.payload_json,'$.asin')))=BINARY o.primary_asin " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n_image.payload_json,'$.image_url')) REGEXP " +
  "'^https://(m[.]media-amazon[.]com|images-na[.]ssl-images-amazon[.]com)/' " +
  "ORDER BY n_image.created_at DESC,n_image.id DESC LIMIT 1)," +
  // Main-product detail snapshots are projected independently of trend evidence links.
  // Read their original normalized evidence, never a different competitor's image.
  "(SELECT JSON_UNQUOTE(JSON_EXTRACT(n_detail.payload_json,'$.image_url')) " +
  "FROM competitors c_detail JOIN competitor_snapshots s_detail " +
  "ON s_detail.competitor_id=c_detail.id AND s_detail.organization_id=c_detail.organization_id " +
  "AND s_detail.workspace_id=c_detail.workspace_id " +
  "JOIN normalized_records n_detail ON n_detail.raw_evidence_id=s_detail.evidence_id " +
  "AND n_detail.organization_id=s_detail.organization_id AND n_detail.workspace_id=s_detail.workspace_id " +
  "AND n_detail.status='active' " +
  "JOIN providers p_detail ON p_detail.id=n_detail.provider_id AND p_detail.code='amazon_product' " +
  "WHERE c_detail.opportunity_id=o.id AND c_detail.organization_id=o.organization_id " +
  "AND c_detail.workspace_id=o.workspace_id AND c_detail.deleted_at IS NULL " +
  "AND BINARY UPPER(c_detail.external_id)=BINARY o.primary_asin " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_detail.payload_json,'$.asin')))=BINARY o.primary_asin " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n_detail.payload_json,'$.image_url')) REGEXP " +
  "'^https://(m[.]media-amazon[.]com|images-na[.]ssl-images-amazon[.]com)/' " +
  "ORDER BY s_detail.captured_at DESC,s_detail.id DESC,n_detail.created_at DESC,n_detail.id DESC LIMIT 1))";

/** Resolve the same primary used by the catalogue, rather than the latest linked competitor. */
export const automaticPrimaryEvidenceSql =
  "SELECT n.raw_evidence_id,n.created_at observed_at,n.payload_json,p.status provider_status " +
  "FROM opportunities o JOIN opportunity_evidence_links l ON l.opportunity_id=o.id " +
  "AND l.organization_id=o.organization_id AND l.workspace_id=o.workspace_id " +
  currentProductVersionJoinSql("l", "n") +
  "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
  "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? " +
  `AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')))=BINARY ${selectionPrimaryAsinSql} ` +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')),'([/?#]|$)') " +
  "ORDER BY l.observed_at DESC,n.created_at DESC,n.id DESC LIMIT 1";

/** Detail projections do not create trend links; resolve their original primary evidence separately. */
export const automaticPrimaryDetailEvidenceSql =
  "SELECT n.raw_evidence_id,s.captured_at observed_at,n.payload_json,p.status provider_status " +
  "FROM opportunities o JOIN competitors c ON c.opportunity_id=o.id " +
  "AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id " +
  "AND c.status='active' AND c.deleted_at IS NULL AND c.source_site='Amazon' " +
  "JOIN competitor_snapshots s ON s.competitor_id=c.id " +
  "AND s.organization_id=c.organization_id AND s.workspace_id=c.workspace_id " +
  "JOIN normalized_records n ON n.raw_evidence_id=s.evidence_id " +
  "AND n.organization_id=s.organization_id AND n.workspace_id=s.workspace_id AND n.status IN ('active','superseded') " +
  "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
  "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? " +
  `AND BINARY UPPER(c.external_id)=BINARY ${selectionPrimaryAsinSql} ` +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')))=BINARY UPPER(c.external_id) " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')),'([/?#]|$)') " +
  `AND ${competitorDetailEvidenceSql("s")} ` +
  "ORDER BY s.captured_at DESC,s.id DESC,n.created_at DESC,n.id DESC LIMIT 1";

/** Only records produced by this opportunity's sourcing tasks can establish its purchase cost. */
export const automaticSupplyEvidenceSql =
  "SELECT n.raw_evidence_id,n.payload_json,n.created_at FROM sourcing_searches ss " +
  "JOIN collection_task_evidence_links l ON l.collection_task_id=ss.collection_task_id " +
  "AND l.organization_id=ss.organization_id AND l.workspace_id=ss.workspace_id " +
  "JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id " +
  "AND n.organization_id=l.organization_id AND n.workspace_id=l.workspace_id " +
  "JOIN providers p ON p.id=n.provider_id " +
  "WHERE ss.input_type='opportunity' AND ss.input_ref=? AND ss.organization_id=? AND ss.workspace_id=? " +
  "AND ss.deleted_at IS NULL AND n.status='active' AND p.code='1688_search' " +
  "ORDER BY n.created_at DESC,n.id DESC LIMIT 500";
