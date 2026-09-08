window.PROFIT_C_DATA = {
  "version": "PROFIT-C-r1",
  "fixedNow": "2026-08-08T12:00:00.000Z",
  "facts": {
    "analysis": {
      "latest_run": {
        "id": "00000000-0000-4000-8000-000000000445",
        "status": "calculated",
        "rule_version_code": "US-AMZ-2026-01",
        "platform": "amazon",
        "market": "US",
        "currency": "USD",
        "sale_price": 100,
        "total_cost": 30.6,
        "net_profit": 69.4,
        "net_margin_percent": 69.4,
        "missing_fields": [],
        "calculated_at": "2026-08-08T12:00:00.000Z",
        "components": [
          {
            "component_type": "sale_price",
            "source_amount": 100,
            "source_currency": "USD",
            "converted_amount": 100,
            "target_currency": "USD",
            "source_ref_id": "verified:sale_price",
            "evidence_id": "00000000-0000-4000-8000-000000000447",
            "exchange_quote_id": null,
            "missing_reason": null
          },
          {
            "component_type": "purchase_price",
            "source_amount": 40,
            "source_currency": "CNY",
            "converted_amount": 5.6,
            "target_currency": "USD",
            "source_ref_id": "verified:purchase_price",
            "evidence_id": "00000000-0000-4000-8000-000000000447",
            "exchange_quote_id": "00000000-0000-4000-8000-000000000446",
            "missing_reason": null
          },
          {
            "component_type": "logistics",
            "source_amount": 5,
            "source_currency": "USD",
            "converted_amount": 5,
            "target_currency": "USD",
            "source_ref_id": "verified:logistics",
            "evidence_id": "00000000-0000-4000-8000-000000000447",
            "exchange_quote_id": null,
            "missing_reason": null
          },
          {
            "component_type": "platform_fee",
            "source_amount": 10,
            "source_currency": "PCT",
            "converted_amount": 10,
            "target_currency": "USD",
            "source_ref_id": "cost_rule:US-AMZ-2026-01",
            "evidence_id": null,
            "exchange_quote_id": null,
            "missing_reason": null
          },
          {
            "component_type": "payment_fee",
            "source_amount": 3,
            "source_currency": "PCT",
            "converted_amount": 3,
            "target_currency": "USD",
            "source_ref_id": "cost_rule:US-AMZ-2026-01",
            "evidence_id": null,
            "exchange_quote_id": null,
            "missing_reason": null
          },
          {
            "component_type": "tax",
            "source_amount": 5,
            "source_currency": "PCT",
            "converted_amount": 5,
            "target_currency": "USD",
            "source_ref_id": "cost_rule:US-AMZ-2026-01",
            "evidence_id": null,
            "exchange_quote_id": null,
            "missing_reason": null
          },
          {
            "component_type": "fulfillment",
            "source_amount": 2,
            "source_currency": "USD",
            "converted_amount": 2,
            "target_currency": "USD",
            "source_ref_id": "cost_rule:US-AMZ-2026-01",
            "evidence_id": null,
            "exchange_quote_id": null,
            "missing_reason": null
          }
        ]
      },
      "current_inputs": [],
      "cost_input_reviews": [
        {
          "id": "00000000-0000-4000-8000-000000000449",
          "cost_input_id": "00000000-0000-4000-8000-000000000450",
          "input_type": "purchase_price",
          "amount_value": 40,
          "currency": "CNY",
          "platform": "amazon",
          "input_version": 1,
          "evidence_id": "00000000-0000-4000-8000-000000000447",
          "submitter_id": "00000000-0000-4000-8000-000000000451",
          "submitter_label": "成本提交人",
          "reviewer_id": "00000000-0000-4000-8000-000000000448",
          "reviewer_label": "成本复核人",
          "status": "pending",
          "due_at": "2026-08-23T12:00:00.000Z",
          "overdue": false,
          "can_review": true,
          "decision_reason": null,
          "version": 1
        }
      ]
    },
    "detail": {
      "id": "00000000-0000-4000-8000-000000000444",
      "name": "户外净水杯利润机会",
      "market": "US",
      "category": "outdoor",
      "source_type": "manual",
      "source_ref_id": null,
      "owner_id": null,
      "lifecycle_status": "ready",
      "recommendation_status": "observe",
      "overall_score": 72,
      "trend_score": 80,
      "competition_score": 65,
      "profit_status": "calculated",
      "risk_level": "unknown",
      "confidence": {
        "status": "measured",
        "score": 80
      },
      "evidence_count": 3,
      "source_count": 2,
      "coverage_status": "partial",
      "decision_status": "pending",
      "version": 8,
      "updated_at": "2026-08-08T12:00:00.000Z",
      "score_rule_version": "v1",
      "scored_at": "2026-08-08T11:00:00.000Z",
      "latest_score_run": null,
      "score_components": [],
      "evidence": [],
      "decisions": [],
      "section_status": {
        "market": "covered",
        "competition": "covered",
        "profit": "calculated",
        "risk": "insufficient_data",
        "execution": "not_available"
      }
    },
    "reviewerId": "00000000-0000-4000-8000-000000000448",
    "reviewId": "00000000-0000-4000-8000-000000000449"
  },
  "defaults": {
    "platform": "amazon",
    "input_type": "sale_price",
    "amount_value": 0,
    "currency": "USD",
    "source_type": "manual_confirmation",
    "source_ref_id": "",
    "evidence_id": "",
    "observed_at": "2026-08-08T12:00",
    "reviewer_id": ""
  },
  "form": {
    "platform": "Amazon",
    "input_type": "sale_price",
    "amount_value": 40,
    "currency": "cny",
    "source_type": "manual_confirmation",
    "source_ref_id": "  verified:purchase_price  ",
    "evidence_id": "00000000-0000-4000-8000-000000000447",
    "observed_at": "2026-08-08T12:00",
    "reviewer_id": "00000000-0000-4000-8000-000000000451"
  },
  "intents": {
    "sale_price": {
      "method": "POST",
      "path": "/opportunities/00000000-0000-4000-8000-000000000444/cost-inputs",
      "body": {
        "platform": "Amazon",
        "input_type": "sale_price",
        "amount_value": 40,
        "currency": "cny",
        "source_type": "manual_confirmation",
        "source_ref_id": "  verified:purchase_price  ",
        "evidence_id": "00000000-0000-4000-8000-000000000447",
        "observed_at": "2026-08-08T04:00:00.000Z",
        "reviewer_id": "00000000-0000-4000-8000-000000000451",
        "expected_version": 8
      }
    },
    "purchase_price": {
      "method": "POST",
      "path": "/opportunities/00000000-0000-4000-8000-000000000444/cost-inputs",
      "body": {
        "platform": "Amazon",
        "input_type": "purchase_price",
        "amount_value": 40,
        "currency": "cny",
        "source_type": "manual_confirmation",
        "source_ref_id": "  verified:purchase_price  ",
        "evidence_id": "00000000-0000-4000-8000-000000000447",
        "observed_at": "2026-08-08T04:00:00.000Z",
        "reviewer_id": "00000000-0000-4000-8000-000000000451",
        "expected_version": 8
      }
    },
    "logistics": {
      "method": "POST",
      "path": "/opportunities/00000000-0000-4000-8000-000000000444/cost-inputs",
      "body": {
        "platform": "Amazon",
        "input_type": "logistics",
        "amount_value": 40,
        "currency": "cny",
        "source_type": "manual_confirmation",
        "source_ref_id": "  verified:purchase_price  ",
        "evidence_id": "00000000-0000-4000-8000-000000000447",
        "observed_at": "2026-08-08T04:00:00.000Z",
        "reviewer_id": "00000000-0000-4000-8000-000000000451",
        "expected_version": 8
      }
    }
  },
  "reviewIntents": {
    "approved": {
      "method": "POST",
      "path": "/opportunities/00000000-0000-4000-8000-000000000444/cost-input-reviews/00000000-0000-4000-8000-000000000449/actions",
      "body": {
        "decision": "approved",
        "reason": "报价证据与币种一致",
        "expected_version": 1
      }
    },
    "rejected": {
      "method": "POST",
      "path": "/opportunities/00000000-0000-4000-8000-000000000444/cost-input-reviews/00000000-0000-4000-8000-000000000449/actions",
      "body": {
        "decision": "rejected",
        "reason": "报价证据与币种一致",
        "expected_version": 1
      }
    }
  },
  "queueIntent": {
    "method": "POST",
    "path": "/opportunities/00000000-0000-4000-8000-000000000444/profit-runs",
    "body": {
      "platform": "Amazon",
      "expected_version": 8
    }
  },
  "reason": "  报价证据与币种一致  ",
  "componentLabels": {
    "sale_price": "含税售价",
    "purchase_price": "采购成本",
    "logistics": "物流成本",
    "platform_fee": "平台费",
    "payment_fee": "支付手续费",
    "tax": "税费",
    "fulfillment": "履约成本"
  },
  "knownGaps": {
    "historicalReviewerFixtureConflictsWithSelfReviewGuard": true,
    "utcDefault": "2026-08-08T12:00",
    "parsedDefault": "2026-08-08T04:00:00.000Z",
    "offsetHours": -8,
    "reviewSuccessKeepsForm": true,
    "reviewerFailureBecomesEmpty": true,
    "sourceFixed": false
  },
  "boundary": "Historical isolated M04-04 fixture; source functions and inert repository adapter, no actual Vue/API/DB/RBAC/production. Overdue does not disable assigned pending review. Profit figures are source snapshots, never browser-calculated."
};
