<script setup lang="ts">
import ResponsiveDataView from "./ResponsiveDataView.vue";

defineProps<{
  rows: any[];
  busy: boolean;
  statusText: (value: string) => string;
}>();
const emit = defineEmits<{ openOrganization: [item: any] }>();
</script>

<template>
  <ResponsiveDataView
    class="account-table-wrap"
    :rows="rows"
    :row-key="(item) => item.id"
    title="组织记录"
    :detail-title="(item) => item.name"
    empty-message="没有符合条件的组织。"
  >
    <template #desktop>
      <table>
        <thead>
          <tr>
            <th>组织</th>
            <th>成员</th>
            <th>工作区</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.id">
            <td>
              <strong>{{ item.name }}</strong
              ><small>{{ item.slug }}</small>
            </td>
            <td>{{ item.member_count }} 人</td>
            <td>{{ item.workspace_count }} 个</td>
            <td>
              <b :data-status="item.status">{{ statusText(item.status) }}</b>
            </td>
            <td>
              <button :disabled="busy" @click="emit('openOrganization', item)">查看详情</button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
    <template #summary="{ row }">
      <span class="responsive-record-summary"
        ><strong>{{ row.name }}</strong
        ><small
          >{{ statusText(row.status) }} · {{ row.member_count }} 人 ·
          {{ row.workspace_count }} 个工作区</small
        ></span
      >
    </template>
    <template #detail="{ row, close }">
      <dl>
        <div>
          <dt>组织标识</dt>
          <dd>{{ row.slug }}</dd>
        </div>
        <div>
          <dt>成员</dt>
          <dd>{{ row.member_count }} 人</dd>
        </div>
        <div>
          <dt>工作区</dt>
          <dd>{{ row.workspace_count }} 个</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{{ statusText(row.status) }}</dd>
        </div>
      </dl>
      <div class="mobile-actions">
        <button
          :disabled="busy"
          @click="
            emit('openOrganization', row);
            close();
          "
        >
          打开组织详情
        </button>
      </div>
      <details>
        <summary>技术详情</summary>
        <dl>
          <div>
            <dt>组织 UUID</dt>
            <dd>{{ row.id }}</dd>
          </div>
        </dl>
      </details>
    </template>
  </ResponsiveDataView>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  color: var(--so-text);
}
th,
td {
  padding: 14px;
  text-align: left;
  border-bottom: 1px solid var(--so-border);
}
th,
td small {
  color: var(--so-text-muted);
}
td strong,
td small {
  display: block;
}
td small {
  margin-top: 4px;
}
td button,
.mobile-actions button {
  border: 1px solid var(--so-border-strong);
  background: var(--so-bg-elevated);
  color: var(--so-text);
  border-radius: 8px;
  padding: 7px 10px;
}
</style>
