<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { RoleCapabilitySummary } from "@scoutops/contracts";

const props = defineProps<{ roles: RoleCapabilitySummary[] }>();
const compareLeft = ref("platform_operations_admin");
const compareRight = ref("platform_security_admin");
const differencesOnly = ref(true);

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
const comparison = computed(() => {
  const left = new Set(comparedRoles.value.left?.capabilities ?? []);
  const right = new Set(comparedRoles.value.right?.capabilities ?? []);
  return [...new Set([...left, ...right])]
    .sort((a, b) => capabilityText(a).localeCompare(capabilityText(b), "zh-CN"))
    .map((capability) => ({
      capability,
      label: capabilityText(capability),
      left: left.has(capability),
      right: right.has(capability),
      difference:
        left.has(capability) === right.has(capability)
          ? "两者相同"
          : left.has(capability)
            ? `仅${comparedRoles.value.left?.name ?? "左侧角色"}`
            : `仅${comparedRoles.value.right?.name ?? "右侧角色"}`,
    }))
    .filter((item) => !differencesOnly.value || item.left !== item.right);
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
    <div class="role-comparison__summaries">
      <article v-for="role in [comparedRoles.left, comparedRoles.right]" :key="role?.code">
        <strong>{{ role?.name }}</strong>
        <span>{{ role?.description }}</span>
        <small>{{ role?.capabilities.length ?? 0 }} 项权限</small>
      </article>
    </div>
    <div class="role-comparison__matrix" aria-live="polite">
      <p v-if="!comparison.length">当前筛选下，两侧角色没有权限差异。</p>
      <article v-for="item in comparison" :key="item.capability">
        <h4>{{ item.label }}</h4>
        <dl>
          <div>
            <dt>{{ comparedRoles.left?.name }}</dt>
            <dd :data-enabled="item.left">{{ item.left ? "拥有" : "无" }}</dd>
          </div>
          <div>
            <dt>{{ comparedRoles.right?.name }}</dt>
            <dd :data-enabled="item.right">{{ item.right ? "拥有" : "无" }}</dd>
          </div>
          <div><dt>差异</dt><dd>{{ item.difference }}</dd></div>
        </dl>
      </article>
    </div>
  </section>
</template>

<style scoped>
.role-comparison { padding:20px; display:grid; gap:16px; border:1px solid #263f58; border-radius:14px; background:#10243a; }
.role-comparison > header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
.role-comparison > header p,.role-comparison > header h3 { margin:0; }
.role-comparison > header p { color:#79e5d1; font-size:12px; font-weight:800; }
.role-comparison > header h3 { margin-top:5px; font-size:22px; }
.role-comparison > header span,.role-comparison__summaries span,.role-comparison__summaries small { display:block; margin-top:6px; color:#9aadc1; }
.role-comparison__toggle { min-height:44px; display:flex; align-items:center; gap:8px; white-space:nowrap; }
.role-comparison__toggle input { width:18px; height:18px; }
.role-comparison__selectors,.role-comparison__summaries { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.role-comparison__selectors label { display:grid; gap:6px; color:#9aadc1; }
.role-comparison__selectors select { min-height:44px; padding:9px 11px; border:1px solid #31506b; border-radius:9px; color:#eef5ff; background:#0d2033; }
.role-comparison__summaries article { min-width:0; padding:14px; border:1px solid #29465f; border-radius:10px; background:#0b1d2e; }
.role-comparison__matrix { display:grid; gap:8px; }
.role-comparison__matrix > p { margin:0; padding:16px; color:#9aadc1; text-align:center; }
.role-comparison__matrix article {
  padding:12px 14px;
  display:grid;
  grid-template-columns:minmax(170px,.8fr) minmax(0,1.6fr);
  gap:16px;
  align-items:center;
  border:1px solid #29465f;
  border-radius:10px;
  background:#0b1d2e;
}
.role-comparison__matrix h4 { margin:0; }
.role-comparison__matrix dl { margin:0; display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.role-comparison__matrix dt { color:#9aadc1; font-size:11px; }
.role-comparison__matrix dd { margin:4px 0 0; }
.role-comparison__matrix dd[data-enabled="true"] { color:#79e5d1; }
@media(max-width:700px) {
  .role-comparison > header { display:grid; }
  .role-comparison__selectors,.role-comparison__summaries { grid-template-columns:1fr; }
  .role-comparison__matrix article,.role-comparison__matrix dl { grid-template-columns:1fr; }
}
</style>
