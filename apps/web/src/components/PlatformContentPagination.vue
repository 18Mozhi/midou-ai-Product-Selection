<script setup lang="ts">
defineProps<{
  pagination: { page: number; total: number; total_pages: number };
  refreshing: boolean;
}>();
defineEmits<{ change: [page: number] }>();
</script>

<template>
  <nav class="platform-content-pagination" aria-label="内容分页">
    <span>
      第 {{ pagination.page }} / {{ pagination.total_pages }} 页，共 {{ pagination.total }} 条
    </span>
    <div>
      <button
        type="button"
        :disabled="refreshing || pagination.page <= 1"
        @click="$emit('change', pagination.page - 1)"
      >
        上一页
      </button>
      <button
        type="button"
        :disabled="refreshing || pagination.page >= pagination.total_pages"
        @click="$emit('change', pagination.page + 1)"
      >
        下一页
      </button>
    </div>
  </nav>
</template>

<style scoped>
.platform-content-pagination {
  min-height: var(--so-touch-target);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--so-text-muted);
}
.platform-content-pagination > div {
  display: flex;
  gap: 8px;
}
@media (max-width: 760px) {
  .platform-content-pagination {
    align-items: stretch;
    flex-direction: column;
  }
  .platform-content-pagination button {
    flex: 1;
    min-height: var(--so-touch-target);
  }
}
</style>
