<script setup lang="ts">
defineProps<{
  form: any;
  busy: boolean;
  invitationTab: "pending" | "expired";
  pendingInvitations: any[];
  expiredInvitations: any[];
  visibleInvitations: any[];
  members: any[];
  totalMembers: number;
  memberQuery: string;
  memberStatus: string;
  memberRole: string;
  memberTeam: string;
  availableTeams: string[];
  memberRoles: Record<string, string>;
  roleText: (value: string) => string;
  scopeText: (value: string) => string;
  statusText: (value: string) => string;
  formatTime: (value: string) => string;
}>();
const emit = defineEmits<{
  invite: [];
  updateInvitationTab: [value: "pending" | "expired"];
  updateMemberQuery: [value: string];
  updateMemberStatus: [value: string];
  updateMemberRole: [value: string];
  updateMemberTeam: [value: string];
  assignRole: [member: any];
  memberAction: [member: any];
}>();
const roles = [
  "member",
  "selection_manager",
  "procurement_member",
  "organization_admin",
  "auditor",
];
const valueOf = (event: Event) => (event.target as HTMLInputElement | HTMLSelectElement).value;
</script>

<template>
  <section class="org-admin-grid">
    <form class="org-admin-card" @submit.prevent="emit('invite')">
      <h3>邀请成员</h3>
      <label>邮箱<input v-model="form.email" type="email" required /></label>
      <label
        >角色<select v-model="form.role_code" required>
          <option v-for="role in roles" :key="role" :value="role">{{ roleText(role) }}</option>
        </select></label
      >
      <label>原因<textarea v-model="form.reason" required></textarea></label>
      <button :disabled="busy">创建邀请</button
      ><small>邮件服务尚未配置时，邀请会显示“等待邮件服务”，不会假装已经发送。</small>
    </form>
    <article class="org-admin-card">
      <header class="org-admin-section-header">
        <h3>邀请记录</h3>
        <nav aria-label="邀请状态">
          <button
            :aria-pressed="invitationTab === 'pending'"
            @click="emit('updateInvitationTab', 'pending')"
          >
            待接受 {{ pendingInvitations.length }}
          </button>
          <button
            :aria-pressed="invitationTab === 'expired'"
            @click="emit('updateInvitationTab', 'expired')"
          >
            已失效 {{ expiredInvitations.length }}
          </button>
        </nav>
      </header>
      <p v-if="!visibleInvitations.length">
        {{ invitationTab === "pending" ? "暂无待接受邀请。" : "暂无已失效邀请。" }}
      </p>
      <div v-for="invitation in visibleInvitations" :key="invitation.id" class="org-admin-line">
        <div>
          <b>{{ invitation.email }}</b
          ><small
            >{{ roleText(invitation.role_code) }} · {{ formatTime(invitation.expires_at) }}</small
          >
        </div>
        <i>{{ invitationTab === "expired" ? "已失效" : statusText(invitation.status) }}</i>
      </div>
    </article>
    <article class="org-admin-card org-admin-wide">
      <header class="org-admin-section-header">
        <div>
          <h3>组织成员</h3>
          <small>显示 {{ members.length }} / {{ totalMembers }} 人</small>
        </div>
      </header>
      <div class="org-admin-filters" aria-label="成员筛选">
        <label
          >搜索<input
            :value="memberQuery"
            type="search"
            placeholder="姓名或邮箱"
            @input="emit('updateMemberQuery', valueOf($event))"
        /></label>
        <label
          >状态<select :value="memberStatus" @change="emit('updateMemberStatus', valueOf($event))">
            <option value="">全部状态</option>
            <option value="active">正常使用</option>
            <option value="disabled">已停用</option>
            <option value="locked">已锁定</option>
          </select></label
        >
        <label
          >角色<select :value="memberRole" @change="emit('updateMemberRole', valueOf($event))">
            <option value="">全部角色</option>
            <option v-for="role in roles" :key="role" :value="role">{{ roleText(role) }}</option>
          </select></label
        >
        <label
          >团队<select :value="memberTeam" @change="emit('updateMemberTeam', valueOf($event))">
            <option value="">全部团队</option>
            <option v-for="team in availableTeams" :key="team" :value="team">{{ team }}</option>
          </select></label
        >
      </div>
      <div v-for="member in members" :key="member.id" class="org-admin-line">
        <div>
          <b>{{ member.email }}</b
          ><small
            >{{ member.roles.map(roleText).join("、") || "尚未分配角色" }} ·
            {{ member.teams?.join("、") || "未加入团队" }} ·
            {{ member.scopes.map(scopeText).join("、") || "无数据范围" }} · 第
            {{ member.version }} 版</small
          >
        </div>
        <div class="org-admin-actions">
          <details class="org-admin-technical">
            <summary>技术详情</summary>
            <code>成员 ID：{{ member.id }}</code>
          </details>
          <select v-model="memberRoles[member.id]" aria-label="选择成员角色">
            <option v-for="role in roles" :key="role" :value="role">{{ roleText(role) }}</option>
          </select>
          <button type="button" :disabled="busy" @click="emit('assignRole', member)">
            分配角色
          </button>
          <button type="button" :disabled="busy" @click="emit('memberAction', member)">
            {{ member.status === "active" ? "禁用成员" : "恢复成员" }}
          </button>
          <i>{{ statusText(member.status) }}</i>
        </div>
      </div>
      <p v-if="!members.length">没有符合当前筛选条件的成员。</p>
    </article>
  </section>
</template>
