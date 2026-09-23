<script setup lang="ts">
const props = defineProps<{
  status: "loading" | "ready" | "error";
  title: string;
  message: string;
  hasSnapshot: boolean;
  requestId: string;
  traceId: string;
}>();

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <section
    v-if="props.status !== 'ready'"
    class="p11-read-status"
    :data-status="props.status"
    :aria-label="props.title"
    :role="props.status === 'error' ? 'alert' : 'status'"
  >
    <div class="p11-read-status-copy">
      <strong>{{
        props.status === "loading" ? `正在读取${props.title}` : `${props.title}读取未完成`
      }}</strong>
      <span v-if="props.status === 'loading'">{{
        props.hasSnapshot ? "暂保留上次成功读取的内容。" : "尚未取得可确认的内容。"
      }}</span>
      <span v-else
        >{{ props.message
        }}{{ props.hasSnapshot ? " 已保留上次成功读取的内容。" : " 当前没有可确认的快照。" }}</span
      >
      <small v-if="props.status === 'error' && (props.requestId || props.traceId)">
        <template v-if="props.requestId"
          >请求编号：<code>{{ props.requestId }}</code></template
        >
        <template v-if="props.traceId"
          >追踪编号：<code>{{ props.traceId }}</code></template
        >
      </small>
    </div>
    <button v-if="props.status === 'error'" type="button" @click="emit('retry')">
      重新读取分区
    </button>
  </section>
</template>
