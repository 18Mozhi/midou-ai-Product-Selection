<script setup lang="ts">
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import type { PlatformManagementDomain as Domain } from "./platform-management-presentation";

defineProps<{ domain: Exclude<Domain, "status">; label: string; activeCount: number }>();
defineEmits<{ apply: [] }>();
const query = defineModel<string>("query", { required: true });
const status = defineModel<string>("status", { required: true });
</script>

<template>
  <ResponsiveFilterDrawer :label="`筛选${label}`" :active-count="activeCount">
    <form class="platform-management-filter" @submit.prevent="$emit('apply')">
      <input
        v-model="query"
        :placeholder="
          domain === 'content'
            ? '搜索主题、分类或市场'
            : domain === 'api-coverage'
              ? '搜索接口、能力、来源或 UI'
              : '搜索标题、邮箱或组织'
        "
      /><select
        v-model="status"
        :aria-label="
          domain === 'content'
            ? '内容状态'
            : domain === 'notifications'
              ? '通知类型'
              : domain === 'api-coverage'
                ? '验收结果'
                : '邮件状态'
        "
      >
        <option value="">全部状态</option>
        <template v-if="domain === 'content'"
          ><option value="active">展示中</option>
          <option value="irrelevant">无关</option>
          <option value="stale">已过期</option></template
        ><template v-else-if="domain === 'notifications'"
          ><option value="task">任务</option>
          <option value="approval">审批</option>
          <option value="competitor">竞品</option>
          <option value="system">系统</option></template
        ><template v-else-if="domain === 'api-coverage'"
          ><option value="success">成功</option>
          <option value="empty">空结果</option>
          <option value="blocked">受阻</option>
          <option value="unauthorized">越权拒绝</option>
          <option value="not_run">未执行</option></template
        ><template v-else
          ><option value="succeeded">已送达</option>
          <option value="blocked_provider">服务商受阻</option>
          <option value="dead_letter">死信</option>
          <option value="failed">失败</option></template
        ></select
      ><button>筛选</button>
    </form>
  </ResponsiveFilterDrawer>
</template>
