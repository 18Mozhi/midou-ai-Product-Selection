<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { ShellNavigationItem } from "../route-catalog";

defineProps<{
  primaryItems: ShellNavigationItem[];
  activePath?: string;
  moreActive: boolean;
  menuOpen: boolean;
}>();
const emit = defineEmits<{ openMenu: [] }>();
</script>

<template>
  <nav class="role-mobile-nav" aria-label="移动快捷导航">
    <RouterLink
      v-for="item in primaryItems"
      :key="item.path"
      :to="item.path"
      :aria-current="activePath === item.path ? 'page' : undefined"
      ><i><AppIcon :name="item.icon" /></i><span>{{ item.label }}</span></RouterLink
    ><button
      type="button"
      :aria-current="moreActive ? 'page' : undefined"
      aria-controls="role-navigation"
      :aria-expanded="menuOpen"
      @click="emit('openMenu')"
    >
      <i><AppIcon name="menu" /></i><span>更多</span>
    </button>
  </nav>
</template>
