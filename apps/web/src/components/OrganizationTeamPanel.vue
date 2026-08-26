<script setup lang="ts">
import { computed, ref, watch } from "vue";

type TeamWrite = {
  name: string;
  lead_membership_id: string;
  default_workflow_key: string;
  reason: string;
};

const props = defineProps<{
    teams: any[];
    members: any[];
    busy: boolean;
    createTeam: (value: TeamWrite) => Promise<boolean>;
    performMemberAction: (
      team: any,
      action: "assign" | "remove",
      membershipId: string,
    ) => Promise<boolean>;
  }>(),
  query = ref(""),
  statusFilter = ref<"all" | "active" | "archived">("all"),
  sort = ref<"name_asc" | "members_desc" | "updated_desc">("name_asc"),
  page = ref(1),
  pageSize = 8,
  selectedTeamId = ref(""),
  selectedMembershipId = ref(""),
  createOpen = ref(false),
  createBusy = ref(false),
  memberBusy = ref(false),
  memberFeedback = ref(""),
  form = ref<TeamWrite>({
    name: "",
    lead_membership_id: "",
    default_workflow_key: "",
    reason: "",
  });

const activeMembers = computed(() => props.members.filter((member) => member.status === "active")),
  activeCount = computed(() => props.teams.filter((team) => team.status === "active").length),
  archivedCount = computed(() => props.teams.filter((team) => team.status === "archived").length),
  assignedCount = computed(() =>
    props.teams.reduce((total, team) => total + Number(team.member_count ?? 0), 0),
  ),
  leadCount = computed(() => props.teams.filter((team) => team.lead_membership_id).length),
  workflowCount = computed(() => props.teams.filter((team) => team.default_workflow_key).length),
  filteredTeams = computed(() => {
    const keyword = query.value.trim().toLowerCase(),
      items = props.teams.filter(
        (team) =>
          (statusFilter.value === "all" || team.status === statusFilter.value) &&
          (!keyword ||
            String(team.name ?? "")
              .toLowerCase()
              .includes(keyword) ||
            String(team.lead_email ?? "")
              .toLowerCase()
              .includes(keyword) ||
            String(team.default_workflow_key ?? "")
              .toLowerCase()
              .includes(keyword)),
      );
    return [...items].sort((left, right) => {
      if (sort.value === "members_desc")
        return (
          Number(right.member_count ?? 0) - Number(left.member_count ?? 0) ||
          String(left.name).localeCompare(String(right.name), "zh-CN")
        );
      if (sort.value === "updated_desc")
        return (
          new Date(right.updated_at).valueOf() - new Date(left.updated_at).valueOf() ||
          String(left.name).localeCompare(String(right.name), "zh-CN")
        );
      return String(left.name).localeCompare(String(right.name), "zh-CN");
    });
  }),
  pageCount = computed(() => Math.max(1, Math.ceil(filteredTeams.value.length / pageSize))),
  pageItems = computed(() =>
    filteredTeams.value.slice((page.value - 1) * pageSize, page.value * pageSize),
  ),
  selectedTeam = computed(() => props.teams.find((team) => team.id === selectedTeamId.value)),
  selectedMember = computed(() =>
    activeMembers.value.find((member) => member.id === selectedMembershipId.value),
  );

watch(
  () => props.teams,
  (teams) => {
    if (!teams.some((team) => team.id === selectedTeamId.value))
      selectedTeamId.value =
        teams.find((team) => team.status === "active")?.id ?? teams[0]?.id ?? "";
    if (!teams.length) createOpen.value = true;
  },
  { immediate: true, deep: true },
);
watch([query, statusFilter, sort], () => {
  page.value = 1;
});
watch(pageCount, (count) => {
  if (page.value > count) page.value = count;
});
watch(selectedTeamId, () => {
  selectedMembershipId.value = "";
  memberFeedback.value = "";
});

