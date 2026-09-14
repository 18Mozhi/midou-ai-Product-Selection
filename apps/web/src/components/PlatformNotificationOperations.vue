<script setup lang="ts">
import "../platform-notification-operations.css";
import ResponsiveDataView from "./ResponsiveDataView.vue";

const props = defineProps<{
  data: any;
  stateName: (value: unknown) => string;
  when: (value: unknown) => string;
}>();
const channelName = (value: string) => ({ in_app: "站内通知", email: "邮件" })[value] ?? "其他渠道";
const deliverySummary = (value: unknown) =>
  String(value || "")
    .split(",")
    .filter(Boolean)
    .map((item) => {
      const [channel, status] = item.split(":");
      return `${channelName(channel || "")}：${props.stateName(status)}`;
    })
    .join("，") || "无渠道记录";
</script>

<template>
  <section class="notification-ops" aria-labelledby="notification-delivery-title">
    <header class="notification-delivery-head">
      <div>
        <h3 id="notification-delivery-title">通知与投递记录</h3>
        <span>六项接收与送达事实；按创建时间倒序。</span>
      </div>
      <RouterLink to="/platform-admin/governance">在规则总览配置</RouterLink>
    </header>
    <ResponsiveDataView
      :rows="data.items ?? []"
      :row-key="(item) => item.id"
      title="通知与投递记录"
      :detail-title="(item) => item.title"
      empty-message="当前投递筛选没有记录。"
    >
      <template #desktop>
        <table>
          <thead>
            <tr>
              <th>通知</th>
              <th>接收人</th>
              <th>组织</th>
              <th>类型 / 级别</th>
              <th>阅读</th>
              <th>投递</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data.items" :key="item.id">
              <td>
                <strong>{{ item.title }}</strong
                ><small>{{ when(item.created_at) }}</small>
              </td>
              <td>{{ item.recipient_email }}</td>
              <td>{{ item.organization_name }}</td>
              <td>{{ stateName(item.category) }} / {{ stateName(item.severity) }}</td>
              <td>
                <i :data-read="item.read_at ? 'read' : 'unread'">{{
                  item.read_at ? "已读" : "未读"
                }}</i>
              </td>
              <td>{{ deliverySummary(item.delivery_status) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
      <template #summary="{ row }"
        ><span class="responsive-record-summary"
          ><strong>{{ row.title }}</strong
          ><small
            >{{ row.read_at ? "已读" : "未读" }} · {{ stateName(row.category) }} ·
            {{ row.recipient_email }}</small
          ></span
        ></template
      >
      <template #detail="{ row }">
        <dl>
          <div>
            <dt>接收人</dt>
            <dd>{{ row.recipient_email }}</dd>
          </div>
          <div>
            <dt>组织</dt>
            <dd>{{ row.organization_name }}</dd>
          </div>
          <div>
            <dt>类型 / 级别</dt>
            <dd>{{ stateName(row.category) }} / {{ stateName(row.severity) }}</dd>
          </div>
          <div>
            <dt>阅读状态</dt>
            <dd>{{ row.read_at ? "已读" : "未读" }}</dd>
          </div>
          <div>
            <dt>投递状态</dt>
            <dd>{{ deliverySummary(row.delivery_status) }}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{{ when(row.created_at) }}</dd>
          </div>
        </dl>
        <details>
          <summary>技术详情</summary>
          <dl>
            <div>
              <dt>通知 ID</dt>
              <dd>{{ row.id }}</dd>
            </div>
            <div v-if="row.delivery_status">
              <dt>原始投递状态</dt>
              <dd>{{ row.delivery_status }}</dd>
            </div>
          </dl>
        </details>
      </template>
    </ResponsiveDataView>
  </section>
</template>
