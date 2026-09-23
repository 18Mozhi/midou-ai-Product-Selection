<script setup lang="ts">
import PersonalSectionReadStatus from "./PersonalSectionReadStatus.vue";
import { capabilityName, roleName, scopeName } from "./formatters";
import type { SectionResource, PersonalAuthorization } from "./types";

const props = defineProps<{
  resource: SectionResource<PersonalAuthorization>;
  canManageOrganizationToken: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <section class="p11-section">
    <PersonalSectionReadStatus
      :status="props.resource.status"
      title="权限"
      :message="props.resource.message"
      :has-snapshot="Boolean(props.resource.data)"
      :request-id="props.resource.readFailureId"
      :trace-id="props.resource.readFailureTraceId"
      @retry="emit('retry')"
    />
    <section
      v-if="props.resource.data"
      class="p11-grid"
      :data-snapshot="props.resource.status === 'error'"
    >
      <article class="p11-panel">
        <p class="p11-kicker">我的职责</p>
        <h3>角色</h3>
        <span v-for="role in props.resource.data.roles" :key="role" class="p11-value">
          {{ roleName(role) }}
        </span>
        <span
          v-if="props.resource.status === 'ready' && !props.resource.data.roles.length"
          class="p11-muted"
        >
          暂无已确认角色。
        </span>
      </article>
      <article class="p11-panel">
        <p class="p11-kicker">读取边界</p>
        <h3>数据范围</h3>
        <span
          v-for="scope in props.resource.data.data_scopes"
          :key="scope.scope + (scope.scope_key ?? '')"
          class="p11-value"
        >
          {{ scopeName(scope.scope) }}<template v-if="scope.scope_key"> · 指定范围</template>
        </span>
        <span
          v-if="props.resource.status === 'ready' && !props.resource.data.data_scopes.length"
          class="p11-muted"
        >
          暂无已确认的数据范围。
        </span>
      </article>
      <article class="p11-panel p11-wide">
        <p class="p11-kicker">能力目录</p>
        <h3>可执行动作</h3>
        <div v-if="props.resource.data.capabilities.length" class="p11-capabilities">
          <span v-for="capability in props.resource.data.capabilities" :key="capability">
            {{ capabilityName(capability) }}
          </span>
        </div>
        <span v-else-if="props.resource.status === 'ready'" class="p11-muted">
          暂无已确认的可执行动作。
        </span>
        <RouterLink v-if="props.canManageOrganizationToken" to="/org-admin/tokens">
          管理组织令牌
        </RouterLink>
      </article>
    </section>
  </section>
</template>
