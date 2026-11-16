<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import type { TrendFilters, TrendSort } from "./trend-workspace-types";

const props = defineProps<{ filters: TrendFilters; sort: TrendSort; activeCount: number }>();
const emit = defineEmits<{
  apply: [];
  clear: [];
  updateFilters: [filters: TrendFilters];
  updateSort: [sort: TrendSort];
}>();
const updateFilter = (key: keyof TrendFilters, event: Event) =>
  emit("updateFilters", {
    ...props.filters,
    [key]: (event.target as HTMLInputElement | HTMLSelectElement).value,
  });
</script>

<template>
  <ResponsiveFilterDrawer label="筛选趋势" :active-count="activeCount">
    <form class="trend-filters" @submit.prevent="emit('apply')">
      <label
        ><span class="trend-filter-caption">市场</span
        ><span class="trend-filter-field"
          ><AppIcon name="globe" :size="18" /><select
            :value="filters.market"
            @change="updateFilter('market', $event)"
          >
            <option value="">全部市场</option>
            <option value="US">US</option></select
          ><AppIcon class="trend-filter-chevron" name="chevron" :size="15" /></span></label
      ><label
        ><span class="trend-filter-caption">分类</span
        ><span class="trend-filter-field"
          ><AppIcon name="category-grid" :size="18" /><input
            :value="filters.category"
            maxlength="80"
            placeholder="全部分类"
            @input="updateFilter('category', $event)" /></span></label
      ><label
        ><span class="trend-filter-caption">状态</span
        ><span class="trend-filter-field"
          ><AppIcon name="activity" :size="18" /><select
            :value="filters.status"
            @change="updateFilter('status', $event)"
          >
            <option value="active">活跃</option>
            <option value="irrelevant">已标记无关</option>
            <option value="stale">已过期</option>
            <option value="">全部状态</option></select
          ><AppIcon class="trend-filter-chevron" name="chevron" :size="15" /></span></label
      ><label class="search"
        ><span class="trend-filter-caption">关键词</span
        ><span class="trend-filter-search"
          ><AppIcon name="search" :size="16" /><input
            :value="filters.q"
            maxlength="200"
            placeholder="搜索主题或关键词"
            @input="updateFilter('q', $event)" /></span></label
      ><label
        ><span class="trend-filter-caption">排序</span
        ><span class="trend-filter-field"
          ><AppIcon name="layers" :size="18" /><select
            :value="sort"
            @change="emit('updateSort', ($event.target as HTMLSelectElement).value as TrendSort)"
          >
            <option value="impact">影响程度</option>
            <option value="latest">最新信号</option>
            <option value="momentum">增长速度</option></select
          ><AppIcon class="trend-filter-chevron" name="chevron" :size="15" /></span
      ></label>
      <div class="trend-filter-actions">
        <button class="filter-apply-action secondary" type="submit">
          <AppIcon name="funnel" :size="16" />筛选
        </button>
        <button type="button" class="secondary trend-filter-reset" @click="emit('clear')">
          <AppIcon name="refresh" :size="16" />重置
        </button>
      </div>
    </form>
  </ResponsiveFilterDrawer>
</template>

<style scoped src="./trend-filter-actions.css"></style>
