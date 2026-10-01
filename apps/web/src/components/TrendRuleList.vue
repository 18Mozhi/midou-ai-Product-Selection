<script setup lang="ts">
import UiStatePanel from "./UiStatePanel.vue";
import { statusLabel } from "../ui/status-labels";
import type { TrendRule as Rule, TrendWorkspaceState as State } from "./trend-workspace-types";

defineProps<{
  state: State;
  requestId: string;
  rules: Rule[];
  canManage: boolean;
}>();
const emit = defineEmits<{
  reload: [];
  create: [];
  toggle: [item: Rule];
  viewTopics: [item: Rule];
}>();

function freshness(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
</script>

<template>
  <section class="trend-rules">
    <header class="trend-rule-heading">
      <div>
        <p>规则列表</p>
        <h3>趋势监控规则</h3>
        <span v-if="canManage"
          >来源门槛只生成规则命中候选；五项质量门全部通过后才显示建议采纳。通知仅支持站内；邮件服务未确认。</span
        ><span v-else>当前为只读权限；可查看规则与结果，不能创建、暂停或恢复规则。</span>
      </div>
      <button v-if="canManage" type="button" @click="emit('create')">＋ 创建规则</button>
    </header>
    <UiStatePanel
      v-if="state !== 'ready' && state !== 'empty'"
      :kind="state"
      :request-id="requestId"
      :hide-secondary="true"
      @primary="emit('reload')"
    />
    <div v-else-if="!rules.length" class="trend-rule-empty">
      <strong>还没有监控规则</strong
      ><span v-if="canManage">按关键词、市场和语言建立第一条规则。</span
      ><span v-else>当前工作区尚无可查看的监控规则。</span
      ><button v-if="canManage" type="button" @click="emit('create')">创建监控规则</button>
    </div>
    <article v-for="item in rules" :key="item.id">
      <div>
        <b :data-status="item.status">{{ statusLabel(item.status) }}</b>
        <h4>{{ item.name }}</h4>
        <span>{{ item.market }} · {{ item.language }} · {{ item.category || "全部分类" }}</span>
      </div>
      <p>
        <strong>包含</strong>{{ item.include_keywords.join(" · ")
        }}<small v-if="item.negative_keywords.length"
          >排除：{{ item.negative_keywords.join(" · ") }}</small
        >
      </p>
      <dl>
        <div>
          <dt>通知</dt>
          <dd>站内</dd>
        </div>
        <div>
          <dt>采集周期</dt>
          <dd>每 {{ item.collection_interval_minutes }} 分钟</dd>
        </div>
        <div>
          <dt>候选来源门槛</dt>
          <dd>至少 {{ item.recommendation_min_source_count }} 个独立来源</dd>
        </div>
        <div>
          <dt>最后评估</dt>
          <dd>{{ item.last_evaluated_at ? freshness(item.last_evaluated_at) : "尚未评估" }}</dd>
        </div>
        <div>
          <dt>下次采集</dt>
          <dd>{{ item.next_collection_at ? freshness(item.next_collection_at) : "已暂停" }}</dd>
        </div>
        <div>
          <dt>上次失败来源</dt>
          <dd>
            {{ item.last_failed_sources.length ? item.last_failed_sources.join("、") : "无" }}
          </dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>v{{ item.version }}</dd>
        </div>
      </dl>
      <button v-if="canManage" type="button" @click="emit('toggle', item)">
        {{ item.status === "enabled" ? "暂停" : "启用" }}
      </button>
      <button type="button" class="secondary" @click="emit('viewTopics', item)">
        查看趋势结果
      </button>
    </article>
  </section>
</template>
