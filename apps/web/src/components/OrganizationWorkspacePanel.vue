<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{
    workspaces: any[];
    defaultWorkspaceId?: string | null;
    busy: boolean;
    createWorkspace: (value: { name: string; slug: string; reason: string }) => Promise<boolean>;
    performWorkspaceAction: (workspace: any) => Promise<boolean>;
  }>(),
  query = ref(""),
  statusFilter = ref<"all" | "active" | "archived">("all"),
  sort = ref<"name_asc" | "members_desc" | "updated_desc">("name_asc"),
  page = ref(1),
  pageSize = 8,
  selectedWorkspaceId = ref(""),
  createOpen = ref(false),
  createBusy = ref(false),
  form = ref({ name: "", slug: "", reason: "" });

const activeCount = computed(
    () => props.workspaces.filter((workspace) => workspace.status === "active").length,
  ),
  archivedCount = computed(
    () => props.workspaces.filter((workspace) => workspace.status === "archived").length,
  ),
  assignedMemberCount = computed(() =>
    props.workspaces.reduce((total, workspace) => total + Number(workspace.member_count ?? 0), 0),
  ),
  defaultWorkspace = computed(() =>
    props.workspaces.find((workspace) => workspace.id === props.defaultWorkspaceId),
  ),
  filteredWorkspaces = computed(() => {
    const keyword = query.value.trim().toLowerCase(),
      items = props.workspaces.filter(
        (workspace) =>
          (statusFilter.value === "all" || workspace.status === statusFilter.value) &&
          (!keyword ||
            String(workspace.name).toLowerCase().includes(keyword) ||
            String(workspace.slug).toLowerCase().includes(keyword)),
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
  pageCount = computed(() => Math.max(1, Math.ceil(filteredWorkspaces.value.length / pageSize))),
  pageItems = computed(() =>
    filteredWorkspaces.value.slice((page.value - 1) * pageSize, page.value * pageSize),
  ),
  selectedWorkspace = computed(() =>
    props.workspaces.find((workspace) => workspace.id === selectedWorkspaceId.value),
  ),
  selectedIsDefault = computed(() => selectedWorkspace.value?.id === props.defaultWorkspaceId),
  slugPreview = computed(() => form.value.slug.trim() || "workspace-key");

watch(
  () => props.workspaces,
  (workspaces) => {
    if (!workspaces.some((workspace) => workspace.id === selectedWorkspaceId.value))
      selectedWorkspaceId.value =
        workspaces.find((workspace) => workspace.id === props.defaultWorkspaceId)?.id ??
        workspaces[0]?.id ??
        "";
    if (!workspaces.length) createOpen.value = true;
  },
  { immediate: true, deep: true },
);
watch([query, statusFilter, sort], () => {
  page.value = 1;
});
watch(pageCount, (count) => {
  if (page.value > count) page.value = count;
});

function resetFilters() {
  query.value = "";
  statusFilter.value = "all";
  sort.value = "name_asc";
}
function openCreate() {
  createOpen.value = true;
  window.requestAnimationFrame(() =>
    document.querySelector<HTMLInputElement>("#workspace-name")?.focus(),
  );
}
function cancelCreate() {
  if (createBusy.value) return;
  form.value = { name: "", slug: "", reason: "" };
  createOpen.value = false;
}
async function submitCreate() {
  if (createBusy.value || props.busy) return;
  createBusy.value = true;
  try {
    const created = await props.createWorkspace({
      name: form.value.name.trim(),
      slug: form.value.slug.trim(),
      reason: form.value.reason.trim(),
    });
    if (created) {
      form.value = { name: "", slug: "", reason: "" };
      createOpen.value = false;
    }
  } finally {
    createBusy.value = false;
  }
}
async function performAction() {
  if (!selectedWorkspace.value || props.busy) return;
  await props.performWorkspaceAction(selectedWorkspace.value);
}
const statusText = (status: string) => (status === "active" ? "正常使用" : "已归档"),
  fmt = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "暂无记录";
</script>

<template>
  <section class="org-workspace-panel" aria-label="工作区治理台">
    <header class="org-workspace-overview">
      <div>
        <p>工作区治理</p>
        <h3>工作区治理台</h3>
        <span>维护当前组织的数据边界；归档只停止继续使用，不删除历史业务事实。</span>
      </div>
      <button type="button" :disabled="busy" @click="openCreate">新建工作区</button>
    </header>

    <div class="org-workspace-metrics" aria-label="工作区统计">
      <article>
        <span>全部工作区</span><b>{{ workspaces.length }}</b
        ><small>当前组织范围</small>
      </article>
      <article>
        <span>正常使用</span><b>{{ activeCount }}</b
        ><small>可继续承载业务</small>
      </article>
      <article>
        <span>已归档</span><b>{{ archivedCount }}</b
        ><small>历史数据仍保留</small>
      </article>
      <article>
        <span>工作区范围分配数</span><b>{{ assignedMemberCount }}</b
        ><small>各工作区明确范围人数合计</small>
      </article>
      <article class="org-workspace-default-metric">
        <span>组织默认工作区</span><b>{{ defaultWorkspace?.name ?? "尚未设置" }}</b
        ><small>修改入口位于组织资料</small>
      </article>
    </div>

    <form v-if="createOpen" class="org-workspace-create" @submit.prevent="submitCreate">
      <header>
        <div>
          <p>创建边界</p>
          <h3>新建工作区</h3>
          <span>创建后立即进入正常使用状态；成员与团队关系在团队管理中配置。</span>
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
      <div class="org-workspace-create-grid">
        <label for="workspace-name">
          工作区名称
          <input
            id="workspace-name"
            v-model="form.name"
            maxlength="120"
            autocomplete="off"
            placeholder="例如：北美新品决策"
            required
          />
          <small>{{ form.name.length }}/120 · 使用业务名称，便于成员识别</small>
        </label>
        <label for="workspace-slug">
          英文标识
          <input
            id="workspace-slug"
            v-model="form.slug"
            maxlength="63"
            pattern="^[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?$"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            placeholder="north-america-launch"
            required
          />
          <small id="workspace-slug-help">1–63 位小写字母、数字或连字符 · {{ slugPreview }}</small>
        </label>
        <label class="org-workspace-reason" for="workspace-reason">
          创建原因
          <textarea
            id="workspace-reason"
            v-model="form.reason"
            maxlength="500"
            placeholder="说明业务范围、使用团队和创建目的"
            required
          ></textarea>
          <small>{{ form.reason.length }}/500 · 原因将写入审计记录</small>
        </label>
      </div>
      <footer>
        <span>创建操作带幂等键，并同步写入组织审计与事件。</span>
        <button type="submit" :disabled="busy || createBusy">
          {{ createBusy ? "正在创建…" : "创建并写入审计" }}
        </button>
      </footer>
    </form>

    <section class="org-workspace-browser">
      <article class="org-admin-card org-workspace-directory">
        <header class="org-workspace-section-heading">
          <div>
            <p>工作区目录</p>
            <h3>找到并选择工作区</h3>
          </div>
          <span>{{ filteredWorkspaces.length }} / {{ workspaces.length }}</span>
        </header>
        <div class="org-workspace-status-tabs" role="group" aria-label="工作区状态">
          <button
            type="button"
            :aria-pressed="statusFilter === 'all'"
            @click="statusFilter = 'all'"
          >
            全部 {{ workspaces.length }}
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
        <div class="org-workspace-toolbar">
          <label>
            搜索工作区
            <input v-model="query" type="search" placeholder="名称或英文标识" />
          </label>
          <label>
            排序
            <select v-model="sort">
              <option value="name_asc">名称 A–Z</option>
              <option value="members_desc">明确范围成员最多</option>
              <option value="updated_desc">最近更新</option>
            </select>
          </label>
          <button type="button" class="org-admin-secondary" @click="resetFilters">重置筛选</button>
        </div>

        <div v-if="pageItems.length" class="org-workspace-list" role="list">
          <button
            v-for="workspace in pageItems"
            :key="workspace.id"
            type="button"
            role="listitem"
            :class="{ 'is-selected': workspace.id === selectedWorkspaceId }"
            :aria-label="`选择工作区 ${workspace.name}`"
            :aria-current="workspace.id === selectedWorkspaceId ? 'true' : undefined"
            @click="selectedWorkspaceId = workspace.id"
          >
            <span class="org-workspace-mark">{{ workspace.name.slice(0, 1) }}</span>
            <span>
              <b>{{ workspace.name }}</b>
              <small
                >{{ workspace.member_count }} 名明确范围成员 · 第 {{ workspace.version }} 版</small
              >
            </span>
            <em v-if="workspace.id === defaultWorkspaceId">默认</em>
            <i :data-status="workspace.status">{{ statusText(workspace.status) }}</i>
          </button>
        </div>
        <div v-else class="org-workspace-empty" role="status">
          <span aria-hidden="true">⌁</span>
          <h4>{{ workspaces.length ? "没有符合条件的工作区" : "当前组织还没有工作区" }}</h4>
          <p>
            {{
              workspaces.length
                ? "调整关键词或状态条件，不会影响已保存的数据。"
                : "创建首个工作区后，业务数据才能获得明确边界。"
            }}
          </p>
          <button
            v-if="workspaces.length"
            type="button"
            class="org-admin-secondary"
            @click="resetFilters"
          >
            清除筛选
          </button>
          <button v-else type="button" @click="openCreate">创建工作区</button>
        </div>
        <nav
          v-if="filteredWorkspaces.length > pageSize"
          class="org-admin-pagination"
          aria-label="工作区分页"
        >
          <button
            type="button"
            class="org-admin-secondary"
            :disabled="page <= 1"
            @click="page -= 1"
          >
            上一页
          </button>
          <span>第 {{ page }} / {{ pageCount }} 页 · 共 {{ filteredWorkspaces.length }} 条</span>
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

      <article class="org-admin-card org-workspace-detail" aria-live="polite">
        <template v-if="selectedWorkspace">
          <header>
            <div>
              <p>当前选择</p>
              <h3>{{ selectedWorkspace.name }}</h3>
            </div>
            <i :data-status="selectedWorkspace.status">{{
              statusText(selectedWorkspace.status)
            }}</i>
          </header>
          <div v-if="selectedIsDefault" class="org-workspace-default-note">
            <b>组织默认工作区</b>
            <span>必须先在组织资料中更换默认项，才能归档此工作区。</span>
          </div>
          <dl>
            <div>
              <dt>明确范围成员</dt>
              <dd>{{ selectedWorkspace.member_count }} 人</dd>
            </div>
            <div>
              <dt>当前版本</dt>
              <dd>第 {{ selectedWorkspace.version }} 版</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{{ fmt(selectedWorkspace.created_at) }}</dd>
            </div>
            <div>
              <dt>最近更新</dt>
              <dd>{{ fmt(selectedWorkspace.updated_at) }}</dd>
            </div>
          </dl>
          <section class="org-workspace-impact">
            <h4>
              {{ selectedWorkspace.status === "active" ? "归档会发生什么" : "恢复会发生什么" }}
            </h4>
            <ul v-if="selectedWorkspace.status === 'active'">
              <li>停止把该工作区作为新的业务上下文。</li>
              <li>历史任务、证据、审计和导出记录不会删除。</li>
              <li>操作需要填写原因，并使用当前版本完成并发校验。</li>
            </ul>
            <ul v-else>
              <li>重新允许成员在授权范围内选择该工作区。</li>
              <li>不会自动恢复已移除的成员或团队关系。</li>
              <li>恢复原因和新版本将进入组织审计。</li>
            </ul>
          </section>
          <div class="org-workspace-actions">
            <button
              type="button"
              :class="{ 'org-admin-secondary': selectedWorkspace.status !== 'active' }"
              :disabled="busy || (selectedWorkspace.status === 'active' && selectedIsDefault)"
              @click="performAction"
            >
              {{
                selectedWorkspace.status === "active"
                  ? selectedIsDefault
                    ? "默认工作区不可归档"
                    : "归档工作区"
                  : "恢复工作区"
              }}
            </button>
            <RouterLink to="/org-admin/teams">管理团队与成员</RouterLink>
            <RouterLink to="/org-admin">修改默认工作区</RouterLink>
          </div>
          <details class="org-admin-technical">
            <summary>技术详情</summary>
            <code>工作区 ID：{{ selectedWorkspace.id }}</code>
            <code>英文标识：{{ selectedWorkspace.slug }}</code>
          </details>
        </template>
        <div v-else class="org-workspace-empty" role="status">
          <h4>选择一个工作区查看治理详情</h4>
          <p>详情区会显示版本、成员范围以及归档或恢复影响。</p>
        </div>
      </article>
    </section>
  </section>
</template>
