<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
type Tab = "organizations" | "users" | "admins";
type State = "loading" | "ready" | "empty" | "error";
interface Data {
  summary: {
    organizations: number;
    active_organizations: number;
    users: number;
    active_users: number;
    platform_admins: number;
  };
  organizations: any[];
  users: any[];
  admins: any[];
}
const props = withDefaults(
    defineProps<{ apiBaseUrl: string; initialTab?: Tab }>(),
    { initialTab: "organizations" },
  ),
  state = ref<State>("loading"),
  tab = ref<Tab>(props.initialTab),
  data = ref<Data | null>(null),
  query = ref(""),
  status = ref(""),
  message = ref(""),
  busy = ref(""),
  createUserOpen = ref(false),
  editOrganizationOpen = ref(false),
  detailOpen = ref(false),
  passwordOpen = ref(false),
  reasonOpen = ref(false),
  reasonTitle = ref("确认操作"),
  reasonText = ref("平台管理员人工操作"),
  pendingReasonAction = ref<null | ((value: string) => Promise<void>)>(null),
  selected = ref<any>(null),
  detail = ref<any>(null),
  createOpen = ref(
    new URLSearchParams(window.location.search).get("create") === "1",
  ),
  form = reactive({ name: "", slug: "", initial_admin_user_id: "" }),
  organizationForm = reactive({
    name: "",
    timezone: "Asia/Shanghai",
    data_retention_days: 365,
  }),
  userForm = reactive({
    email: "",
    temporary_password: "",
    platform_role_code: "",
    organization_id: "",
    organization_role_code: "member",
  }),
  passwordForm = reactive({ temporary_password: "" });
const rows = computed(() =>
    tab.value === "organizations"
      ? (data.value?.organizations ?? [])
      : tab.value === "users"
        ? (data.value?.users ?? [])
        : (data.value?.admins ?? []),
  ),
  statusText = (v: string) =>
    (
      ({
        active: "正常使用",
        archived: "已停用",
        disabled: "已停用",
        locked: "已锁定",
        pending_verification: "待验证",
        revoked: "已撤销",
        expired: "已过期",
      }) as Record<string, string>
    )[v] ?? v,
  roleText = (v: string) =>
    (
      ({
        platform_super_admin: "超级管理员",
        platform_operations_admin: "运营管理员",
        platform_security_admin: "安全管理员",
        organization_admin: "组织管理员",
        member: "普通成员",
        selection_manager: "选品经理",
        procurement_member: "采购成员",
        auditor: "审计员",
      }) as Record<string, string>
    )[v] ?? v;
