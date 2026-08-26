<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{
  roles: any[];
  capabilities: string[];
  authorization: any;
  members: any[];
  workspaces: any[];
  grants: any[];
  grantMeta: any;
  grantCounts: Record<string, number>;
  grantStatus: string;
  grantTargets: any[];
  grantForm: any;
  resourceActions: Record<string, string[]>;
  busy: boolean;
  roleText: (value: string) => string;
  scopeText: (value: string) => string;
  capabilityText: (value: string) => string;
  formatTime: (value: string) => string;
}>();
const emit = defineEmits<{
  updateGrantType: [value: string];
  updateGrantStatus: [value: string];
  updateGrantPage: [value: number];
  createGrant: [];
  extendGrant: [value: { grant: any; reason: string; expires_at: string }];
  revokeGrant: [grant: any];
}>();

const activeSection = ref<"roles" | "scopes" | "grants">("roles"),
  roleQuery = ref(""),
  selectedRoleCode = ref(""),
  capabilityQuery = ref(""),
  capabilityGroup = ref(""),
  scopeQuery = ref(""),
  scopeFilter = ref(""),
  grantQuery = ref(""),
  selectedGrantId = ref(""),
  showGrantForm = ref(false),
  grantMutation = ref({ reason: "", expires_at: "" });

const canManage = computed(() => props.authorization?.capabilities?.includes("role:manage")),
  capabilityGroups: Record<string, string> = {
    task: "任务",
    trend: "热点",
    opportunity: "选品",
    competitor: "竞品",
    sourcing: "供应链",
    supplier_quote: "供应链",
    cost: "供应链",
    notification: "协作",
    organization: "组织治理",
    organization_token: "组织治理",
    membership: "组织治理",
    workspace: "组织治理",
    team: "组织治理",
    role: "组织治理",
    audit: "安全审计",
    report: "报表",
    provider: "数据来源",
  },
  capabilityGroupText = (capability: string) =>
    capabilityGroups[capability.split(":")[0] ?? ""] ?? "其他",
  availableCapabilityGroups = computed(() => [
    ...new Set(props.capabilities.map(capabilityGroupText)),
  ]),
  filteredRoles = computed(() => {
    const query = roleQuery.value.trim().toLowerCase();
    return props.roles.filter(
      (role) =>
        !query ||
        `${role.name} ${role.description} ${role.capabilities.map(props.capabilityText).join(" ")}`
          .toLowerCase()
          .includes(query),
    );
  }),
  selectedRole = computed(
    () =>
      filteredRoles.value.find((role) => role.code === selectedRoleCode.value) ??
      filteredRoles.value[0],
  ),
  selectedRoleGroups = computed(() => {
    const groups = new Map<string, string[]>();
    for (const capability of selectedRole.value?.capabilities ?? []) {
      const group = capabilityGroupText(capability);
      groups.set(group, [...(groups.get(group) ?? []), capability]);
    }
    return [...groups.entries()];
  }),
  filteredCapabilities = computed(() => {
    const query = capabilityQuery.value.trim().toLowerCase();
    return props.capabilities.filter(
      (capability) =>
        (!capabilityGroup.value || capabilityGroupText(capability) === capabilityGroup.value) &&
        (!query ||
          `${props.capabilityText(capability)} ${capability}`.toLowerCase().includes(query)),
    );
  }),
  scopeDefinitions = [
    {
      code: "own",
      title: "本人范围",
      description: "只允许处理本人拥有、负责或被分配的记录。",
    },
    {
      code: "team",
      title: "团队范围",
      description: "只允许访问明确加入团队且属于该团队的业务记录。",
    },
    {
      code: "workspace",
      title: "工作区范围",
      description: "只允许访问明确授权工作区内的记录。",
    },
    {
      code: "organization",
      title: "组织范围",
      description: "可访问当前组织内满足能力要求的记录，不包含平台全局数据。",
    },
  ],
  scopeCounts = computed(() =>
    Object.fromEntries(
      scopeDefinitions.map((scope) => [
        scope.code,
        props.members.filter((member) => member.scopes?.includes(scope.code)).length,
      ]),
    ),
  ),
  filteredScopeMembers = computed(() => {
    const query = scopeQuery.value.trim().toLowerCase();
    return props.members.filter(
      (member) =>
        (!scopeFilter.value || member.scopes?.includes(scopeFilter.value)) &&
        (!query ||
          `${member.display_name ?? ""} ${member.email} ${(member.teams ?? []).join(" ")}`
            .toLowerCase()
            .includes(query)),
    );
  }),
  targetLabel = (membershipId: string) => {
    const member = props.members.find((item) => item.id === membershipId),
      target = props.grantTargets.find((item) => item.id === membershipId);
    return member?.display_name
      ? `${member.display_name} · ${member.email}`
      : (member?.email ?? target?.email ?? "成员信息不可用");
  },
  workspaceLabel = (workspaceId: string) =>
    props.workspaces.find((item) => item.id === workspaceId)?.name ?? "工作区信息不可用",
  resourceTypeText = (value: string) =>
    (
      ({ task: "任务", opportunity: "机会", competitor: "竞品", sourcing: "供应链" }) as Record<
        string,
        string
      >
    )[value] ?? "业务资源",
  filteredGrants = computed(() => {
    const query = grantQuery.value.trim().toLowerCase();
    return props.grants.filter(
      (grant) =>
        !query ||
        `${targetLabel(grant.grantee_membership_id)} ${workspaceLabel(grant.workspace_id)} ${resourceTypeText(grant.resource_type)} ${grant.actions.map(props.capabilityText).join(" ")}`
          .toLowerCase()
          .includes(query),
    );
  }),
  selectedGrant = computed(
    () =>
      filteredGrants.value.find((grant) => grant.id === selectedGrantId.value) ??
      filteredGrants.value[0],
  ),
  grantStatusText = (value: string) =>
    ({ active: "生效中", expired: "已到期", revoked: "已撤销" })[value] ?? "未知状态",
  grantTotal = computed(
    () =>
      (props.grantCounts.active ?? 0) +
      (props.grantCounts.expired ?? 0) +
      (props.grantCounts.revoked ?? 0),
  ),
  grantPageCount = computed(() =>
    Math.max(1, Math.ceil((props.grantMeta?.total ?? 0) / (props.grantMeta?.limit ?? 20))),
  ),
  localDateTime = (date: Date) => {
    const value = new Date(date);
    value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
    return value.toISOString().slice(0, 16);
  },
  minGrantExpiry = localDateTime(new Date(Date.now() + 60_000)),
  maxGrantExpiry = localDateTime(new Date(Date.now() + 30 * 86_400_000));

