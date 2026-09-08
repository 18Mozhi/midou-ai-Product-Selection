window.OP_DETAIL_C_DATA = {
  "version": "OPPORTUNITY-DETAIL-C-core-r1",
  "sample": {
    "id": "00000000-0000-4000-8000-000000000424",
    "name": "隔离机会候选",
    "image_url": null,
    "market": "US",
    "category": null,
    "source_type": "manual",
    "source_ref_id": null,
    "owner_id": "00000000-0000-4000-8000-000000000423",
    "lifecycle_status": "ready",
    "lifecycle_entered_at": "2026-08-08T00:00:00.000Z",
    "lifecycle_dwell_seconds": 60,
    "recommendation_status": "insufficient_data",
    "overall_score": null,
    "trend_score": null,
    "competition_score": null,
    "profit_status": "insufficient_data",
    "risk_level": "unknown",
    "confidence": {
      "status": "insufficient_data",
      "score": null
    },
    "evidence_count": 0,
    "source_count": 0,
    "competitor_count": 0,
    "supplier_candidate_count": 0,
    "matched_rule_count": 0,
    "selection_stage": "not_eligible",
    "quality_gates": {
      "score": false,
      "market": false,
      "competition": false,
      "cost": false,
      "risk": false,
      "all_passed": false
    },
    "coverage_status": "incomplete",
    "blocking_reasons": [
      "evidence_insufficient",
      "recommendation_insufficient"
    ],
    "decision_status": "pending",
    "version": 3,
    "updated_at": "2026-08-08T00:00:00.000Z",
    "operating_feedback": {
      "facts": [],
      "calibration": null
    },
    "lineage": {
      "freshness": {
        "observed_at": null,
        "age_seconds": null
      },
      "failure_impact": {
        "level": "none",
        "codes": [],
        "affected_stages": []
      },
      "request_ids": [],
      "trace_ids": [],
      "nodes": []
    },
    "adoption_blockers": [],
    "redecision_ready": false,
    "score_rule_version": null,
    "scored_at": null,
    "latest_score_run": null,
    "score_components": [],
    "evidence": [],
    "decisions": [],
    "section_status": {
      "market": "insufficient_data",
      "competition": "insufficient_data",
      "profit": "insufficient_data",
      "risk": "insufficient_data",
      "execution": "not_available"
    }
  },
  "historical": {
    "recommendedBase": {
      "id": "00000000-0000-4000-8000-000000000424",
      "name": "AI 驱动的个性化护肤机会",
      "market": "US",
      "category": "beauty",
      "source_type": "trend_topic",
      "source_ref_id": "00000000-0000-4000-8000-000000000425",
      "owner_id": "00000000-0000-4000-8000-000000000423",
      "lifecycle_status": "ready",
      "lifecycle_entered_at": "2026-08-07T20:00:00.000Z",
      "lifecycle_dwell_seconds": 14400,
      "recommendation_status": "recommend",
      "overall_score": 86,
      "trend_score": 88,
      "competition_score": 82,
      "profit_status": "calculated",
      "risk_level": "low",
      "confidence": {
        "status": "insufficient_data",
        "score": null
      },
      "evidence_count": 8,
      "source_count": 3,
      "coverage_status": "complete",
      "blocking_reasons": [],
      "decision_status": "pending",
      "version": 1,
      "updated_at": "2026-08-08T00:00:00.000Z",
      "competitor_count": 5,
      "supplier_candidate_count": 4,
      "matched_rule_count": 1,
      "selection_stage": "recommended",
      "quality_gates": {
        "score": true,
        "market": true,
        "competition": true,
        "cost": true,
        "risk": true,
        "all_passed": true
      }
    },
    "evidence": [
      {
        "id": "00000000-0000-4000-8000-000000000426",
        "title": "AI Skin Care Demand Rises",
        "publisher": "Example News",
        "canonical_url": "https://example.test/ai-skincare",
        "provider_id": "00000000-0000-4000-8000-000000000427",
        "raw_evidence_id": "00000000-0000-4000-8000-000000000428",
        "observed_at": "2026-08-07T14:05:00.000Z"
      },
      {
        "id": "00000000-0000-4000-8000-000000000429",
        "title": "Personalized beauty products gain attention",
        "publisher": "Retail Example",
        "canonical_url": "https://example.test/personalized",
        "provider_id": "00000000-0000-4000-8000-000000000430",
        "raw_evidence_id": "00000000-0000-4000-8000-000000000431",
        "observed_at": "2026-08-07T13:05:00.000Z"
      }
    ]
  },
  "labels": {
    "opportunityLabels": {
      "pending": "待判断",
      "adopt": "采纳",
      "adopted": "已采纳",
      "observe": "继续观察",
      "observing": "观察中",
      "reject": "驳回",
      "rejected": "已驳回",
      "insufficient": "不完整",
      "partial": "部分完整",
      "complete": "完整",
      "insufficient_data": "待补充数据",
      "calculated": "已计算",
      "covered": "已覆盖",
      "measured": "已测量",
      "recommend": "建议采纳",
      "recommended": "建议采纳",
      "rule_candidate": "规则命中候选",
      "not_eligible": "采集中",
      "not_recommend": "不建议采纳",
      "succeeded": "已完成",
      "failed_terminal": "终止失败",
      "pending_review": "待复核",
      "approved": "已通过",
      "unknown": "待识别",
      "low": "低",
      "medium": "中",
      "high": "高",
      "manual": "手动创建",
      "trend_topic": "热点自动发现",
      "evidence_insufficient": "缺少可采纳证据",
      "recommendation_insufficient": "尚无可靠推荐结论"
    },
    "opportunityPrimaryTabs": [
      [
        "overview",
        "结论"
      ],
      [
        "evidence",
        "证据"
      ],
      [
        "profit",
        "利润与成本"
      ],
      [
        "risk",
        "风险"
      ]
    ],
    "opportunitySecondaryTabs": [
      [
        "market",
        "市场"
      ],
      [
        "competition",
        "竞争"
      ],
      [
        "ai",
        "AI 辅助"
      ],
      [
        "lineage",
        "业务血缘"
      ],
      [
        "feedback",
        "经营复盘"
      ],
      [
        "decisions",
        "决策历史"
      ]
    ]
  },
  "gateLabels": {
    "score": "评分",
    "market": "市场",
    "competition": "竞争",
    "cost": "成本",
    "risk": "风险"
  },
  "decisionIntents": {
    "adopt": {
      "method": "POST",
      "path": "/opportunities/00000000-0000-4000-8000-000000000424/decisions",
      "body": {
        "action": "adopt",
        "reason": "  核对来源后继续验证  ",
        "expected_version": 3
      }
    },
    "observe": {
      "method": "POST",
      "path": "/opportunities/00000000-0000-4000-8000-000000000424/decisions",
      "body": {
        "action": "observe",
        "reason": "  核对来源后继续验证  ",
        "expected_version": 3
      }
    },
    "reject": {
      "method": "POST",
      "path": "/opportunities/00000000-0000-4000-8000-000000000424/decisions",
      "body": {
        "action": "reject",
        "reason": "  核对来源后继续验证  ",
        "expected_version": 3
      }
    }
  },
  "taskIntent": {
    "method": "POST",
    "path": "/opportunities/00000000-0000-4000-8000-000000000424/evidence-completion-tasks",
    "body": {
      "expected_version": 3
    }
  },
  "taskNavigation": {
    "path": "/tasks/00000000-0000-4000-8000-000000000625",
    "query": {
      "from": "/opportunities/00000000-0000-4000-8000-000000000424?tab=evidence&from=%2Fopportunities"
    }
  },
  "taskId": "00000000-0000-4000-8000-000000000625",
  "knownGaps": {
    "duplicateTitleId": true,
    "genericFailureCopy": "依赖暂不可用，未写入任何状态。",
    "sourceFixed": false
  },
  "boundary": "Historical isolated fixtures and explicitly synthetic layout states. Source functions executed in VM; no actual Vue/HTTP/database/RBAC/production acceptance. Core overview/evidence/decisions only, seven remaining sections and AI dialogs are pending."
};