async function load() {
  state.value = "loading";
  message.value = "";
  try {
    const p = new URLSearchParams();
    if (query.value) p.set("query", query.value);
    if (status.value) p.set("status", status.value);
    const r = await fetch(`${props.apiBaseUrl}/platform/accounts?${p}`, {
        credentials: "include",
      }),
      b = await r.json().catch(() => null);
    if (!r.ok) throw new Error(b?.error?.action_hint ?? "读取失败");
    data.value = b.data;
    state.value = "ready";
  } catch (e) {
    message.value = e instanceof Error ? e.message : "读取失败";
    state.value = "error";
  }
}
async function write(path: string, body: unknown, method = "POST") {
  busy.value = path;
  message.value = "";
  try {
    const r = await fetch(`${props.apiBaseUrl}${path}`, {
        method,
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      }),
      b = await r.json().catch(() => null);
    if (!r.ok) throw new Error(b?.error?.action_hint ?? "操作失败");
    await load();
    return true;
  } catch (e) {
    message.value = e instanceof Error ? e.message : "操作失败";
    return false;
  } finally {
    busy.value = "";
  }
}
async function createOrganization() {
  const body = {
    name: form.name,
    slug: form.slug,
    ...(form.initial_admin_user_id
      ? { initial_admin_user_id: form.initial_admin_user_id }
      : {}),
  };
  if (await write("/platform/accounts/organizations", body)) {
    form.name = "";
    form.slug = "";
    form.initial_admin_user_id = "";
    createOpen.value = false;
    message.value = "组织和默认工作区已创建。";
  }
}
function askReason(title: string, action: (value: string) => Promise<void>) {
  reasonTitle.value = title;
  reasonText.value = "平台管理员人工操作";
  pendingReasonAction.value = action;
  reasonOpen.value = true;
}
async function submitReason() {
  const value = reasonText.value.trim();
  if (value.length < 2 || !pendingReasonAction.value) return;
  const action = pendingReasonAction.value;
  reasonOpen.value = false;
  pendingReasonAction.value = null;
  await action(value);
}
async function toggleOrganization(item: any) {
  askReason(item.status === "active" ? "停用组织" : "恢复组织", async (why) => {
    await write(`/platform/accounts/organizations/${item.id}/status`, {
      status: item.status === "active" ? "archived" : "active",
      reason: why,
    });
  });
}
async function toggleUser(item: any) {
  askReason(
    item.status === "active" ? "停用用户并撤销会话" : "恢复用户",
    async (why) => {
      await write(`/platform/accounts/users/${item.id}/status`, {
        status: item.status === "active" ? "disabled" : "active",
        reason: why,
      });
    },
  );
}
async function role(userId: string, roleCode: string, enabled: boolean) {
  askReason(
    `${enabled ? "授予" : "撤销"}${roleText(roleCode)}`,
    async (why) => {
      await write(`/platform/accounts/users/${userId}/platform-role`, {
        role_code: roleCode,
        enabled,
        reason: why,
      });
    },
  );
}
function openOrganization(item: any) {
  selected.value = item;
  organizationForm.name = item.name;
  organizationForm.timezone = item.timezone || "Asia/Shanghai";
  organizationForm.data_retention_days = Number(
    item.data_retention_days || 365,
  );
  editOrganizationOpen.value = true;
}
async function updateOrganization() {
  if (!selected.value) return;
  askReason("保存组织资料", async (why) => {
    if (
      await write(
        `/platform/accounts/organizations/${selected.value.id}`,
        { ...organizationForm, reason: why },
        "PATCH",
      )
    ) {
      editOrganizationOpen.value = false;
      message.value = "组织资料已更新。";
    }
  });
}
function openCreateUser(asAdmin = false) {
  userForm.email = "";
  userForm.temporary_password = "";
  userForm.platform_role_code = asAdmin ? "platform_operations_admin" : "";
  userForm.organization_id = "";
  userForm.organization_role_code = "member";
  createUserOpen.value = true;
}
async function createUser() {
  if (
    await write("/platform/accounts/users", {
      ...userForm,
      organization_id: userForm.organization_id || null,
      platform_role_code: userForm.platform_role_code || null,
    })
  ) {
    createUserOpen.value = false;
    message.value =
      "账号已创建；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。";
  }
}
async function openUserDetail(item: any) {
  selected.value = item;
  detail.value = null;
  detailOpen.value = true;
  try {
    const r = await fetch(
        `${props.apiBaseUrl}/platform/accounts/users/${item.id}`,
        { credentials: "include" },
      ),
      b = await r.json().catch(() => null);
    if (!r.ok) throw new Error(b?.error?.action_hint ?? "读取详情失败");
    detail.value = b.data;
  } catch (e) {
    message.value = e instanceof Error ? e.message : "读取详情失败";
    detailOpen.value = false;
  }
}
function openPassword(item: any) {
  selected.value = item;
  passwordForm.temporary_password = "";
  passwordOpen.value = true;
}
async function resetPassword() {
  if (!selected.value) return;
  askReason("强制重置密码并撤销全部会话", async (why) => {
    if (
      await write(`/platform/accounts/users/${selected.value.id}/password`, {
        temporary_password: passwordForm.temporary_password,
        reason: why,
      })
    ) {
      passwordOpen.value = false;
      detailOpen.value = false;
      message.value = "临时密码已更新，全部活动会话已撤销。";
    }
  });
}
function revokeSessions(item: any, sessionId: string | null = null) {
  askReason(sessionId ? "撤销该会话" : "撤销全部活动会话", async (why) => {
    if (
      await write(`/platform/accounts/users/${item.id}/sessions/revoke`, {
        session_id: sessionId,
        reason: why,
      })
    ) {
      message.value = "会话已撤销。";
      if (detailOpen.value) await openUserDetail(item);
    }
  });
}
onMounted(load);
</script>
<template>
  <section class="account-center">
    <header class="account-hero">
      <div>
        <p>组织与用户</p>
        <h2>谁在使用智能选品，一眼看懂</h2>
        <span
          >创建组织、启停账号、分配平台管理员。所有操作都会留审计记录。</span
        >
      </div>
      <div class="hero-actions">
        <button @click="createOpen = true">＋ 新建组织</button
        ><button @click="openCreateUser(tab === 'admins')">
          ＋ {{ tab === "admins" ? "新建管理员" : "新建用户" }}
        </button>
      </div>
    </header>
    <div v-if="data" class="account-metrics">
      <article>
        <small>组织</small
        ><strong
          >{{ data.summary.active_organizations }} /
          {{ data.summary.organizations }}</strong
        ><span>正常 / 全部</span>
      </article>
      <article>
        <small>用户</small
        ><strong
          >{{ data.summary.active_users }} / {{ data.summary.users }}</strong
        ><span>可登录 / 全部</span>
      </article>
      <article>
        <small>平台管理员</small
        ><strong>{{ data.summary.platform_admins }}</strong
        ><span>拥有平台后台权限</span>
      </article>
    </div>
    <nav class="account-tabs">
      <button
        :class="{ on: tab === 'organizations' }"
        @click="tab = 'organizations'"
      >
        组织管理</button
      ><button :class="{ on: tab === 'users' }" @click="tab = 'users'">
        用户管理</button
      ><button :class="{ on: tab === 'admins' }" @click="tab = 'admins'">
        管理员管理
      </button>
    </nav>
    <form class="account-filter" @submit.prevent="load">
      <input v-model="query" placeholder="搜索组织名称或用户邮箱" /><select
        v-model="status"
      >
        <option value="">全部状态</option>
        <option value="active">正常使用</option>
        <option value="disabled">已停用</option>
        <option value="archived">已停用组织</option></select
      ><button>搜索</button>
    </form>
    <p v-if="message" class="account-message">{{ message }}</p>
    <section v-if="state === 'loading'" class="account-state">
      正在读取真实组织与用户…
    </section>
    <section v-else-if="state === 'error'" class="account-state">
      暂时无法读取。<button @click="load">重新加载</button>
    </section>
    <div v-else class="account-table-wrap">
      <table v-if="tab === 'organizations'">
        <thead>
          <tr>
            <th>组织</th>
            <th>成员</th>
            <th>工作区</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.id">
            <td data-label="组织">
              <strong>{{ item.name }}</strong
              ><small>{{ item.slug }}</small>
            </td>
            <td data-label="成员">{{ item.member_count }} 人</td>
            <td data-label="工作区">{{ item.workspace_count }} 个</td>
            <td data-label="状态">
              <b :data-status="item.status">{{ statusText(item.status) }}</b>
            </td>
            <td data-label="操作">
              <button :disabled="Boolean(busy)" @click="openOrganization(item)">
                编辑
              </button>
              <button
                :disabled="Boolean(busy)"
                @click="toggleOrganization(item)"
              >
                {{ item.status === "active" ? "停用" : "恢复" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <table v-else-if="tab === 'users'">
        <thead>
          <tr>
            <th>用户</th>
            <th>所在组织</th>
            <th>平台角色</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.id">
            <td data-label="用户">
              <strong>{{ item.email }}</strong
              ><small
                >注册于
                {{ new Date(item.created_at).toLocaleDateString() }}</small
              >
            </td>
            <td data-label="所在组织">
              {{ item.organization_names || "尚未加入组织" }}
            </td>
            <td data-label="平台角色">
              {{ item.platform_roles.map(roleText).join("、") || "普通用户" }}
            </td>
            <td data-label="状态">
              <b :data-status="item.status">{{ statusText(item.status) }}</b>
            </td>
            <td data-label="操作">
              <button :disabled="Boolean(busy)" @click="openUserDetail(item)">
                详情
              </button>
              <button :disabled="Boolean(busy)" @click="openPassword(item)">
                强制改密
              </button>
              <button
                :disabled="Boolean(busy) || !item.active_session_count"
                @click="revokeSessions(item)"
              >
                撤销会话（{{ item.active_session_count || 0 }}）
              </button>
              <button :disabled="Boolean(busy)" @click="toggleUser(item)">
                {{ item.status === "active" ? "停用登录" : "恢复登录" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <table v-else>
        <thead>
          <tr>
            <th>可授权用户</th>
            <th>当前平台角色</th>
            <th>角色管理</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.id">
            <td data-label="用户">
              <strong>{{ item.email }}</strong
              ><small>{{ statusText(item.status) }}</small>
            </td>
            <td data-label="当前角色">
              {{ item.roles.map(roleText).join("、") || "尚未授予平台角色" }}
            </td>
            <td data-label="角色管理">
              <button :disabled="Boolean(busy)" @click="openUserDetail(item)">
                账号详情
              </button>
              <button
                v-for="code in [
                  'platform_operations_admin',
                  'platform_security_admin',
                  'platform_super_admin',
                ]"
                :key="code"
                :disabled="item.status !== 'active' || Boolean(busy)"
                @click="role(item.id, code, !item.roles.includes(code))"
              >
                {{ item.roles.includes(code) ? "撤销" : "授予"
                }}{{ roleText(code) }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="account-state">没有符合条件的记录。</p>
    </div>
    <dialog :open="createOpen">
      <form @submit.prevent="createOrganization">
        <h3>新建组织</h3>
        <p>系统会同时创建“默认工作区”，你无需再配置技术参数。</p>
        <label
          >组织名称<input
            v-model="form.name"
            required
            minlength="2"
            maxlength="120"
            placeholder="例如：米豆选品团队" /></label
        ><label
          >组织标识<input
            v-model="form.slug"
            required
            pattern="[a-z0-9][a-z0-9-]{1,62}"
            placeholder="例如：midou-team"
        /></label>
        <label
          >首位组织管理员<select v-model="form.initial_admin_user_id">
            <option value="">当前超级管理员</option>
            <option
              v-for="item in data?.users || []"
              :key="item.id"
              :value="item.id"
              :disabled="item.status !== 'active'"
            >
              {{ item.email }}
            </option>
          </select></label
        >
        <footer>
          <button type="button" @click="createOpen = false">取消</button
          ><button :disabled="Boolean(busy)">确认创建</button>
        </footer>
      </form>
    </dialog>
    <dialog :open="createUserOpen">
      <form @submit.prevent="createUser">
        <h3>新建用户或平台管理员</h3>
        <p>
          账号立即可用；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。
        </p>
        <label
          >邮箱<input
            v-model="userForm.email"
            type="email"
            required
            maxlength="254"
        /></label>
        <label
          >临时密码<input
            v-model="userForm.temporary_password"
            type="password"
            required
            minlength="12"
            autocomplete="new-password"
        /></label>
        <label
          >平台角色<select v-model="userForm.platform_role_code">
            <option value="">普通用户</option>
            <option value="platform_operations_admin">运营管理员</option>
            <option value="platform_security_admin">安全管理员</option>
            <option value="platform_super_admin">超级管理员</option>
          </select></label
        >
        <label
          >加入组织<select v-model="userForm.organization_id">
            <option value="">暂不加入组织</option>
            <option
              v-for="item in data?.organizations || []"
              :key="item.id"
              :value="item.id"
              :disabled="item.status !== 'active'"
            >
              {{ item.name }}
            </option>
          </select></label
        >
        <label v-if="userForm.organization_id"
          >组织角色<select v-model="userForm.organization_role_code">
            <option value="member">普通成员</option>
            <option value="organization_admin">组织管理员</option>
          </select></label
        >
        <footer>
          <button type="button" @click="createUserOpen = false">取消</button
          ><button :disabled="Boolean(busy)">确认创建</button>
        </footer>
      </form>
    </dialog>
    <dialog :open="editOrganizationOpen">
      <form @submit.prevent="updateOrganization">
        <h3>编辑组织资料</h3>
        <label
          >组织名称<input
            v-model="organizationForm.name"
            required
            minlength="2"
            maxlength="120"
        /></label>
        <label
          >时区<input
            v-model="organizationForm.timezone"
            required
            maxlength="64"
        /></label>
        <label
          >数据保留天数<input
            v-model.number="organizationForm.data_retention_days"
            type="number"
            min="30"
            max="3650"
            required
        /></label>
        <footer>
          <button type="button" @click="editOrganizationOpen = false">
            取消</button
          ><button :disabled="Boolean(busy)">保存</button>
        </footer>
      </form>
    </dialog>
    <dialog :open="detailOpen" class="detail-dialog">
      <section v-if="detail">
        <header>
          <div>
            <small>账号详情</small>
            <h3>{{ detail.user.email }}</h3>
          </div>
          <button
            aria-label="关闭账号详情"
            title="关闭账号详情"
            @click="detailOpen = false"
          >
            ×
          </button>
        </header>
        <div class="detail-grid">
          <article>
            <small>账号状态</small
            ><strong>{{ statusText(detail.user.status) }}</strong>
          </article>
          <article>
            <small>首次安全设置</small
            ><strong>{{
              detail.user.must_change_password || detail.user.must_enroll_mfa
                ? "待完成"
                : "已完成"
            }}</strong>
          </article>
          <article>
            <small>组织关系</small
            ><strong>{{ detail.memberships.length }}</strong>
          </article>
          <article>
            <small>活动会话</small
            ><strong>{{
              detail.sessions.filter((x: any) => x.status === "active").length
            }}</strong>
          </article>
        </div>
        <h4>组织与角色</h4>
        <p v-if="!detail.memberships.length">尚未加入组织。</p>
        <ul>
          <li v-for="item in detail.memberships" :key="item.id">
            <span>{{ item.organization_name }}</span
            ><b>{{ item.roles.map(roleText).join("、") }}</b
            ><small>{{ statusText(item.status) }}</small>
          </li>
        </ul>
        <h4>登录会话</h4>
        <p v-if="!detail.sessions.length">暂无会话。</p>
        <ul>
          <li v-for="session in detail.sessions" :key="session.id">
            <span>{{ session.device_label }}</span
            ><b>{{ statusText(session.status) }}</b
            ><small>{{ new Date(session.last_seen_at).toLocaleString() }}</small
            ><button
              v-if="session.status === 'active'"
              @click="revokeSessions(selected, session.id)"
            >
              撤销
            </button>
          </li>
        </ul>
        <footer>
          <button @click="openPassword(selected)">强制改密</button
          ><button @click="revokeSessions(selected)">撤销全部会话</button
          ><button @click="detailOpen = false">关闭</button>
        </footer>
      </section>
      <section v-else class="account-state">正在读取账号详情…</section>
    </dialog>
    <dialog :open="passwordOpen">
      <form @submit.prevent="resetPassword">
        <h3>强制重置密码</h3>
        <p>保存后会撤销该用户全部活动会话，并要求首次登录修改密码。</p>
        <label
          >新临时密码<input
            v-model="passwordForm.temporary_password"
            type="password"
            required
            minlength="12"
            autocomplete="new-password"
        /></label>
        <footer>
          <button type="button" @click="passwordOpen = false">取消</button
          ><button :disabled="Boolean(busy)">确认重置</button>
        </footer>
      </form>
    </dialog>
    <dialog :open="reasonOpen">
      <form @submit.prevent="submitReason">
        <h3>{{ reasonTitle }}</h3>
        <p>原因会写入平台审计记录。</p>
        <label
          >操作原因<textarea
            v-model="reasonText"
            required
            minlength="2"
            maxlength="300"
          ></textarea>
        </label>
        <footer>
          <button type="button" @click="reasonOpen = false">取消</button
          ><button :disabled="Boolean(busy)">确认执行</button>
        </footer>
      </form>
    </dialog>
  </section>
</template>
<style scoped>
.account-center {
  display: grid;
  gap: 18px;
  color: #eef5ff;
}
.account-hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  padding: 24px;
  border-radius: 18px;
  background: linear-gradient(135deg, #10233e, #173f5f);
  color: white;
}
.account-hero p {
  margin: 0;
  color: #79e5d1;
  font-weight: 800;
}
.account-hero h2 {
  margin: 6px 0;
  font-size: 28px;
}
.account-hero span {
  opacity: 0.78;
}
.account-hero button,
.account-filter button {
  border: 0;
  border-radius: 10px;
  padding: 11px 16px;
  background: #38d5b0;
  color: #08231d;
  font-weight: 800;
}
.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.hero-actions button:last-child {
  background: #162f48;
  color: #dffbf4;
  border: 1px solid #3b6a76;
}
.account-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.account-metrics article {
  padding: 18px;
  border: 1px solid #263f58;
  border-radius: 14px;
  background: #12263a;
  color: #eef5ff;
}
.account-metrics small,
.account-metrics span {
  display: block;
  color: #9eb0c4;
}
.account-metrics strong {
  display: block;
  font-size: 28px;
  margin: 5px 0;
  color: #eef5ff;
}
.account-tabs {
  display: flex;
  gap: 8px;
}
.account-tabs button {
  border: 1px solid #31506b;
  border-radius: 999px;
  padding: 9px 15px;
  background: #12263a;
  color: #dce9f7;
}
.account-tabs .on {
  background: #236879;
  color: white;
}
.account-filter {
  display: flex;
  gap: 10px;
}
.account-filter input,
.account-filter select {
  min-width: 180px;
  padding: 10px;
  border: 1px solid #31506b;
  border-radius: 9px;
  color: #eef5ff;
  background: #0d2033;
}
.account-table-wrap {
  overflow: auto;
  background: #10243a;
  border: 1px solid #263f58;
  border-radius: 14px;
  color: #eef5ff;
}
table {
  width: 100%;
  border-collapse: collapse;
  color: #eef5ff;
}
th,
td {
  padding: 14px;
  text-align: left;
  border-bottom: 1px solid #243c54;
}
th {
  color: #9db1c6;
}
td strong,
td small {
  display: block;
}
td strong {
  color: #eef5ff;
}
td small {
  color: #9aadc1;
  margin-top: 4px;
}
td button {
  margin: 2px;
  border: 1px solid #365a72;
  background: #173650;
  color: #dff7ff;
  border-radius: 8px;
  padding: 7px 10px;
}
td b[data-status="active"] {
  color: #087f5b;
}
td b[data-status="disabled"],
td b[data-status="archived"] {
  color: #b42318;
}
.account-state,
.account-message {
  padding: 18px;
  text-align: center;
}
.account-message {
  background: #493c12;
  color: #ffefac;
  border-radius: 10px;
}
dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  border: 0;
  border-radius: 16px;
  background: #10243a;
  color: #eef5ff;
  border: 1px solid #31506b;
  box-shadow: 0 24px 80px #0006;
  z-index: 10;
}
dialog form {
  display: grid;
  gap: 14px;
  min-width: 340px;
  padding: 10px;
}
dialog label {
  display: grid;
  gap: 6px;
}
dialog input,
dialog select,
dialog textarea {
  padding: 10px;
  color: #eef5ff;
  background: #0b1d2e;
  border: 1px solid #31506b;
  border-radius: 8px;
}
dialog textarea {
  min-height: 90px;
  resize: vertical;
}
dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.detail-dialog {
  width: min(760px, calc(100% - 28px));
  max-height: 84vh;
  overflow: auto;
}
.detail-dialog > section > header {
  display: flex;
  justify-content: space-between;
  align-items: start;
}
.detail-dialog > section > header button {
  border: 0;
  background: transparent;
  color: #eef5ff;
  font-size: 26px;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 16px 0;
}
.detail-grid article {
  padding: 12px;
  border: 1px solid #29465f;
  border-radius: 10px;
  background: #0b1d2e;
}
.detail-grid small,
.detail-grid strong {
  display: block;
}
.detail-dialog ul {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 8px;
}
.detail-dialog li {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid #29465f;
  border-radius: 9px;
}
.detail-dialog li small {
  color: #9aadc1;
}
@media (max-width: 700px) {
  .account-center {
    padding-bottom: 76px;
  }
  .account-hero {
    align-items: flex-start;
    flex-direction: column;
  }
  .account-metrics {
    grid-template-columns: 1fr;
  }
  .account-filter {
    flex-direction: column;
  }
  .account-tabs {
    overflow: auto;
  }
  .account-table-wrap {
    overflow: visible;
    background: transparent;
    border: 0;
  }
  table,
  tbody,
  tr,
  td {
    display: block;
    width: 100%;
  }
  thead {
    display: none;
  }
  tr {
    margin-bottom: 12px;
    padding: 9px 14px;
    border: 1px solid #dfe8ef;
    border-radius: 14px;
    background: #10243a;
  }
  td {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid #243c54;
    overflow-wrap: anywhere;
  }
  td:last-child {
    border-bottom: 0;
  }
  td:before {
    content: attr(data-label);
    color: #9aadc1;
    font-size: 12px;
    font-weight: 700;
  }
  td button {
    width: 100%;
    margin: 3px 0;
  }
  dialog {
    width: calc(100% - 28px);
  }
  dialog form {
    min-width: 0;
  }
  .detail-grid {
    grid-template-columns: 1fr 1fr;
  }
  .detail-dialog li {
    grid-template-columns: 1fr;
  }
}
</style>
