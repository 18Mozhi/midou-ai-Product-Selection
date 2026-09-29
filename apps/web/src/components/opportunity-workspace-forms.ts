import { reactive } from "vue";

const localDateTimeInputValue = (date = new Date()) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const localDateInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function createOpportunityWorkspaceForms() {
  return {
    filters: reactive({
      q: "",
      market: "",
      decision_status: "",
      coverage_status: "",
      blocking_reason: "",
      lifecycle_status: "",
      owner_id: "",
    }),
    form: reactive({ name: "", market: "US", category: "", source_topic_id: "" }),
    costForm: reactive({
      platform: "amazon",
      input_type: "sale_price" as "sale_price" | "purchase_price" | "logistics",
      amount_value: 0,
      currency: "USD",
      source_type: "manual_confirmation",
      source_ref_id: "",
      evidence_id: "",
      observed_at: localDateTimeInputValue(),
      reviewer_id: "",
    }),
    feedbackForm: reactive({
      period_start: localDateInputValue(),
      period_end: localDateInputValue(),
      sales_units: 0,
      revenue_amount: 0,
      ad_spend_amount: 0,
      returned_units: 0,
      purchase_lead_time_days: 0,
      actual_profit_amount: 0,
      currency: "USD",
      source_ref: "",
      notes: "",
      observed_at: new Date().toISOString(),
    }),
  };
}
