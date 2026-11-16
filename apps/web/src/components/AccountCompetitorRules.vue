<script setup lang="ts">
import { onDeactivated, onUnmounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";

const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
type Rule = {
  id: string;
  competitor_id: string | null;
  metric: string;
  direction: string;
  threshold_value: number | null;
  status: string;
};
type Competitor = { id: string; title: string };
const metrics = { price: "价格", rank: "排名", review_count: "评价数", availability: "库存" };
const directions = {
  change: "变化",
  increase: "上升",
  decrease: "下降",
  became_unavailable: "变为不可售",
};
const rules = ref<Rule[]>([]),
  competitors = ref<Competitor[]>([]);
const loaded = ref(false),
  loading = ref(false),
  saving = ref(false);
const readError = ref(""),
  writeError = ref(""),
  notice = ref("");
const metric = ref<keyof typeof metrics>("price"),
  direction = ref<keyof typeof directions>("change");
const threshold = ref<number | string>(""),
  competitorId = ref("");
const pending = ref<{ key: string; body: Omit<Rule, "id" | "status"> } | null>(null);
let readController: AbortController | undefined;

function stopRead() {
  readController?.abort();
  readController = undefined;
  loading.value = false;
}
onDeactivated(stopRead);
onUnmounted(stopRead);

async function load() {
  stopRead();
  const controller = new AbortController();
  readController = controller;
  loading.value = true;
  readError.value = "";
  try {
    const options = { signal: controller.signal };
    const [directory, targets] = await Promise.all([
      request<Rule[]>("/competitor-monitor-rules", options),
      request<Competitor[]>("/competitors", options),
    ]);
    if (readController !== controller) return;
    rules.value = directory.data;
    competitors.value = targets.data;
    loaded.value = true;
  } catch {
    if (readController === controller) readError.value = "读取竞品监控规则失败，请重试。";
  } finally {
    if (readController === controller) stopRead();
  }
}

async function save() {
  if (saving.value || !loaded.value) return;
  if (!pending.value) {
    const value = metric.value === "availability" ? null : Number(threshold.value);
    if (
      value !== null &&
      (threshold.value === "" || !Number.isFinite(value) || value < 0 || value > 999999999999)
    ) {
      writeError.value = "请输入有效阈值。";
      return;
    }
    pending.value = {
      key: crypto.randomUUID(),
      body: {
        competitor_id: competitorId.value || null,
        metric: metric.value,
        direction: direction.value,
        threshold_value: value,
      },
    };
  }
  const attempt = pending.value;
  saving.value = true;
  writeError.value = "";
  notice.value = "";
  try {
    await request<Rule>("/competitor-monitor-rules", {
      method: "POST",
      body: attempt.body,
      idempotencyKey: attempt.key,
    });
    pending.value = null;
    threshold.value = "";
    notice.value = "规则已创建。";
    await load();
  } catch (error) {
    if (error instanceof ApiClientError && [400, 401, 403, 404, 409, 422].includes(error.status)) {
      pending.value = null;
      writeError.value = error.userMessage;
    } else {
      writeError.value = "创建结果未确认。请重试同一请求，不要重复创建。";
    }
  } finally {
    saving.value = false;
  }
}

function label(map: Record<string, string>, key: string) {
  return map[key] ?? key;
}
</script>

<template>
  <details
    class="account-competitor-rules"
    @toggle="($event.target as HTMLDetailsElement).open && !loaded && !loading && load()"
  >
    <summary>竞品监控规则</summary>
    <p v-if="loading" role="status">正在读取规则…</p>
    <p v-if="readError" role="alert">
      {{ readError }} <button type="button" @click="load">重试读取</button>
    </p>
    <template v-if="loaded">
      <p v-if="!rules.length && !readError">当前账号暂无监控规则。</p>
      <ul v-else aria-label="现有竞品监控规则">
        <li v-for="rule in rules" :key="rule.id">
          {{ label(metrics, rule.metric) }} · {{ label(directions, rule.direction) }}
          <template v-if="rule.threshold_value !== null">
            · 阈值 {{ rule.threshold_value }}</template
          >
          · {{ rule.status === "enabled" ? "启用" : "停用" }} ·
          {{
            rule.competitor_id
              ? (competitors.find((item) => item.id === rule.competitor_id)?.title ??
                rule.competitor_id)
              : "本账号全部竞品"
          }}
        </li>
      </ul>
      <form @submit.prevent="save">
        <fieldset :disabled="saving || !!pending">
          <legend>新建规则</legend>
          <label
            >监控对象
            <select v-model="competitorId">
              <option value="">本账号全部竞品</option>
              <option v-for="item in competitors" :key="item.id" :value="item.id">
                {{ item.title }}
              </option>
            </select>
          </label>
          <label
            >指标
            <select v-model="metric" @change="direction = 'change'">
              <option v-for="(name, key) in metrics" :key="key" :value="key">{{ name }}</option>
            </select>
          </label>
          <label
            >方向
            <select v-model="direction">
              <option value="change">变化</option>
              <option v-if="metric === 'availability'" value="became_unavailable">
                变为不可售
              </option>
              <template v-else
                ><option value="increase">上升</option>
                <option value="decrease">下降</option></template
              >
            </select>
          </label>
          <label v-if="metric !== 'availability'"
            >阈值
            <input
              v-model="threshold"
              type="number"
              min="0"
              max="999999999999"
              step="any"
              required
            />
          </label>
        </fieldset>
        <button type="submit" :disabled="saving || loading">
          {{ saving ? "正在保存…" : pending ? "重试同一请求" : "创建规则" }}
        </button>
      </form>
      <p v-if="writeError" role="alert">{{ writeError }}</p>
      <p v-if="notice" role="status">{{ notice }}</p>
    </template>
  </details>
</template>

<style scoped>
.account-competitor-rules {
  margin-block: 0.75rem;
}
.account-competitor-rules summary {
  cursor: pointer;
}
.account-competitor-rules fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-block: 0.5rem;
}
.account-competitor-rules label {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  max-width: 100%;
}
.account-competitor-rules select,
.account-competitor-rules input {
  min-width: 0;
  max-width: 100%;
}
</style>
