<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{ name: string; url: string | null }>();
const failedUrl = ref("");
const imageUrl = computed(() => {
  try {
    const parsed = new URL(props.url ?? "");
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : "";
  } catch {
    return "";
  }
});
</script>

<template>
  <span class="profile-avatar" aria-hidden="true">
    <img
      v-if="imageUrl && imageUrl !== failedUrl"
      :key="imageUrl"
      :src="imageUrl"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="failedUrl = imageUrl"
    />
    <template v-else>{{ Array.from(name.trim()).slice(0, 2).join("") || "?" }}</template>
  </span>
</template>

<style scoped>
.profile-avatar {
  display: inline-grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--so-primary);
  color: var(--so-on-primary, white);
  font-weight: 650;
}
.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
