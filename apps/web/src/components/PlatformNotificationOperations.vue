<script setup lang="ts">
import "../platform-notification-operations.css";
import ResponsiveDataView from "./ResponsiveDataView.vue";

const props = defineProps<{
  data: any;
  stateName: (value: unknown) => string;
  when: (value: unknown) => string;
}>();

const subscriptionName = (value: string) =>
  (
    ({
      total: "订阅用户",
      in_app: "启用站内通知",
      in_app_enabled: "启用站内通知",
      email: "启用邮件",
      email_enabled: "启用邮件",
      disabled: "停用全部通知",
      task_enabled: "接收任务通知",
      approval_enabled: "接收审批通知",
      competitor_enabled: "接收竞品通知",
    }) as Record<string, string>
  )[value] ?? "其他偏好";
const actionName = (value: unknown) =>
  (
    ({
      notify_owner: "通知负责人",
      notify: "发送通知",
      create_task: "创建人工任务",
    }) as Record<string, string>
  )[String(value)] ?? "按规则处理";
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
  <section class="notification-ops">
    <div class="notification-ops-grid">
      <article>
        <header>
          <div>
            <h3>系统模板</h3>
            <span>由系统事件触发的内置通知模板</span>
          </div>
        </header>
        <ul>
          <li v-for="item in data.templates" :key="item.category">
            <strong>{{ item.title }}</strong
            ><small>{{ stateName(item.status) }}</small>
          </li>
        </ul>
      </article>
      <article>
        <header>
          <div>
            <h3>渠道状态</h3>
            <span>邮件服务未接入，管理入口已关闭</span>
          </div>
        </header>
        <ul>
          <li v-for="item in data.channels" :key="item.code">
            <strong>{{ item.name }} · {{ stateName(item.status) }}</strong>
            <small>{{
              item.deliveries
                .map((delivery: any) => `${stateName(delivery.status)}：${delivery.total}`)
                .join("，") || "暂无投递"
            }}</small>
          </li>
        </ul>
      </article>
      <article>
        <header>
          <div><h3>用户订阅</h3></div>
          <RouterLink to="/me">个人偏好入口</RouterLink>
        </header>
        <dl>
          <div v-for="(value, key) in data.subscriptions" :key="key">
            <dt>{{ subscriptionName(String(key)) }}</dt>
            <dd>{{ value }}</dd>
          </div>
        </dl>
      </article>
      <article>
        <header>
          <div><h3>告警路由</h3></div>
          <RouterLink to="/platform-admin/governance">规则总览</RouterLink>
        </header>
        <ul>
          <li v-for="item in data.alert_routes.slice(0, 6)" :key="item.id">
            <strong>{{ item.name }}</strong>
            <small>触发后{{ actionName(item.action_type) }} · {{ stateName(item.status) }}</small>
          </li>
        </ul>
        <p v-if="!data.alert_routes.length">暂无告警路由。</p>
      </article>
    </div>
    <div class="platform-management-table">
      <header class="notification-delivery-head">
        <div>
          <h3>通知与投递记录</h3>
          <span>按接收人、组织、类型和渠道查看</span>
        </div>
        <RouterLink to="/platform-admin/governance">在平台规则总览配置</RouterLink>
      </header>
      <ResponsiveDataView
        :rows="data.items"
        :row-key="(item) => item.id"
        title="通知与投递记录"
        :detail-title="(item) => item.title"
        empty-message="暂无通知与投递记录。"
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
                <td>{{ item.read_at ? "已读" : "未读" }}</td>
                <td>{{ deliverySummary(item.delivery_status) }}</td>
              </tr>
            </tbody>
          </table>
        </template>
        <template #summary="{ row }">
          <span class="responsive-record-summary"
            ><strong>{{ row.title }}</strong
            ><small
              >{{ row.read_at ? "已读" : "未读" }} · {{ stateName(row.category) }} ·
              {{ row.recipient_email }}</small
            ></span
          >
        </template>
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
    </div>
  </section>
</template>
