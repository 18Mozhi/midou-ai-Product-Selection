<script setup lang="ts">
import ResponsiveDataView from "./ResponsiveDataView.vue";

defineProps<{ rows: any[]; busy: boolean }>();
const emit = defineEmits<{
  openUser: [item: any];
  role: [userId: string, roleCode: string, enabled: boolean];
}>();

const statusText = (value: string) =>
  ({ active: "正常使用", disabled: "已停用", locked: "已锁定" })[value] ?? value;
const roleText = (value: string) =>
  (
    ({
      platform_operations_admin: "运营管理员",
      platform_security_admin: "安全管理员",
      platform_super_admin: "超级管理员",
    }) as Record<string, string>
  )[value] ?? value;
const roleCodes = ["platform_operations_admin", "platform_security_admin", "platform_super_admin"];
</script>

<template>
  <ResponsiveDataView
    class="account-table-wrap"
    :rows="rows"
    :row-key="(item) => item.id"
    title="管理员记录"
    :detail-title="(item) => item.email"
    empty-message="没有符合条件的管理员。"
  >
    <template #desktop>
      <table>
        <thead>
          <tr>
            <th>可授权用户</th>
            <th>当前平台角色</th>
            <th>角色管理</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.id">
            <td>
              <strong>{{ item.email }}</strong
              ><small>{{ statusText(item.status) }}</small>
            </td>
            <td>{{ item.roles.map(roleText).join("、") || "尚未授予平台角色" }}</td>
            <td>
              <button :disabled="busy" @click="emit('openUser', item)">账号详情</button
              ><button
                v-for="code in roleCodes"
                :key="code"
                :disabled="item.status !== 'active' || busy"
                @click="emit('role', item.id, code, !item.roles.includes(code))"
              >
                {{ item.roles.includes(code) ? "撤销" : "授予" }}{{ roleText(code) }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
    <template #summary="{ row }">
      <span class="responsive-record-summary"
        ><strong>{{ row.email }}</strong
        ><small
          >{{ statusText(row.status) }} ·
          {{ row.roles.map(roleText).join("、") || "尚未授予平台角色" }}</small
        ></span
      >
    </template>
    <template #detail="{ row, close }">
      <dl>
        <div>
          <dt>当前平台角色</dt>
          <dd>{{ row.roles.map(roleText).join("、") || "尚未授予平台角色" }}</dd>
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
            emit('openUser', row);
            close();
          "
        >
          账号详情</button
        ><button
          v-for="code in roleCodes"
          :key="code"
          class="secondary"
          :disabled="row.status !== 'active' || busy"
          @click="
            emit('role', row.id, code, !row.roles.includes(code));
            close();
          "
        >
          {{ row.roles.includes(code) ? "撤销" : "授予" }}{{ roleText(code) }}
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
.account-table-wrap {
  color: var(--so-text);
  background: var(--so-panel);
  border: 1px solid var(--so-border);
  border-radius: 14px;
}
table {
  width: 100%;
  color: var(--so-text);
  border-collapse: collapse;
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
td button {
  padding: 7px 10px;
  margin: 2px;
  color: var(--so-text);
  background: var(--so-bg-elevated);
  border: 1px solid var(--so-border-strong);
  border-radius: 8px;
}
.mobile-actions {
  display: grid;
  gap: 8px;
}
@media (max-width: 700px) {
  .account-table-wrap {
    padding: 0;
    background: transparent;
    border: 0;
  }
}
</style>
