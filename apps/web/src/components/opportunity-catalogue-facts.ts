import type { OpportunitySummary as Opportunity } from "./opportunity-workspace-types";

export const catalogueFreshness = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
export const catalogueSourceLabel = (item: Opportunity) =>
  item.source_type === "trend_topic"
    ? "情报发现"
    : item.source_type === "manual"
      ? "手工添加"
      : "其他线索";
export const catalogueMeta = (item: Opportunity) =>
  `${item.market} · ${item.category || "未分类"} · ${catalogueFreshness(item.updated_at)}${item.matched_rule_count ? ` · 命中 ${item.matched_rule_count} 条规则` : ""}`;

export const catalogueProductFacts = (item: Opportunity) => {
  const p = item.primary_product;
  const sales = p?.public_signals?.sales_badge;
  return [
    {
      label: "售价",
      value: p?.price != null && p.currency ? `${p.currency} ${p.price.toFixed(2)}` : "未采集",
    },
    {
      label: "1688进货价",
      value: item.automatic_purchase_price
        ? `CNY ${item.automatic_purchase_price.amount_value.toFixed(2)}`
        : "未取得",
    },
    {
      label: "评分 / 评价",
      value: `${p?.rating_value != null ? p.rating_value.toFixed(1) : "—"} / ${p?.review_count != null ? `${p.review_count} 条` : "未采集"}`,
    },
    {
      label: "购买提示",
      value: sales
        ? `${sales.period === "past_month" ? "近月" : "近周"} ≥ ${sales.quantity_lower_bound}`
        : "未采集",
    },
    {
      label: "类目排名",
      value: p?.public_signals?.best_seller_rank
        ? `#${p.public_signals.best_seller_rank.rank}`
        : "未采集",
    },
    {
      label: "采价时间",
      value: item.automatic_purchase_price
        ? catalogueFreshness(item.automatic_purchase_price.observed_at)
        : "未取得",
    },
  ];
};
