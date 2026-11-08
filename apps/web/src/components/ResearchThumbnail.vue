<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
const props = defineProps<{
  src?: string | null;
  sourceUrl?: string | null;
  alt?: string;
  priority?: boolean;
}>();
const failed = ref(false),
  iconFailed = ref(false);
const safe = (value?: string | null) => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
};
const photo = computed(() => safe(props.src)?.href);
const icon = computed(() => {
  const url = safe(props.sourceUrl);
  return url ? `${url.origin}/favicon.ico` : null;
});
watch(
  () => [props.src, props.sourceUrl],
  () => {
    failed.value = false;
    iconFailed.value = false;
  },
);
</script>
<template>
  <span class="research-thumbnail" :data-has-source="Boolean(photo || icon)">
    <img
      v-if="photo && !failed"
      :src="photo"
      :alt="alt || '商品图片'"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : undefined"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <img
      v-else-if="icon && !iconFailed"
      class="research-thumbnail-favicon"
      :src="icon"
      :alt="`${alt || '情报来源'}官网图标`"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="iconFailed = true"
    />
    <AppIcon v-else name="box" />
  </span>
</template>