function memberLabel(member: any) {
  return member.display_name ? `${member.display_name} · ${member.email}` : member.email;
}
function resetFilters() {
  query.value = "";
  statusFilter.value = "all";
  sort.value = "name_asc";
}
function openCreate() {
  createOpen.value = true;
  window.requestAnimationFrame(() =>
    document.querySelector<HTMLInputElement>("#team-name")?.focus(),
  );
}
function cancelCreate() {
  if (createBusy.value) return;
  form.value = { name: "", lead_membership_id: "", default_workflow_key: "", reason: "" };
  createOpen.value = false;
}
async function submitCreate() {
  if (createBusy.value || props.busy) return;
  createBusy.value = true;
  try {
    const created = await props.createTeam({
      name: form.value.name.trim(),
      lead_membership_id: form.value.lead_membership_id,
      default_workflow_key: form.value.default_workflow_key.trim(),
      reason: form.value.reason.trim(),
    });
    if (created) {
      form.value = { name: "", lead_membership_id: "", default_workflow_key: "", reason: "" };
      createOpen.value = false;
    }
  } finally {
    createBusy.value = false;
  }
}
async function performMemberAction(action: "assign" | "remove") {
  if (!selectedTeam.value || props.busy || memberBusy.value) return;
  if (!selectedMembershipId.value) {
    memberFeedback.value = "请先选择一位当前组织的活动成员。";
    return;
  }
  memberBusy.value = true;
  memberFeedback.value = "";
  try {
    const succeeded = await props.performMemberAction(
      selectedTeam.value,
      action,
      selectedMembershipId.value,
    );
    if (succeeded)
      memberFeedback.value = `${memberLabel(selectedMember.value)}已${action === "assign" ? "分配到" : "从"}${selectedTeam.value.name}${action === "remove" ? "移除" : ""}。`;
  } finally {
    memberBusy.value = false;
  }
}
const statusText = (status: string) => (status === "active" ? "正常使用" : "已归档"),
  fmt = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "暂无记录";
</script>

