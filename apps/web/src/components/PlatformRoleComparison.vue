<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { RoleCapabilitySummary } from "@scoutops/contracts";

const props = withDefaults(
    defineProps<{ roles: RoleCapabilitySummary[]; persistSelection?: boolean }>(),
    { persistSelection: false },
  ),
  route = useRoute(),
  router = useRouter(),
  queryText = (key: string) =>
    props.persistSelection && typeof route.query[key] === "string" ? String(route.query[key]) : "",
  compareLeft = ref(queryText("left_role") || "platform_operations_admin"),
  compareRight = ref(queryText("right_role") || "platform_security_admin"),
  differencesOnly = ref(queryText("show_all") !== "1"),
  capabilityQuery = ref(queryText("capability_query").slice(0, 80)),
  capabilityGroup = ref(queryText("capability_group").slice(0, 40));

const capabilityText = (value: string) =>
  ({
    "task:read": "查看任务",
    "task:create": "创建任务",
    "task:update": "更新任务",
    "task:assign": "分配任务",
    "trend:read": "查看热点",
    "trend:manage": "管理热点",
    "opportunity:read": "查看选品机会",
    "opportunity:decide": "处理选品机会",
    "opportunity:approve": "审批选品机会",
    "competitor:read": "查看竞品",
    "competitor:manage": "管理竞品",
    "sourcing:read": "查看供应链",
    "supplier_quote:manage": "管理供应商报价",
    "cost:confirm": "确认成本",
    "notification:read": "查看通知",
    "organization:manage": "管理组织",
    "membership:read": "查看成员",
    "membership:manage": "管理成员",
    "workspace:manage": "管理工作区",
    "team:manage": "管理团队",
    "role:read": "查看角色权限",
    "role:manage": "分配角色",
    "organization_token:manage": "管理组织访问凭证",
    "audit:read": "查看审计",
    "report:read": "查看报表",
    "provider:configure": "配置采集来源",
    "collection:replay": "重放采集任务",
    "session:manage": "管理登录会话",
    "platform_token:manage": "管理平台访问凭证",
    "key_rotation:manage": "管理密钥轮换",
    "platform:operate": "管理平台运营",
    "platform:secure": "管理平台安全",
    "platform:superadmin": "管理平台角色与账号",
  })[value] ?? "其他平台权限";
const groupText = (value: string) =>
  ({
    task: "任务协作",
    trend: "热点趋势",
    opportunity: "选品机会",
    competitor: "竞品监控",
    sourcing: "供应链与成本",
    supplier_quote: "供应链与成本",
    cost: "供应链与成本",
    notification: "通知与报表",
    report: "通知与报表",
    organization: "组织治理",
    membership: "组织治理",
    workspace: "组织治理",
    team: "组织治理",
    role: "组织治理",
    organization_token: "安全治理",
    audit: "安全治理",
    session: "安全治理",
    platform_token: "安全治理",
    key_rotation: "安全治理",
    platform: "平台治理",
    provider: "采集治理",
    collection: "采集治理",
  })[value.split(":")[0] ?? ""] ?? "其他能力";

watch(
  () => props.roles,
  (roles) => {
    if (!roles.some((role) => role.code === compareLeft.value))
      compareLeft.value = roles[0]?.code ?? "";
    if (!roles.some((role) => role.code === compareRight.value))
      compareRight.value = roles[1]?.code ?? compareLeft.value;
  },
  { immediate: true },
);

