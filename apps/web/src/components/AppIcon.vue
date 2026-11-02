<script setup lang="ts">
import { lucideIcons } from "../ui/lucide-icons";
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 });
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <component
      :is="node[0]"
      v-for="(node, index) in lucideIcons[props.name] || lucideIcons.box"
      :key="index"
      v-bind="node[1]"
    />
  </svg>
</template>
