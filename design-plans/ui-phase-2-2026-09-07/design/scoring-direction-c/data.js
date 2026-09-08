// Reviewed subsets of the existing scoring E2E fixtures, not production data.
window.SCOUTOPS_SCORING_DESIGN = (() => {
  const dimensions = [
    {
      code: "market_demand",
      label: "市场需求",
      weight: 40,
      required: true,
      evidence_group: "market",
    },
    {
      code: "competition",
      label: "竞争",
      weight: 30,
      required: true,
      evidence_group: "competition",
    },
    { code: "profit", label: "利润", weight: 30, required: true, evidence_group: "cost" },
  ];
  const ruleId = "00000000-0000-4000-8000-000000000435";
  const draftId = "00000000-0000-4000-8000-000000000436";
  const rules = [
    {
      id: ruleId,
      version_code: "org-v1",
      name: "当前生产评分规则",
      status: "active",
      dimensions,
      thresholds: { recommend_min: 75, observe_min: 55 },
      revision: 4,
      submitted_at: "2026-08-07T10:00:00.000Z",
      approved_at: "2026-08-07T10:10:00.000Z",
      activated_at: "2026-08-07T10:20:00.000Z",
      updated_at: "2026-08-07T10:20:00.000Z",
    },
    {
      id: draftId,
      version_code: "org-v2",
      name: "候选评分规则",
      status: "draft",
      dimensions,
      thresholds: { recommend_min: 78, observe_min: 58 },
      revision: 1,
      submitted_at: null,
      approved_at: null,
      activated_at: null,
      updated_at: "2026-08-07T11:00:00.000Z",
    },
  ];
  // UI2-S01 uses these two records separately from the M04-03 baseline above.
  const lifecycleRule = (status, target = false) => ({
    id: target ? draftId : ruleId,
    version_code: target ? "org-v2" : "org-v1",
    name: target ? "恢复目标" : "核验规则",
    status,
    dimensions,
    thresholds: { recommend_min: 75, observe_min: 55 },
    revision: 4,
    submitted_at: null,
    approved_at: null,
    activated_at: null,
    updated_at: "2026-08-07T10:20:00.000Z",
  });
  return {
    rules,
    lifecycleRule,
    preview: {
      rule_id: draftId,
      rule_version_code: "org-v2",
      rule_status: "draft",
      page: 1,
      page_size: 20,
      total: 1,
      items: [
        {
          opportunity_id: "00000000-0000-4000-8000-000000000434",
          opportunity_name: "便携式智能净水杯机会",
          lifecycle_status: "ready",
          current_score: 80.2,
          current_recommendation_status: "recommend",
          current_rule_version: "org-v1",
          projected_score: 78.4,
          projected_recommendation_status: "recommend",
          projected_coverage_percent: 100,
          score_delta: -1.8,
          recommendation_changed: false,
          missing_fields: [],
        },
      ],
      page_summary: {
        increased: 0,
        decreased: 1,
        unchanged: 0,
        newly_calculable: 0,
        insufficient_data: 0,
        recommendation_changed: 0,
      },
      read_only: true,
    },
  };
})();