const comparedRoles = computed(() => ({
  left: props.roles.find((role) => role.code === compareLeft.value),
  right: props.roles.find((role) => role.code === compareRight.value),
}));
const capabilityGroups = computed(() =>
  [...new Set(props.roles.flatMap((role) => role.capabilities).map(groupText))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  ),
);
const comparison = computed(() => {
  const left = new Set(comparedRoles.value.left?.capabilities ?? []);
  const right = new Set(comparedRoles.value.right?.capabilities ?? []);
  return [...new Set([...left, ...right])]
    .sort((a, b) => capabilityText(a).localeCompare(capabilityText(b), "zh-CN"))
    .map((capability) => ({
      capability,
      label: capabilityText(capability),
      group: groupText(capability),
      left: left.has(capability),
      right: right.has(capability),
      difference:
        left.has(capability) === right.has(capability)
          ? "两者相同"
          : left.has(capability)
            ? `仅${comparedRoles.value.left?.name ?? "左侧角色"}`
            : `仅${comparedRoles.value.right?.name ?? "右侧角色"}`,
    }))
    .filter((item) => !differencesOnly.value || item.left !== item.right)
    .filter((item) => !capabilityGroup.value || item.group === capabilityGroup.value)
    .filter((item) => {
      const query = capabilityQuery.value.trim().toLocaleLowerCase("zh-CN");
      return (
        !query || `${item.label} ${item.capability}`.toLocaleLowerCase("zh-CN").includes(query)
      );
    });
});
const activeFilterCount = computed(
  () => Number(Boolean(capabilityQuery.value.trim())) + Number(Boolean(capabilityGroup.value)),
);
function resetComparison() {
  compareLeft.value = "platform_operations_admin";
  compareRight.value = "platform_security_admin";
  differencesOnly.value = true;
  capabilityQuery.value = "";
  capabilityGroup.value = "";
}
watch([compareLeft, compareRight, differencesOnly, capabilityQuery, capabilityGroup], () => {
  if (!props.persistSelection) return;
  const next = { ...route.query };
  const set = (key: string, value: string, defaultValue = "") => {
    if (!value || value === defaultValue) delete next[key];
    else next[key] = value;
  };
  set("left_role", compareLeft.value, "platform_operations_admin");
  set("right_role", compareRight.value, "platform_security_admin");
  set("show_all", differencesOnly.value ? "" : "1");
  set("capability_query", capabilityQuery.value.trim());
  set("capability_group", capabilityGroup.value);
  if (JSON.stringify(next) !== JSON.stringify(route.query)) void router.replace({ query: next });
});
</script>

<template>
  <section class="role-comparison">
    <header>
      <div>
        <p>平台权限</p>
        <h3>角色权限差异</h3>
        <span>对比结果来自当前后端角色目录，不以页面按钮推测权限。</span>
      </div>
      <label class="role-comparison__toggle">
        <input v-model="differencesOnly" type="checkbox" />只看差异
      </label>
    </header>
    <div class="role-comparison__selectors">
      <label>
        左侧角色
        <select v-model="compareLeft">
          <option v-for="role in roles" :key="role.code" :value="role.code">
            {{ role.name }}
          </option>
        </select>
      </label>
      <label>
        右侧角色
        <select v-model="compareRight">
          <option v-for="role in roles" :key="role.code" :value="role.code">
            {{ role.name }}
          </option>
        </select>
      </label>
    </div>
    <div class="role-comparison__filters" role="search" aria-label="权限筛选">
      <label>
        搜索权限
        <input v-model="capabilityQuery" maxlength="80" placeholder="搜索权限名称" />
      </label>
      <label>
        能力分组
        <select v-model="capabilityGroup" aria-label="能力分组">
          <option value="">全部分组</option>
          <option v-for="group in capabilityGroups" :key="group" :value="group">{{ group }}</option>
        </select>
      </label>
      <button type="button" :disabled="!activeFilterCount" @click="resetComparison">重置</button>
    </div>
    <div class="role-comparison__summaries">
      <article v-for="role in [comparedRoles.left, comparedRoles.right]" :key="role?.code">
        <strong>{{ role?.name }}</strong>
        <span>{{ role?.description }}</span>
        <small>{{ role?.capabilities.length ?? 0 }} 项权限</small>
      </article>
    </div>
    <p class="role-comparison__result" aria-live="polite">
      当前显示 {{ comparison.length }} 项能力<span v-if="activeFilterCount">
        · {{ activeFilterCount }} 个筛选条件</span
      >
    </p>
    <div class="role-comparison__matrix">
      <p v-if="!comparison.length">
        {{ activeFilterCount ? "没有符合当前筛选的权限" : "当前筛选下，两侧角色没有权限差异。" }}
      </p>
      <article v-for="item in comparison" :key="item.capability">
        <h4>
          {{ item.label }}<small>{{ item.group }}</small>
        </h4>
        <dl>
          <div>
            <dt>{{ comparedRoles.left?.name }}</dt>
            <dd :data-enabled="item.left">{{ item.left ? "拥有" : "无" }}</dd>
          </div>
          <div>
            <dt>{{ comparedRoles.right?.name }}</dt>
            <dd :data-enabled="item.right">{{ item.right ? "拥有" : "无" }}</dd>
          </div>
          <div>
            <dt>差异</dt>
            <dd>{{ item.difference }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </section>
</template>

<style scoped src="./PlatformRoleComparison.css"></style>
