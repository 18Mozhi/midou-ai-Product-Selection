import assert from "node:assert/strict";
import path from "node:path";

export const tenancyReviewCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/tenancy-page-preview.css";
export const tenancyPageSources = [
  tenancyReviewCss,
  "scripts/lib/tenancy-page-preview.mjs",
  "apps/web/src/components/TenancyChooser.vue",
];
export function previewTenancyPage(input) {
  const source = input.replaceAll("\r\n", "\n"),
    start = source.indexOf("<template>"),
    end = source.lastIndexOf("</template>");
  assert.ok(start > 0 && end > start, "P08 template bounds");
  const next =
    `<template><main class="tenancy-page tenancy-page--review" style="background:#f3f6fb" :data-state="state"><header class="p08-top"><RouterLink to="/"><span>ScoutOps</span></RouterLink><b>组织与工作区</b><small>先选择组织，再选择工作区</small><span class="p08-account">当前账号</span></header><section class="p08-hero"><p>CONTEXT SELECTION</p><h1>{{ title }}</h1><span>{{ copy }}</span></section><section class="p08-workspace" aria-live="polite"><div v-if="state==='loading'||state==='provisioning'" class="p08-notice"><b>{{ ` +
    `state==='provisioning'?'正在创建个人空间':'正在读取可用范围' }}</b><span>{{ state==='provisioning'?'创建完成后按真实规则进入默认工作区。':'范围读取完成前，不显示可进入的组织或工作区。' }}</span></div><div v-else-if="['error','forbidden','expired'].includes(state)" class="p08-notice p08-error"><b>{{ state==='forbidden'?'当前没有可用的组织权限':state==='expired'?'登录已过期':'暂时无法读取范围' }}</b><span>{{ state==='forbidden'?'请返回组织目录；不会展示无权限的组织。':state==='expired'?'请重新登录后再选择组织和工作区。':'检查网络或登录状态后重新读取。' }}</span><code v-if="requestId">关联编号：{{ requestId }}</code><RouterLink ` +
    `v-if="state==='expired'" class="p08-primary-link" to="/login">重新登录</RouterLink><button v-else class="p08-secondary" type="button" @click="loadOrganizations">返回组织列表</button></div><div v-else-if="state==='empty'" class="p08-notice"><b>{{ selectedOrganization?'该组织暂无可用工作区':'暂无可用组织' }}</b><span>{{ selectedOrganization?'请联系组织管理员创建或恢复工作区。':'创建个人选品空间后即可直接开始使用。' }}</span><div class="p08-actions" v-if="!selectedOrganization"><button class="p08-primary" type="button" @click="createPersonalWorkspace">` +
    `创建并进入选品空间</button><RouterLink to="/me">进入个人中心</RouterLink><RouterLink to="/security/mfa">管理 MFA</RouterLink></div><button v-else class="p08-secondary" type="button" @click="loadOrganizations">返回组织列表</button></div><div v-else-if="state==='selected'&&selectedContext" class="p08-notice p08-success"><b>工作范围已就绪</b><span>{{ selectedContext.organization.name }} · {{ selectedContext.workspace.name }}</span><RouterLink class="p08-primary-link" :to="safeReturnTo">{{ ` +
    `safeReturnTo==='/onboarding'?'继续快速引导':'返回原页面' }}</RouterLink></div><template v-else><section v-if="!selectedOrganization" class="p08-directory"><label>搜索组织<input v-model="organizationQuery" type="search" autocomplete="off" placeholder="输入组织名称或 slug" /></label><div class="p08-list" aria-label="可用组织"><button v-for="organization in filteredOrganizations" :key="organization.id" type="button" @click="chooseOrganization(organization)"><strong>{{ organization.name }}</strong><span>{{ organization.slug ` +
    `}} · {{ organization.timezone }}</span><small>{{ recentOrganizationIds.includes(organization.id)?'最近使用 · ':'' }}选择组织 →</small></button></div><div v-if="!filteredOrganizations.length" class="p08-empty-search"><b>没有匹配的组织</b><span>搜索仅在当前可用组织的名称与 slug 内进行。</span><button class="p08-secondary" type="button" @click="organizationQuery=''">清除搜索</button></div></section><section v-else class="p08-organization"><header><button type="button" @click="loadOrganizations">← 返回组织</button><p>当前组织</p><h2>{{ ` +
    `selectedOrganization.name }}</h2><span>{{ selectedOrganization.slug }} · {{ selectedOrganization.timezone }}</span></header><div class="p08-list" aria-label="可用工作区"><button v-for="workspace in workspaces" :key="workspace.id" type="button" :disabled="workspace.status!=='active'||state==='selecting'" @click="chooseWorkspace(workspace)"><strong>{{ workspace.name }}</strong><span>{{ workspace.status==='active'?'可进入':'已归档，不能进入' }}</span><small>{{ ` +
    `state==='selecting'&&selectedWorkspace?.id===workspace.id?'正在写入范围…':workspace.status==='active'?'选择工作区 →':'不可选择' }}</small></button></div><aside><p>组织团队</p><b>{{ teams.length }}</b><span>{{ teams.length?'当前组织的团队数量':'当前组织尚未建立团队' }}</span></aside></section></template></section><footer class="p08-boundary">组织选择只读取范围 · 仅工作区选择写入会话 · 不显示其他组织数据</footer></main></template>`;
  return source.slice(0, start) + next + source.slice(end + "</template>".length);
}
export function tenancyPagePlugin() {
  return {
    name: "p08-actual-vue-review",
    enforce: "pre",
    transform(source, id) {
      if (
        id.replaceAll("\\", "/") ===
        path.resolve("apps/web/src/components/TenancyChooser.vue").replaceAll("\\", "/")
      )
        return { code: previewTenancyPage(source), map: null };
    },
    transformIndexHtml(html) {
      return html
        .replace("<body>", '<body class="p08-review">')
        .replace(
          "</head>",
          `<link rel="stylesheet" href="/@fs/${path.resolve(tenancyReviewCss).replaceAll("\\", "/")}"></head>`,
        );
    },
  };
}
