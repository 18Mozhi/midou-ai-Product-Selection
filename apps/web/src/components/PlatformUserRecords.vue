<script setup lang="ts">
import ResponsiveDataView from "./ResponsiveDataView.vue";

defineProps<{
  rows: any[];
  statusText: (value: string) => string;
  roleText: (value: string) => string;
}>();
const emit = defineEmits<{ openUser: [item: any] }>();
</script>

<template>
  <ResponsiveDataView
    class="account-table-wrap"
    :rows="rows"
    :row-key="(item) => item.id"
    title="用户记录"
    :detail-title="(item) => item.email"
    empty-message="没有符合条件的用户。"
  >
    <template #desktop>
      <table>
        <thead>
          <tr>
            <th>用户</th>
            <th>所在组织</th>
            <th>平台角色</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.id">
            <td>
              <strong>{{ item.email }}</strong
              ><small>注册于 {{ new Date(item.created_at).toLocaleDateString() }}</small>
            </td>
            <td>{{ item.organization_names || "尚未加入组织" }}</td>
            <td>{{ item.platform_roles.map(roleText).join("、") || "普通用户" }}</td>
            <td>
              <b :data-status="item.status">{{ statusText(item.status) }}</b>
            </td>
            <td><button @click="emit('openUser', item)">账号详情</button></td>
          </tr>
        </tbody>
      </table>
    </template>
    <template #summary="{ row }"
      ><span class="responsive-record-summary"
        ><strong>{{ row.email }}</strong
        ><small
          >{{ statusText(row.status) }} · {{ row.organization_names || "尚未加入组织" }}</small
        ></span
      ></template
    >
    <template #detail="{ row, close }">
      <dl>
        <div>
          <dt>所在组织</dt>
          <dd>{{ row.organization_names || "尚未加入组织" }}</dd>
        </div>
        <div>
          <dt>平台角色</dt>
          <dd>{{ row.platform_roles.map(roleText).join("、") || "普通用户" }}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{{ statusText(row.status) }}</dd>
        </div>
        <div>
          <dt>活动会话</dt>
          <dd>{{ row.active_session_count || 0 }} 个</dd>
        </div>
        <div>
          <dt>注册时间</dt>
          <dd>{{ new Date(row.created_at).toLocaleDateString() }}</dd>
        </div>
      </dl>
      <div class="mobile-actions">
        <button
          @click="
            emit('openUser', row);
            close();
          "
        >
          打开账号详情
        </button>
      </div>
      <details>
        <summary>技术详情</summary>
        <dl>
          <div>
            <dt>用户 UUID</dt>
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
