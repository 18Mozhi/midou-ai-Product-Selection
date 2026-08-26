<script setup lang="ts">
defineProps<{
  form: any;
  busy: boolean;
  invitationResults: Array<{ email: string; status: "success" | "error"; message: string }>;
  invitationTab: "pending" | "expired";
  pendingInvitations: any[];
  expiredInvitations: any[];
  visibleInvitations: any[];
  members: any[];
  filteredMembers: number;
  totalMembers: number;
  memberQuery: string;
  memberStatus: string;
  memberRole: string;
  memberTeam: string;
  memberSort: string;
  memberPage: number;
  memberPageCount: number;
  availableTeams: string[];
  memberRoles: Record<string, string>;
  roleText: (value: string) => string;
  scopeText: (value: string) => string;
  statusText: (value: string) => string;
  effectiveMemberStatus: (member: any) => string;
  formatTime: (value: string) => string;
}>();
const emit = defineEmits<{
  invite: [];
  invitationAction: [invitation: any];
  updateInvitationTab: [value: "pending" | "expired"];
  updateMemberQuery: [value: string];
  updateMemberStatus: [value: string];
  updateMemberRole: [value: string];
  updateMemberTeam: [value: string];
  updateMemberSort: [value: string];
  updateMemberPage: [value: number];
  resetMemberFilters: [];
  updateMemberRoleSelection: [value: { memberId: string; role: string }];
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
    <form class="org-admin-card org-admin-invite-form" @submit.prevent="emit('invite')">
      <h3>邀请成员</h3>
      <label
        >邮箱（每行一个）<textarea
          v-model="form.emails"
          required
          autocomplete="off"
          placeholder="name@company.com"
          aria-describedby="org-member-invite-help"
        ></textarea>
      </label>
      <label
        >角色<select v-model="form.role_code" required>
          <option v-for="role in roles" :key="role" :value="role">{{ roleText(role) }}</option>
        </select></label
      >
      <label>原因<textarea v-model="form.reason" required maxlength="500"></textarea></label>
      <button :disabled="busy">{{ busy ? "正在创建…" : "创建邀请" }}</button>
      <small id="org-member-invite-help"
        >支持单个或批量邀请；每行填写一个邮箱。邮件服务尚未配置时，邀请会显示“等待邮件服务”，不会假装已经发送。</small
      >
      <ul v-if="invitationResults.length" class="org-admin-invite-results" aria-label="邀请结果">
        <li v-for="result in invitationResults" :key="result.email" :data-status="result.status">
          <b>{{ result.email }}</b
          ><span>{{ result.message }}</span>
        </li>
      </ul>
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
        <div class="org-admin-actions">
          <button
            v-if="invitationTab === 'pending'"
            type="button"
            :disabled="busy"
            @click="emit('invitationAction', invitation)"
          >
            撤销邀请
          </button>
          <i :data-status="invitation.status">{{ statusText(invitation.status) }}</i>
        </div>
      </div>
    </article>
    <article class="org-admin-card org-admin-wide">
      <header class="org-admin-section-header">
        <div>
          <h3>组织成员</h3>
          <small
            >筛选 {{ filteredMembers }} / {{ totalMembers }} 人 · 第 {{ memberPage }} /
            {{ memberPageCount }} 页</small
          >
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
        <label
          >排序<select :value="memberSort" @change="emit('updateMemberSort', valueOf($event))">
            <option value="name_asc">姓名 / 邮箱升序</option>
            <option value="joined_desc">最近加入</option>
            <option value="status_asc">状态优先</option>
          </select></label
        >
        <button type="button" class="org-admin-secondary" @click="emit('resetMemberFilters')">
          重置筛选
        </button>
      </div>
      <div v-for="member in members" :key="member.id" class="org-admin-line">
        <div>
          <b>{{ member.display_name || member.email }}</b>
          <small v-if="member.display_name" class="org-admin-member-email">{{ member.email }}</small
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
          <select
            :value="memberRoles[member.id] || member.roles[0] || 'member'"
            :aria-label="`选择 ${member.display_name || member.email} 的角色`"
            @change="
              emit('updateMemberRoleSelection', {
                memberId: member.id,
                role: valueOf($event),
              })
            "
          >
            <option v-for="role in roles" :key="role" :value="role">{{ roleText(role) }}</option>
          </select>
          <button type="button" :disabled="busy" @click="emit('assignRole', member)">
            分配角色
          </button>
          <button type="button" :disabled="busy" @click="emit('memberAction', member)">
            {{ member.status === "active" ? "禁用成员" : "恢复成员" }}
          </button>
          <i :data-status="effectiveMemberStatus(member)">{{
            statusText(effectiveMemberStatus(member))
          }}</i>
        </div>
      </div>
      <p v-if="!members.length">没有符合当前筛选条件的成员。</p>
      <nav v-if="memberPageCount > 1" class="org-admin-pagination" aria-label="成员分页">
        <button
          type="button"
          class="org-admin-secondary"
          :disabled="memberPage <= 1"
          @click="emit('updateMemberPage', memberPage - 1)"
        >
          上一页
        </button>
        <span>第 {{ memberPage }} / {{ memberPageCount }} 页</span>
        <button
          type="button"
          class="org-admin-secondary"
          :disabled="memberPage >= memberPageCount"
          @click="emit('updateMemberPage', memberPage + 1)"
        >
          下一页
        </button>
      </nav>
    </article>
  </section>
</template>