watch(
  () => props.roles,
  (roles) => {
    if (!roles.some((role) => role.code === selectedRoleCode.value))
      selectedRoleCode.value = roles[0]?.code ?? "";
  },
  { immediate: true },
);
watch(
  () => props.grants,
  (grants) => {
    if (!grants.some((grant) => grant.id === selectedGrantId.value))
      selectedGrantId.value = grants[0]?.id ?? "";
  },
  { immediate: true },
);
watch(
  selectedGrant,
  (grant) => {
    if (!grant) return;
    grantMutation.value = {
      reason: "",
      expires_at: localDateTime(new Date(Date.now() + 7 * 86_400_000)),
    };
  },
  { immediate: true },
);
</script>

<template>
  <section class="org-role-page">
    <section class="org-role-summary" aria-label="角色权限摘要">
      <article>
        <span>固定角色模板</span><b>{{ roles.length }}</b
        ><small>只读目录，不在浏览器自定义</small>
      </article>
      <article>
        <span>业务能力</span><b>{{ capabilities.length }}</b
        ><small>API、Worker 与导出重复校验</small>
      </article>
      <article>
        <span>当前数据范围</span><b>{{ authorization?.data_scopes?.length ?? 0 }}</b
        ><small>{{
          authorization?.data_scopes?.map((item: any) => scopeText(item.scope)).join("、") ||
          "未授予"
        }}</small>
      </article>
      <article>
        <span>生效资源授权</span><b>{{ grantCounts.active ?? 0 }}</b
        ><small>最长 30 天，到期自动失效</small>
      </article>
    </section>

    <nav class="org-role-tabs" aria-label="角色权限分区">
      <button
        v-for="item in [
          { key: 'roles', label: '角色模板与能力' },
          { key: 'scopes', label: '数据范围' },
          { key: 'grants', label: `指定资源授权 ${grantTotal}` },
        ]"
        :key="item.key"
        type="button"
        :aria-pressed="activeSection === item.key"
        @click="activeSection = item.key as typeof activeSection"
      >
        {{ item.label }}
      </button>
    </nav>

    <template v-if="activeSection === 'roles'">
      <section class="org-role-toolbar" aria-label="角色筛选">
        <label
          >搜索角色或能力<input
            v-model="roleQuery"
            type="search"
            placeholder="例如：审批、审计或供应链"
        /></label>
        <span>{{ filteredRoles.length }} / {{ roles.length }} 个角色</span>
      </section>
      <section v-if="roles.length" class="org-role-browser">
        <div class="org-role-list" aria-label="角色模板">
          <button
            v-for="role in filteredRoles"
            :key="role.code"
            type="button"
            :class="{ selected: selectedRole?.code === role.code }"
            @click="selectedRoleCode = role.code"
          >
            <span>{{ role.name.slice(0, 1) }}</span>
            <div>
              <strong>{{ role.name }}</strong>
              <small>{{ role.description }}</small>
            </div>
            <em>{{ role.capabilities.length }} 项</em>
          </button>
          <p v-if="!filteredRoles.length" class="org-role-empty">没有匹配的角色或能力。</p>
        </div>
        <article v-if="selectedRole" class="org-admin-card org-role-detail">
          <p>固定角色模板</p>
          <h3>{{ selectedRole.name }}</h3>
          <span>{{ selectedRole.description }}</span>
          <div v-for="[group, items] in selectedRoleGroups" :key="group" class="org-role-group">
            <b>{{ group }}</b>
            <div class="org-admin-chips">
              <span v-for="capability in items" :key="capability">{{
                capabilityText(capability)
              }}</span>
            </div>
          </div>
          <details>
            <summary>查看技术能力名称</summary>
            <code v-for="capability in selectedRole.capabilities" :key="capability">{{
              capability
            }}</code>
          </details>
          <small>角色分配在“成员与邀请”页完成；本页不创建自定义角色或绕过后端策略。</small>
        </article>
      </section>
      <section v-if="!grantMeta?.total" class="org-admin-state">
        <h3>暂无活动角色</h3>
        <p>角色目录未初始化，所有管理动作保持默认拒绝。</p>
      </section>

      <article v-if="roles.length" class="org-admin-card org-admin-role-matrix">
        <header>
          <div>
            <p>能力矩阵</p>
            <h3>角色影响对比</h3>
          </div>
          <span>{{ filteredCapabilities.length }} / {{ capabilities.length }} 项能力</span>
        </header>
        <div class="org-role-matrix-filters">
          <label
            >搜索能力<input
              v-model="capabilityQuery"
              type="search"
              placeholder="输入中文动作或能力名称"
          /></label>
          <label
            >业务域<select v-model="capabilityGroup">
              <option value="">全部业务域</option>
              <option v-for="group in availableCapabilityGroups" :key="group" :value="group">
                {{ group }}
              </option>
            </select></label
          >
          <button
            type="button"
            :disabled="!capabilityQuery && !capabilityGroup"
            @click="
              capabilityQuery = '';
              capabilityGroup = '';
            "
          >
            重置
          </button>
        </div>
        <div class="org-role-matrix-scroll">
          <div role="table" aria-label="角色能力矩阵">
            <div role="row" class="org-admin-matrix-head">
              <b role="columnheader">业务能力</b
              ><b v-for="role in roles" :key="role.code" role="columnheader">{{ role.name }}</b>
            </div>
            <div v-for="capability in filteredCapabilities" :key="capability" role="row">
              <span role="cell"
                ><strong>{{ capabilityText(capability) }}</strong
                ><small>{{ capabilityGroupText(capability) }}</small></span
              ><span v-for="role in roles" :key="role.code" role="cell">
                <b v-if="role.capabilities.includes(capability)" aria-label="具备">✓</b
                ><i v-else aria-label="未授予">—</i>
              </span>
            </div>
          </div>
        </div>
        <p v-if="!filteredCapabilities.length" class="org-role-empty">当前筛选没有匹配能力。</p>
      </article>
    </template>

    <template v-else-if="activeSection === 'scopes'">
      <section class="org-scope-definitions">
        <article v-for="scope in scopeDefinitions" :key="scope.code" class="org-admin-card">
          <span>{{ scope.title }}</span
          ><b>{{ scopeCounts[scope.code] ?? 0 }} 名成员</b><small>{{ scope.description }}</small>
        </article>
      </section>
      <article class="org-admin-card org-scope-current">
        <div>
          <p>当前会话</p>
          <h3>我的有效数据范围</h3>
        </div>
        <div class="org-admin-chips">
          <span
            v-for="scope in authorization?.data_scopes ?? []"
            :key="scope.scope + scope.scope_key"
          >
            {{ scopeText(scope.scope) }}
          </span>
          <span v-if="!authorization?.data_scopes?.length">未授予数据范围</span>
        </div>
        <small>角色决定能执行什么动作，数据范围决定能看到哪些记录；两者必须同时满足。</small>
      </article>
      <article class="org-admin-card org-scope-members">
        <header>
          <div>
            <p>实际成员范围</p>
            <h3>成员数据范围预览</h3>
          </div>
          <span>{{ filteredScopeMembers.length }} / {{ members.length }} 名成员</span>
        </header>
        <div class="org-role-matrix-filters">
          <label
            >搜索成员<input v-model="scopeQuery" type="search" placeholder="姓名、邮箱或团队"
          /></label>
          <label
            >数据范围<select v-model="scopeFilter">
              <option value="">全部范围</option>
              <option v-for="scope in scopeDefinitions" :key="scope.code" :value="scope.code">
                {{ scope.title }}
              </option>
            </select></label
          >
          <button
            type="button"
            :disabled="!scopeQuery && !scopeFilter"
            @click="
              scopeQuery = '';
              scopeFilter = '';
            "
          >
            重置
          </button>
        </div>
        <div v-for="member in filteredScopeMembers" :key="member.id" class="org-admin-line">
          <div>
            <b>{{ member.display_name || member.email }}</b
            ><small>{{ member.email }}</small>
          </div>
          <div class="org-scope-member-facts">
            <span>{{ member.roles.map(roleText).join("、") }}</span>
            <span>{{ member.scopes.map(scopeText).join("、") || "未授予范围" }}</span>
            <span>{{ member.teams.join("、") || "未加入团队" }}</span>
          </div>
        </div>
        <p v-if="!filteredScopeMembers.length" class="org-role-empty">当前筛选没有成员。</p>
      </article>
    </template>

    <template v-else>
      <article class="org-admin-card org-grant-intro">
        <div>
          <p>最小权限例外</p>
          <h3>指定资源授权</h3>
          <span
            >只向同组织活动成员开放一个指定资源；下载、导出、凭证与任务重放始终不在授权范围内。</span
          >
        </div>
        <button v-if="canManage" type="button" @click="showGrantForm = !showGrantForm">
          {{ showGrantForm ? "取消创建" : "创建授权" }}
        </button>
      </article>

      <form
        v-if="showGrantForm && canManage"
        class="org-admin-card org-grant-form"
        @submit.prevent="emit('createGrant')"
      >
        <header>
          <div>
            <p>带原因并审计</p>
            <h3>授权指定资源</h3>
          </div>
        </header>
        <label
          >工作区<select v-model="grantForm.workspace_id" required>
            <option disabled value="">选择工作区</option>
            <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">
              {{ workspace.name }}
            </option>
          </select></label
        >
        <label
          >资源类型<select
            :value="grantForm.resource_type"
            required
            @change="emit('updateGrantType', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="(_, type) in resourceActions" :key="type" :value="type">
              {{ resourceTypeText(type) }}
            </option>
          </select></label
        >
        <label
          >资源编号<input
            v-model.trim="grantForm.resource_id"
            required
            pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"
            placeholder="从资源详情页复制 UUID"
          /><small>必须从真实资源详情页复制；实际访问仍会按工作区、资源和动作复核。</small></label
        >
        <label
          >目标成员<select v-model="grantForm.grantee_membership_id" required>
            <option disabled value="">选择同组织活动成员</option>
            <option v-for="target in grantTargets" :key="target.id" :value="target.id">
              {{ targetLabel(target.id) }}
            </option>
          </select></label
        >
        <fieldset>
          <legend>最小必要动作</legend>
          <label v-for="action in resourceActions[grantForm.resource_type]" :key="action">
            <input v-model="grantForm.actions" type="checkbox" :value="action" />
            {{ capabilityText(action) }}
          </label>
        </fieldset>
        <label
          >业务原因<textarea v-model.trim="grantForm.reason" required maxlength="500"></textarea>
        </label>
        <label
          >到期时间<input
            v-model="grantForm.expires_at"
            required
            type="datetime-local"
            :min="minGrantExpiry"
            :max="maxGrantExpiry"
          /><small>必须晚于当前时间，且最长 30 天。</small></label
        >
        <button :disabled="busy || !grantForm.actions.length">
          {{ busy ? "正在创建…" : "创建并写入审计" }}
        </button>
      </form>

      <section class="org-grant-toolbar" aria-label="资源授权筛选">
        <div role="group" aria-label="授权状态">
          <button
            v-for="status in ['all', 'active', 'expired', 'revoked']"
            :key="status"
            type="button"
            :aria-pressed="grantStatus === status"
            :disabled="busy"
            @click="emit('updateGrantStatus', status)"
          >
            {{
              status === "all"
                ? `全部 ${grantTotal}`
                : `${grantStatusText(status)} ${grantCounts[status] ?? 0}`
            }}
          </button>
        </div>
        <label
          >搜索当前页授权<input
            v-model="grantQuery"
            type="search"
            placeholder="成员、工作区、类型或动作"
        /></label>
      </section>

      <section v-if="grants.length" class="org-grant-browser">
        <div class="org-grant-list" aria-label="指定资源授权列表">
          <button
            v-for="grant in filteredGrants"
            :key="grant.id"
            type="button"
            :class="{ selected: selectedGrant?.id === grant.id }"
            @click="selectedGrantId = grant.id"
          >
            <i :data-status="grant.effective_status">{{
              grantStatusText(grant.effective_status)
            }}</i>
            <strong
              >{{ resourceTypeText(grant.resource_type) }} ·
              {{ targetLabel(grant.grantee_membership_id) }}</strong
            >
            <span>{{ workspaceLabel(grant.workspace_id) }}</span>
            <small>到期 {{ formatTime(grant.expires_at) }}</small>
          </button>
          <p v-if="!filteredGrants.length" class="org-role-empty">当前筛选没有资源授权。</p>
        </div>
        <article v-if="selectedGrant" class="org-admin-card org-grant-detail">
          <p>指定资源授权</p>
          <header>
            <div>
              <h3>{{ resourceTypeText(selectedGrant.resource_type) }}</h3>
              <span>{{ targetLabel(selectedGrant.grantee_membership_id) }}</span>
            </div>
            <i :data-status="selectedGrant.effective_status">{{
              grantStatusText(selectedGrant.effective_status)
            }}</i>
          </header>
          <dl>
            <div>
              <dt>工作区</dt>
              <dd>{{ workspaceLabel(selectedGrant.workspace_id) }}</dd>
            </div>
            <div>
              <dt>授权原因</dt>
              <dd>{{ selectedGrant.reason }}</dd>
            </div>
            <div>
              <dt>有效期</dt>
              <dd>{{ formatTime(selectedGrant.expires_at) }}</dd>
            </div>
            <div>
              <dt>版本</dt>
              <dd>第 {{ selectedGrant.version }} 版</dd>
            </div>
          </dl>
          <div class="org-admin-chips">
            <span v-for="action in selectedGrant.actions" :key="action">{{
              capabilityText(action)
            }}</span>
          </div>
          <details>
            <summary>查看技术标识</summary>
            <code>资源 {{ selectedGrant.resource_id }}</code>
            <code>授权 {{ selectedGrant.id }}</code>
          </details>
          <form
            v-if="canManage && selectedGrant.effective_status === 'active'"
            class="org-grant-mutation"
            @submit.prevent="
              emit('extendGrant', {
                grant: selectedGrant,
                reason: grantMutation.reason,
                expires_at: grantMutation.expires_at,
              })
            "
          >
            <label
              >变更原因<input v-model.trim="grantMutation.reason" required maxlength="500"
            /></label>
            <label
              >新到期时间<input
                v-model="grantMutation.expires_at"
                required
                type="datetime-local"
                :min="minGrantExpiry"
                :max="maxGrantExpiry"
            /></label>
            <div class="org-admin-actions">
              <button :disabled="busy">{{ busy ? "正在保存…" : "延长授权" }}</button>
              <button
                class="danger"
                type="button"
                :disabled="busy"
                @click="emit('revokeGrant', selectedGrant)"
              >
                撤销授权
              </button>
            </div>
          </form>
          <small>创建、延长、撤销及实际访问都会记录请求标识、链路标识和审计事件。</small>
        </article>
      </section>
      <nav v-if="grantMeta?.total" class="org-grant-pagination" aria-label="资源授权分页">
        <button
          type="button"
          :disabled="busy || grantMeta.page <= 1"
          @click="emit('updateGrantPage', grantMeta.page - 1)"
        >
          上一页
        </button>
        <span>第 {{ grantMeta.page }} / {{ grantPageCount }} 页 · 共 {{ grantMeta.total }} 条</span>
        <button
          type="button"
          :disabled="busy || grantMeta.page >= grantPageCount"
          @click="emit('updateGrantPage', grantMeta.page + 1)"
        >
          下一页
        </button>
      </nav>
      <section v-if="grantTotal === 0" class="org-admin-state">
        <h3>暂无指定资源授权</h3>
        <p>RBAC 与数据范围继续生效；未明确授权的资源默认拒绝。</p>
        <button v-if="canManage" type="button" @click="showGrantForm = true">创建首条授权</button>
      </section>
      <section v-else-if="!grantMeta?.total" class="org-admin-state">
        <h3>当前状态没有资源授权</h3>
        <p>组织内仍有其他状态的授权，可以返回全部授权继续查看。</p>
        <button type="button" :disabled="busy" @click="emit('updateGrantStatus', 'all')">
          查看全部授权
        </button>
      </section>
    </template>
  </section>
</template>
