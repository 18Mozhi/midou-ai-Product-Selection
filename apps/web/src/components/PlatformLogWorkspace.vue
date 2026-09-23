<script setup lang="ts">
import { computed, ref } from "vue";
import type { PlatformLogTraceChain } from "./platform-log-types";

const props = defineProps<{ chains: PlatformLogTraceChain[] }>();
defineSlots<{
  chain(props: { chain: PlatformLogTraceChain }): unknown;
}>();

const selectedTraceId = ref<string | null>(null);
const activeTraceId = computed(
  () =>
    props.chains.find((chain) => chain.traceId === selectedTraceId.value)?.traceId ??
    props.chains[0]?.traceId,
);
const sourceName = (source: string) =>
  ({ api: "API", worker: "Worker", crawler: "爬虫" })[source] ?? source;
</script>

<template>
  <div class="p62-workspace">
    <aside class="p62-directory" aria-labelledby="p62-directory-title">
      <h2 id="p62-directory-title">调用链目录</h2>
      <p>仅包含本次返回事件，不代表完整调用链。</p>
      <nav aria-label="选择日志调用链">
        <button
          v-for="(chain, index) in chains"
          :key="chain.traceId"
          type="button"
          :data-log-chain="chain.traceId"
          :aria-pressed="activeTraceId === chain.traceId"
          :aria-controls="`p62-chain-${index}`"
          @click="selectedTraceId = chain.traceId"
        >
          <strong>调用链 {{ index + 1 }}</strong>
          <span>{{ chain.items.length }} 个事件 · {{ chain.exceptionCount }} 个异常</span>
          <small>{{ chain.sources.map(sourceName).join(" / ") }}</small>
        </button>
      </nav>
    </aside>
    <section
      v-for="(chain, index) in chains"
      :id="`p62-chain-${index}`"
      :key="chain.traceId"
      v-show="activeTraceId === chain.traceId"
      class="p62-events"
      :aria-labelledby="`p62-title-${index}`"
    >
      <header class="p62-events-heading">
        <h2 :id="`p62-title-${index}`">事件证据</h2>
        <p>当前返回事件按发生时间排列，编号与关联对象以原始记录为准。</p>
      </header>
      <slot name="chain" :chain="chain" />
    </section>
  </div>
</template>
