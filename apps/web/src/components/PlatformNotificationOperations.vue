<script setup lang="ts">
defineProps<{
  data: any;
  stateName: (value: unknown) => string;
  when: (value: unknown) => string;
}>();
</script>

<template>
  <section class="notification-ops">
    <div class="notification-ops-grid">
      <article>
        <header><div><h3>系统模板</h3><span>由系统事件触发的内置通知模板</span></div></header>
        <ul>
          <li v-for="item in data.templates" :key="item.category">
            <strong>{{ item.title }}</strong><small>{{ stateName(item.status) }}</small>
          </li>
        </ul>
      </article>
      <article>
        <header><div><h3>渠道状态</h3><span>邮件服务未接入，管理入口已关闭</span></div></header>
        <ul>
          <li v-for="item in data.channels" :key="item.code">
            <strong>{{ item.name }} · {{ item.status }}</strong>
            <small>{{ item.deliveries.map((delivery: any) => `${delivery.status}:${delivery.total}`).join("，") || "暂无投递" }}</small>
          </li>
        </ul>
      </article>
      <article>
        <header><div><h3>用户订阅</h3></div><a href="/me">个人偏好入口</a></header>
        <dl>
          <div v-for="(value, key) in data.subscriptions" :key="key">
            <dt>{{ key }}</dt><dd>{{ value }}</dd>
          </div>
        </dl>
      </article>
      <article>
        <header><div><h3>告警路由</h3></div><a href="/platform-admin/governance">规则总览</a></header>
        <ul>
          <li v-for="item in data.alert_routes.slice(0, 6)" :key="item.id">
            <strong>{{ item.name }}</strong>
            <small>触发后{{ item.action_type === "notify_owner" ? "通知负责人" : "创建人工任务" }} · {{ stateName(item.status) }}</small>
          </li>
        </ul>
        <p v-if="!data.alert_routes.length">暂无告警路由。</p>
      </article>
    </div>
    <div class="platform-management-table">
      <header class="notification-delivery-head">
        <div><h3>通知与投递记录</h3><span>按接收人、组织、类型和渠道查看</span></div>
        <a href="/automations">新增或编辑自动化路由</a>
      </header>
      <table>
        <thead><tr><th>通知</th><th>接收人</th><th>组织</th><th>类型 / 级别</th><th>阅读</th><th>投递</th></tr></thead>
        <tbody>
          <tr v-for="item in data.items" :key="item.id">
            <td data-label="通知"><strong>{{ item.title }}</strong><small>{{ when(item.created_at) }}</small></td>
            <td data-label="接收人">{{ item.recipient_email }}</td>
            <td data-label="组织">{{ item.organization_name }}</td>
            <td data-label="类型 / 级别">{{ item.category }} / {{ item.severity }}</td>
            <td data-label="阅读">{{ item.read_at ? "已读" : "未读" }}</td>
            <td data-label="投递">{{ item.delivery_status || "无渠道记录" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.notification-ops { display:grid; gap:14px; }
.notification-ops-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.notification-ops-grid article,.platform-management-table { padding:16px; border:1px solid #20384b; border-radius:13px; background:#0d1d29; }
.notification-ops-grid header,.notification-delivery-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.notification-ops-grid h3,.notification-delivery-head h3 { margin:0; }
.notification-ops-grid header span,.notification-delivery-head span { color:#7892a5; font-size:11px; }
.notification-ops-grid a,.notification-delivery-head a { color:#4fe3cf; font-size:11px; }
.notification-ops-grid ul { margin:12px 0 0; padding:0; list-style:none; }
.notification-ops-grid li { padding:9px 0; border-top:1px solid #1d3547; }
.notification-ops-grid li strong,.notification-ops-grid li small { display:block; }
.notification-ops-grid li small { margin-top:4px; color:#7892a5; }
.notification-ops-grid dl { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.notification-ops-grid dl div { padding:9px; border-radius:8px; background:#0b1d29; }
.notification-ops-grid dd { margin:4px 0 0; font-weight:800; }
.notification-delivery-head { margin-bottom:12px; }
.platform-management-table { overflow:auto; padding:17px; border-radius:14px; }
table { width:100%; border-collapse:collapse; }
th,td { padding:12px 9px; border-bottom:1px solid #1d3547; text-align:left; font-size:13px; }
td strong,td small { display:block; }
td small { margin-top:4px; color:#7892a5; }
@media(max-width:700px) {
  .notification-ops-grid { grid-template-columns:1fr; }
  .platform-management-table { padding:8px; }
  table { min-width:760px; }
}
</style>
