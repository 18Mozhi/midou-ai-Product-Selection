<script setup lang="ts">
import { reactive, watch } from "vue";
import type { OpportunityProfitAnalysis as ProfitAnalysis } from "./opportunity-workspace-types";

const props = defineProps<{
  reviews: ProfitAnalysis["cost_input_reviews"];
  busy: boolean;
}>();
const emit = defineEmits<{
  reviewCost: [
    payload: {
      reviewId: string;
      decision: "approved" | "rejected";
      reason: string;
      expectedVersion: number;
    },
  ];
}>();
const review = reactive({
  id: "",
  version: null as number | null,
  decision: "approved" as "approved" | "rejected",
  reason: "",
});
function cancelReview() {
  review.id = "";
  review.version = null;
  review.reason = "";
}
watch(
  () => props.reviews,
  (reviews) => {
    if (!review.id) return;
    const current = reviews.find((item) => item.id === review.id);
    if (!current?.can_review || current.version !== review.version) cancelReview();
  },
  { flush: "sync" },
);
const inputLabel = (value: string) =>
  ({ sale_price: "含税售价", purchase_price: "采购价", logistics: "物流" })[value] ?? value;
function beginReview(
  item: ProfitAnalysis["cost_input_reviews"][number],
  decision: "approved" | "rejected",
) {
  review.id = item.id;
  review.version = item.version;
  review.decision = decision;
  review.reason = "";
}
function submitReview(item: ProfitAnalysis["cost_input_reviews"][number]) {
  const expectedVersion = review.version;
  if (
    !item.can_review ||
    review.id !== item.id ||
    expectedVersion === null ||
    expectedVersion !== item.version ||
    review.reason.trim().length < 2
  )
    return;
  emit("reviewCost", {
    reviewId: item.id,
    decision: review.decision,
    reason: review.reason.trim(),
    expectedVersion,
  });
}
</script>

<template>
  <section class="profit-review-queue">
    <header>
      <div>
        <p>双人复核</p>
        <h5>成本复核队列</h5>
      </div>
      <span>提交后 24 小时内由指定复核人处理；未复核成本不会进入利润计算。</span>
    </header>
    <article
      v-for="item in reviews"
      :key="item.id"
      :data-status="item.overdue ? 'overdue' : item.status"
    >
      <header>
        <div>
          <strong
            >{{ inputLabel(item.input_type) }} · {{ item.amount_value }} {{ item.currency }}</strong
          >
          <small>{{ item.platform }} · v{{ item.input_version }}</small>
        </div>
        <b>{{
          item.overdue
            ? "已超时"
            : item.status === "pending"
              ? "待复核"
              : item.status === "approved"
                ? "已通过"
                : "已驳回"
        }}</b>
      </header>
      <p>提交人 {{ item.submitter_label }} · 复核人 {{ item.reviewer_label }}</p>
      <small
        >期限 {{ new Date(item.due_at).toLocaleString("zh-CN") }} · 证据
        {{ item.evidence_id }}</small
      >
      <p v-if="item.decision_reason">处理说明：{{ item.decision_reason }}</p>
      <footer v-if="item.can_review">
        <button type="button" @click="beginReview(item, 'rejected')">驳回</button>
        <button type="button" @click="beginReview(item, 'approved')">通过</button>
      </footer>
      <form
        v-if="review.id === item.id && item.can_review && review.version === item.version"
        @submit.prevent="submitReview(item)"
      >
        <label>
          {{ review.decision === "approved" ? "复核说明" : "驳回原因" }}
          <textarea v-model="review.reason" required minlength="2" maxlength="1000"></textarea>
        </label>
        <div>
          <button type="button" @click="cancelReview">取消</button>
          <button type="submit" :disabled="busy || review.reason.trim().length < 2">提交</button>
        </div>
      </form>
    </article>
    <p v-if="!reviews.length">暂无成本复核记录。</p>
  </section>
</template>
