<script setup lang="ts">
import { reactive } from "vue";

export interface TrendRuleDraft {
  name: string;
  include_keywords: string[];
  negative_keywords: string[];
  market: string;
  language: string;
  category: string | null;
  notification_channel: "in_app";
  collection_interval_minutes: number;
  recommendation_min_source_count: number;
}

defineProps<{ busy: boolean }>();
const emit = defineEmits<{
  close: [];
  submit: [value: TrendRuleDraft];
}>();
const form = reactive({
  name: "",
  include_keywords: "",
  negative_keywords: "",
  market: "US",
  language: "en-US",
  category: "",
  collection_interval_minutes: 60,
  recommendation_min_source_count: 1,
});
const keywords = (value: string) =>
  value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
function submit() {
  emit("submit", {
    name: form.name,
    include_keywords: keywords(form.include_keywords),
    negative_keywords: keywords(form.negative_keywords),
    market: form.market,
    language: form.language,
    category: form.category || null,
    notification_channel: "in_app",
    collection_interval_minutes: form.collection_interval_minutes,
    recommendation_min_source_count: form.recommendation_min_source_count,
  });
}
</script>

<template>
  <div class="trend-modal" role="dialog" aria-modal="true" aria-labelledby="trend-rule-title">
    <form @submit.prevent="submit">
      <header>
        <div>
          <p>监控规则</p>
          <h3 id="trend-rule-title">创建趋势监控</h3>
        </div>
        <button type="button" aria-label="关闭" @click="emit('close')">×</button>
      </header>
      <label>规则名称<input v-model="form.name" required maxlength="120" /></label>
      <label
        >包含关键词（逗号分隔）<input v-model="form.include_keywords" required maxlength="500"
      /></label>
      <label>排除关键词（可选）<input v-model="form.negative_keywords" maxlength="500" /></label>
      <div>
        <label>市场<input v-model="form.market" required maxlength="40" /></label>
        <label>语言<input v-model="form.language" required maxlength="40" /></label>
      </div>
      <label>分类（可选）<input v-model="form.category" maxlength="80" /></label>
      <label
        >自动采集周期<select v-model.number="form.collection_interval_minutes">
          <option :value="15">每 15 分钟</option>
          <option :value="30">每 30 分钟</option>
          <option :value="60">每 1 小时</option>
          <option :value="180">每 3 小时</option>
          <option :value="360">每 6 小时</option>
          <option :value="720">每 12 小时</option>
          <option :value="1440">每天</option>
        </select></label
      >
      <label
        >自动推荐门槛<select v-model.number="form.recommendation_min_source_count">
          <option :value="1">命中 1 个真实来源后推荐</option>
          <option :value="2">至少 2 个独立来源后推荐</option>
          <option :value="3">至少 3 个独立来源后推荐</option>
        </select></label
      >
      <aside>
        <strong>推荐不等于采纳</strong
        ><span>系统按规则与真实来源推荐；最终由你采纳、观察或驳回。</span>
      </aside>
      <aside><strong>通知渠道</strong><span>站内通知。邮件服务尚未确认，不能选择。</span></aside>
      <footer>
        <button type="button" @click="emit('close')">取消</button>
        <button type="submit" :disabled="busy">{{ busy ? "保存中…" : "创建并启用" }}</button>
      </footer>
    </form>
  </div>
</template>
