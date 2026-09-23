<script setup lang="ts">
import PersonalSectionReadStatus from "./PersonalSectionReadStatus.vue";
import { decisionName, formatPersonalDate, statusName } from "./formatters";
import type { PersonalAssets, SectionResource } from "./types";

const props = defineProps<{ resource: SectionResource<PersonalAssets> }>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <section class="p11-section">
    <PersonalSectionReadStatus
      :status="props.resource.status"
      title="本人资产"
      :message="props.resource.message"
      :has-snapshot="Boolean(props.resource.data)"
      :request-id="props.resource.readFailureId"
      :trace-id="props.resource.readFailureTraceId"
      @retry="emit('retry')"
    />
    <section v-if="props.resource.data" class="p11-grid">
      <article class="p11-panel">
        <p class="p11-kicker">关注记录</p>
        <h3>关注热点</h3>
        <div v-for="item in props.resource.data.followed_trends" :key="item.id" class="p11-row">
          <RouterLink :to="`/trends?topic=${encodeURIComponent(item.id)}`">{{
            item.title
          }}</RouterLink>
          <small>{{ item.market }} · {{ formatPersonalDate(item.created_at) }}</small>
        </div>
        <p
          v-if="props.resource.status === 'ready' && !props.resource.data.followed_trends.length"
          class="p11-muted"
        >
          暂无关注热点。
        </p>
      </article>
      <article class="p11-panel">
        <p class="p11-kicker">人工记录</p>
        <h3>我的决策</h3>
        <div v-for="item in props.resource.data.decisions" :key="item.id" class="p11-row">
          <RouterLink :to="`/opportunities/${encodeURIComponent(item.opportunity_id)}`">
            {{ item.opportunity_name }}
          </RouterLink>
          <small>{{ decisionName(item.action) }} · {{ formatPersonalDate(item.created_at) }}</small>
        </div>
        <p
          v-if="props.resource.status === 'ready' && !props.resource.data.decisions.length"
          class="p11-muted"
        >
          暂无人工决策。
        </p>
      </article>
      <article class="p11-panel p11-wide">
        <p class="p11-kicker">当前待办</p>
        <h3>我的任务</h3>
        <div v-for="item in props.resource.data.tasks" :key="item.id" class="p11-row">
          <RouterLink to="/tasks">{{ item.title }}</RouterLink>
          <small>
            {{ statusName(item.status) }} · {{ statusName(item.priority) }} ·
            {{ formatPersonalDate(item.due_at) }}
          </small>
        </div>
        <p
          v-if="props.resource.status === 'ready' && !props.resource.data.tasks.length"
          class="p11-muted"
        >
          暂无本人任务。
        </p>
      </article>
    </section>
  </section>
</template>
