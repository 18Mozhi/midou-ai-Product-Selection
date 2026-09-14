<script setup lang="ts">
defineProps<{
  data: any;
  stateName: (value: unknown) => string;
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
</script>

<template>
  <section class="notification-facts" aria-labelledby="notification-facts-title">
    <header>
      <div>
        <p>SYSTEM FACTS</p>
        <h3 id="notification-facts-title">系统配置事实</h3>
        <span>这里仅展示系统实际返回的模板、渠道、订阅统计和前 6 条告警路由。</span>
      </div>
    </header>
    <div class="notification-facts__grid">
      <section>
        <header>
          <span>01</span>
          <h4>系统模板</h4>
        </header>
        <ul v-if="data.templates?.length">
          <li v-for="item in data.templates" :key="item.category">
            <strong>{{ item.title }}</strong
            ><small>{{ stateName(item.status) }}</small>
          </li>
        </ul>
        <p v-else>当前没有模板事实。</p>
      </section>
      <section>
        <header>
          <span>02</span>
          <h4>渠道状态</h4>
        </header>
        <p class="notification-facts__mail">邮件服务未接入，管理入口保持关闭。</p>
        <ul v-if="data.channels?.length">
          <li v-for="item in data.channels" :key="item.code">
            <strong>{{ item.name }} · {{ stateName(item.status) }}</strong>
            <small>{{
              item.deliveries
                ?.map((row: any) => `${stateName(row.status)} ${row.total}`)
                .join(" · ") || "暂无投递"
            }}</small>
          </li>
        </ul>
      </section>
      <section>
        <header>
          <span>03</span>
          <h4>用户订阅</h4>
        </header>
        <dl v-if="Object.keys(data.subscriptions ?? {}).length">
          <div v-for="(value, key) in data.subscriptions" :key="key">
            <dt>{{ subscriptionName(String(key)) }}</dt>
            <dd>{{ value }}</dd>
          </div>
        </dl>
        <p v-else>当前没有订阅统计。</p>
        <RouterLink to="/me">查看我的通知偏好</RouterLink>
      </section>
      <section>
        <header>
          <span>04</span>
          <h4>告警路由</h4>
        </header>
        <ul v-if="data.alert_routes?.length">
          <li v-for="item in data.alert_routes.slice(0, 6)" :key="item.id">
            <strong>{{ item.name }}</strong>
            <small>触发后{{ actionName(item.action_type) }} · {{ stateName(item.status) }}</small>
          </li>
        </ul>
        <p v-else>暂无告警路由。</p>
        <RouterLink to="/platform-admin/governance">前往规则总览</RouterLink>
      </section>
    </div>
    <p class="notification-facts__boundary">
      手工平台消息发布不读取个人订阅偏好；候选组织与用户也不是实时受众预检。
    </p>
  </section>
</template>