<template>
  <section class="org-team-panel" aria-label="团队治理台">
    <header class="org-team-overview">
      <div>
        <p>协作边界</p>
        <h3>团队治理台</h3>
        <span>按当前组织维护团队、负责人和成员归属；所有写操作保留原因与审计。</span>
      </div>
      <button type="button" :disabled="busy" @click="openCreate">新建团队</button>
    </header>

    <div class="org-team-metrics" aria-label="团队统计">
      <article>
        <span>全部团队</span><b>{{ teams.length }}</b
        ><small>当前组织范围</small>
      </article>
      <article>
        <span>正常使用</span><b>{{ activeCount }}</b
        ><small>可继续分配成员</small>
      </article>
      <article>
        <span>已归档</span><b>{{ archivedCount }}</b
        ><small>历史关系仍保留</small>
      </article>
      <article>
        <span>团队成员关系</span><b>{{ assignedCount }}</b
        ><small>各团队分配数合计</small>
      </article>
      <article>
        <span>已设负责人</span><b>{{ leadCount }}</b
        ><small>共 {{ teams.length }} 个团队</small>
      </article>
      <article>
        <span>已设默认流程</span><b>{{ workflowCount }}</b
        ><small>创建时配置的流程键</small>
      </article>
    </div>

    <form v-if="createOpen" class="org-team-create" @submit.prevent="submitCreate">
      <header>
        <div>
          <p>建立协作单元</p>
          <h3>新建团队</h3>
          <span>负责人必须是当前组织的活动成员；选择负责人后会同时建立团队成员关系。</span>
        </div>
        <button
          type="button"
          class="org-admin-secondary"
          :disabled="createBusy"
          @click="cancelCreate"
        >
          取消
        </button>
      </header>
      <div class="org-team-create-grid">
        <label for="team-name">
          团队名称
          <input
            id="team-name"
            v-model="form.name"
            maxlength="120"
            autocomplete="off"
            placeholder="例如：北美新品采购组"
            required
          />
          <small>{{ form.name.length }}/120 · 使用成员熟悉的业务名称</small>
        </label>
        <label for="team-lead">
          负责人（可选）
          <select id="team-lead" v-model="form.lead_membership_id">
            <option value="">暂不设置</option>
            <option v-for="member in activeMembers" :key="member.id" :value="member.id">
              {{ memberLabel(member) }}
            </option>
          </select>
          <small>负责人创建后会自动成为团队成员</small>
        </label>
        <label for="team-workflow">
          默认工作流程（可选）
          <input
            id="team-workflow"
            v-model="form.default_workflow_key"
            maxlength="80"
            autocomplete="off"
            placeholder="输入已有流程键"
          />
          <small
            >{{ form.default_workflow_key.length }}/80 · 当前接口只保存流程键，不校验流程名称</small
          >
        </label>
        <label class="org-team-reason" for="team-reason">
          创建原因
          <textarea
            id="team-reason"
            v-model="form.reason"
            maxlength="500"
            placeholder="说明团队职责、使用范围和创建目的"
            required
          ></textarea>
          <small>{{ form.reason.length }}/500 · 原因将写入组织审计</small>
        </label>
      </div>
      <footer>
        <span>创建请求带幂等键，并在同一事务写入团队事实、审计与事件。</span>
        <button type="submit" :disabled="busy || createBusy">
          {{ createBusy ? "正在创建…" : "创建并写入审计" }}
        </button>
      </footer>
    </form>

    <section class="org-team-browser">
      <article class="org-admin-card org-team-directory">
        <header class="org-team-section-heading">
          <div>
            <p>团队目录</p>
            <h3>找到并选择团队</h3>
          </div>
          <span>{{ filteredTeams.length }} / {{ teams.length }}</span>
        </header>
        <div class="org-team-status-tabs" role="group" aria-label="团队状态">
          <button
            type="button"
            :aria-pressed="statusFilter === 'all'"
            @click="statusFilter = 'all'"
          >
            全部 {{ teams.length }}
          </button>
          <button
            type="button"
            :aria-pressed="statusFilter === 'active'"
            @click="statusFilter = 'active'"
          >
            正常使用 {{ activeCount }}
          </button>
          <button
            type="button"
            :aria-pressed="statusFilter === 'archived'"
            @click="statusFilter = 'archived'"
          >
            已归档 {{ archivedCount }}
          </button>
        </div>
        <div class="org-team-toolbar">
          <label
            >搜索团队<input v-model="query" type="search" placeholder="名称、负责人邮箱或流程键"
          /></label>
          <label>
            排序
            <select v-model="sort">
              <option value="name_asc">名称 A–Z</option>
              <option value="members_desc">成员最多</option>
              <option value="updated_desc">最近更新</option>
            </select>
          </label>
          <button type="button" class="org-admin-secondary" @click="resetFilters">重置筛选</button>
        </div>

        <div v-if="pageItems.length" class="org-team-list" role="list">
          <button
            v-for="team in pageItems"
            :key="team.id"
            type="button"
            role="listitem"
            :class="{ 'is-selected': team.id === selectedTeamId }"
            :aria-label="`选择团队 ${team.name}`"
            :aria-current="team.id === selectedTeamId ? 'true' : undefined"
            @click="selectedTeamId = team.id"
          >
            <span class="org-team-mark">{{ team.name.slice(0, 1) }}</span>
            <span>
              <b>{{ team.name }}</b>
              <small>{{ team.member_count }} 名成员 · {{ team.lead_email || "未设负责人" }}</small>
            </span>
            <em v-if="team.default_workflow_key">有默认流程</em>
            <i :data-status="team.status">{{ statusText(team.status) }}</i>
          </button>
        </div>
        <div v-else class="org-team-empty" role="status">
          <span aria-hidden="true">◎</span>
          <h4>{{ teams.length ? "没有符合条件的团队" : "当前组织还没有团队" }}</h4>
          <p>
            {{
              teams.length
                ? "调整关键词或状态条件，不会改变已保存的团队关系。"
                : "创建首个团队后即可设置负责人并分配活动成员。"
            }}
          </p>
          <button
            v-if="teams.length"
            type="button"
            class="org-admin-secondary"
            @click="resetFilters"
          >
            清除筛选
          </button>
          <button v-else type="button" @click="openCreate">创建团队</button>
        </div>
        <nav
          v-if="filteredTeams.length > pageSize"
          class="org-admin-pagination"
          aria-label="团队分页"
        >
          <button
            type="button"
            class="org-admin-secondary"
            :disabled="page <= 1"
            @click="page -= 1"
          >
            上一页
          </button>
          <span>第 {{ page }} / {{ pageCount }} 页 · 共 {{ filteredTeams.length }} 条</span>
          <button
            type="button"
            class="org-admin-secondary"
            :disabled="page >= pageCount"
            @click="page += 1"
          >
            下一页
          </button>
        </nav>
      </article>

      <article class="org-admin-card org-team-detail" aria-live="polite">
        <template v-if="selectedTeam">
          <header>
            <div>
              <p>当前选择</p>
              <h3>{{ selectedTeam.name }}</h3>
            </div>
            <i :data-status="selectedTeam.status">{{ statusText(selectedTeam.status) }}</i>
          </header>
          <dl>
            <div>
              <dt>负责人</dt>
              <dd>{{ selectedTeam.lead_email || "尚未设置" }}</dd>
            </div>
            <div>
              <dt>成员关系</dt>
              <dd>{{ selectedTeam.member_count }} 人</dd>
            </div>
            <div>
              <dt>默认工作流程</dt>
              <dd>{{ selectedTeam.default_workflow_key || "尚未设置" }}</dd>
            </div>
            <div>
              <dt>当前版本</dt>
              <dd>第 {{ selectedTeam.version }} 版</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{{ fmt(selectedTeam.created_at) }}</dd>
            </div>
            <div>
              <dt>最近更新</dt>
              <dd>{{ fmt(selectedTeam.updated_at) }}</dd>
            </div>
          </dl>
          <section class="org-team-membership">
            <header>
              <div>
                <p>成员关系</p>
                <h4>分配或移除活动成员</h4>
              </div>
              <span>{{ activeMembers.length }} 位可选</span>
            </header>
            <label for="team-member-select">
              当前组织成员
              <select id="team-member-select" v-model="selectedMembershipId">
                <option value="">请选择成员</option>
                <option v-for="member in activeMembers" :key="member.id" :value="member.id">
                  {{ memberLabel(member) }}
                </option>
              </select>
            </label>
            <p>当前接口只返回团队成员数量，不返回成员明细；重复分配或移除不会创建重复关系。</p>
            <div class="org-team-member-actions">
              <button
                type="button"
                :disabled="busy || memberBusy"
                @click="performMemberAction('assign')"
              >
                分配成员
              </button>
              <button
                type="button"
                class="org-admin-secondary"
                :disabled="busy || memberBusy"
                @click="performMemberAction('remove')"
              >
                移除成员
              </button>
            </div>
            <small v-if="memberFeedback" role="status">{{ memberFeedback }}</small>
          </section>
          <section class="org-team-boundary-note">
            <h4>当前可治理边界</h4>
            <ul>
              <li>可创建团队，并在创建时设置负责人和默认工作流程键。</li>
              <li>可分配或移除当前组织的活动成员，操作原因进入审计。</li>
              <li>当前服务端没有负责人变更、流程变更或团队归档接口，本页不提供虚假入口。</li>
            </ul>
          </section>
          <div class="org-team-links">
            <RouterLink to="/org-admin/members">查看组织成员</RouterLink>
            <RouterLink to="/org-admin/workspaces">查看工作区边界</RouterLink>
          </div>
          <details class="org-admin-technical">
            <summary>技术详情</summary>
            <code>团队 ID：{{ selectedTeam.id }}</code>
            <code v-if="selectedTeam.lead_membership_id"
              >负责人成员关系 ID：{{ selectedTeam.lead_membership_id }}</code
            >
          </details>
        </template>
        <div v-else class="org-team-empty" role="status">
          <h4>选择一个团队查看治理详情</h4>
          <p>详情区会显示负责人、流程、成员关系和接口能力边界。</p>
        </div>
      </article>
    </section>
  </section>
</template>
