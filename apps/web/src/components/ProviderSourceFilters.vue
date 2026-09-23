<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  query: string;
  category: string;
  availability: string;
  market: string;
  language: string;
  accessMode: string;
  sort: string;
  marketOptions: string[];
  languageOptions: string[];
  resultCount: number;
}>();

const emit = defineEmits<{
  "update:query": [value: string];
  "update:category": [value: string];
  "update:availability": [value: string];
  "update:market": [value: string];
  "update:language": [value: string];
  "update:accessMode": [value: string];
  "update:sort": [value: string];
  reset: [];
}>();

const filtersExpanded = ref(false);
</script>

<template>
  <form class="source-filter" aria-label="来源目录筛选" @submit.prevent>
    <label class="source-search" for="source-search">
      搜索来源
      <input
        id="source-search"
        :value="props.query"
        type="search"
        autocomplete="off"
        placeholder="搜索 Amazon、eBay、Reddit、国家或来源网址"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button
      type="button"
      class="source-filter-toggle"
      :aria-expanded="filtersExpanded"
      aria-controls="source-filter-fields"
      @click="filtersExpanded = !filtersExpanded"
    >
      {{ filtersExpanded ? "收起筛选" : "更多筛选与排序" }}
    </button>
    <div
      id="source-filter-fields"
      class="source-filter-fields"
      :class="{ 'is-open': filtersExpanded }"
    >
      <label for="source-category">
        业务类型
        <select
          id="source-category"
          :value="props.category"
          @change="emit('update:category', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">全部类型</option>
          <option value="news">新闻</option>
          <option value="ecommerce">电商平台</option>
          <option value="data">趋势数据</option>
          <option value="community">论坛社区</option>
          <option value="product_supply">商品供应链</option>
        </select>
      </label>
      <label for="source-availability">
        准备状态
        <select
          id="source-availability"
          :value="props.availability"
          @change="emit('update:availability', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">全部状态</option>
          <option value="automatic">自动采集</option>
          <option value="setup_required">需要完成配置</option>
          <option value="manual">手动来源</option>
        </select>
      </label>
      <label for="source-market">
        市场
        <select
          id="source-market"
          :value="props.market"
          @change="emit('update:market', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">全部地区</option>
          <option v-for="option in props.marketOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </label>
      <label for="source-language">
        语言
        <select
          id="source-language"
          :value="props.language"
          @change="emit('update:language', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">全部语言</option>
          <option v-for="option in props.languageOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </label>
      <label for="source-access-mode">
        接入模式
        <select
          id="source-access-mode"
          :value="props.accessMode"
          @change="emit('update:accessMode', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">全部接入模式</option>
          <option value="public_rss">公开 RSS/Atom</option>
          <option value="public_page">公开页面</option>
          <option value="authenticated_browser">网页登录</option>
          <option value="import">文件导入</option>
          <option value="manual">人工录入</option>
        </select>
      </label>
      <label for="source-sort">
        排序
        <select
          id="source-sort"
          :value="props.sort"
          @change="emit('update:sort', ($event.target as HTMLSelectElement).value)"
        >
          <option value="business">业务目录顺序</option>
          <option value="attention">待配置优先</option>
          <option value="name">名称顺序</option>
          <option value="recent">最近成功任务</option>
        </select>
      </label>
      <button type="button" class="source-reset" @click="emit('reset')">重置筛选</button>
    </div>
    <span class="source-result-count" role="status" aria-live="polite"
      >找到 {{ props.resultCount }} 个来源</span
    >
  </form>
</template>

<style scoped src="./ProviderSourceFilters.css"></style>
