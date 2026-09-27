<script setup lang="ts">
import { computed } from "vue";
import { useModalDialog } from "../use-modal-dialog";

type AccountTab = "organizations" | "users" | "admins";
type UserForm = {
  email: string;
  temporary_password: string;
  platform_role_code: string;
  organization_id: string;
  organization_role_code: string;
};

const props = defineProps<{
  createUserOpen: boolean;
  createUserError: string;
  accountOverviewRoute: boolean;
  tab: AccountTab;
  userForm: UserForm;
  organizations: any[];
  passwordOpen: boolean;
  passwordError: string;
  passwordForm: { temporary_password: string };
  reasonOpen: boolean;
  reasonTitle: string;
  reasonText: string;
  busy: boolean;
}>();
const emit = defineEmits<{
  closeCreateUser: [];
  createUser: [];
  closePassword: [];
  resetPassword: [];
  closeReason: [];
  submitReason: [];
  "update:reasonText": [value: string];
}>();
const createUserTitle = computed(() =>
  props.accountOverviewRoute
    ? "新建用户或平台管理员"
    : props.tab === "admins"
      ? "新建平台管理员"
      : "新建用户",
);
const { dialogElement: createUserDialogElement, handleCancel: handleCreateUserCancel } =
    useModalDialog(
      () => props.createUserOpen,
      () => emit("closeCreateUser"),
    ),
  { dialogElement: passwordDialogElement, handleCancel: handlePasswordCancel } = useModalDialog(
    () => props.passwordOpen,
    () => emit("closePassword"),
  ),
  { dialogElement: reasonDialogElement, handleCancel: handleReasonCancel } = useModalDialog(
    () => props.reasonOpen,
    () => emit("closeReason"),
  );
</script>

<template>
  <dialog
    ref="createUserDialogElement"
    class="p43-account-dialog p43-create-user-dialog"
    :class="{ 'p44-admin-create-dialog': tab === 'admins' }"
    aria-label="新建用户或平台管理员"
    @cancel="handleCreateUserCancel"
  >
    <div class="p44-admin-create-layout" :class="{ 'is-admin-create': tab === 'admins' }">
      <aside v-if="tab === 'admins'" class="p44-admin-create-rail">
        <small>平台管理 / 新建账号</small>
        <h3>新建平台管理员</h3>
        <p>账号立即可用；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。</p>
      </aside>
      <form
        :class="{ 'p44-admin-create-form': tab === 'admins' }"
        @submit.prevent="emit('createUser')"
      >
        <header v-if="tab !== 'admins'" class="p43-account-dialog-head">
          <h3>{{ createUserTitle }}</h3>
          <p>账号立即可用；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。</p>
        </header>
        <section :class="{ 'p44-admin-create-group': tab === 'admins' }">
          <header v-if="tab === 'admins'" class="p44-admin-create-group-head">
            <h4>账号身份</h4>
            <p>填写登录邮箱与首次登录使用的临时密码。</p>
          </header>
          <p v-if="createUserError" class="dialog-feedback dialog-feedback--error" role="alert">
            {{ createUserError }}
          </p>
          <label
            >邮箱<input
              v-model="userForm.email"
              type="email"
              required
              maxlength="254"
              :aria-describedby="tab === 'admins' ? 'p44-create-email-help' : undefined"
          /></label>
          <small v-if="tab === 'admins'" id="p44-create-email-help" class="p44-admin-create-help"
            >邮箱为必填项，最多254个字符。</small
          >
          <label
            >临时密码<input
              v-model="userForm.temporary_password"
              type="password"
              required
              minlength="12"
              maxlength="128"
              autocomplete="new-password"
              :aria-describedby="tab === 'admins' ? 'p44-create-password-help' : undefined"
          /></label>
          <small v-if="tab === 'admins'" id="p44-create-password-help" class="p44-admin-create-help"
            >12–128个字符，首次登录后必须修改。</small
          >
        </section>
        <section :class="{ 'p44-admin-create-group': tab === 'admins' }">
          <header v-if="tab === 'admins'" class="p44-admin-create-group-head">
            <h4>权限与归属</h4>
            <p>平台角色与组织角色分别设置；可暂不加入组织。</p>
          </header>
          <label
            >平台角色<select
              v-model="userForm.platform_role_code"
              :aria-describedby="tab === 'admins' ? 'p44-platform-role-help' : undefined"
            >
              <option value="">普通用户</option>
              <option value="platform_operations_admin">运营管理员</option>
              <option value="platform_security_admin">安全管理员</option>
              <option value="platform_super_admin">超级管理员</option>
            </select></label
          >
          <small v-if="tab === 'admins'" id="p44-platform-role-help" class="p44-admin-create-help"
            >从管理员页打开时默认运营管理员；选择普通用户则不授予平台角色。</small
          >
          <label
            >加入组织<select v-model="userForm.organization_id">
              <option value="">暂不加入组织</option>
              <option
                v-for="item in organizations"
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
        </section>
        <footer>
          <button type="button" @click="emit('closeCreateUser')">取消</button>
          <button :disabled="busy">确认创建</button>
        </footer>
      </form>
    </div>
  </dialog>

  <dialog
    ref="passwordDialogElement"
    class="p43-account-dialog p43-password-dialog"
    aria-label="强制重置密码"
    @cancel="handlePasswordCancel"
  >
    <form @submit.prevent="emit('resetPassword')">
      <header class="p43-account-dialog-head">
        <h3>强制重置密码</h3>
        <p>保存后会撤销该用户全部活动会话，并要求首次登录修改密码。</p>
      </header>
      <p v-if="passwordError" class="dialog-feedback dialog-feedback--error" role="alert">
        {{ passwordError }}
      </p>
      <label
        >新临时密码<input
          v-model="passwordForm.temporary_password"
          type="password"
          required
          minlength="12"
          maxlength="128"
          autocomplete="new-password"
      /></label>
      <footer>
        <button type="button" @click="emit('closePassword')">取消</button>
        <button :disabled="busy">确认重置</button>
      </footer>
    </form>
  </dialog>

  <dialog
    ref="reasonDialogElement"
    class="p42-reason-dialog"
    :aria-label="reasonTitle"
    @cancel="handleReasonCancel"
  >
    <form @submit.prevent="emit('submitReason')">
      <header class="p42-reason-head">
        <h3>{{ reasonTitle }}</h3>
        <p>原因会写入平台审计记录。</p>
      </header>
      <label
        >操作原因<textarea
          :value="reasonText"
          required
          minlength="2"
          maxlength="300"
          @input="emit('update:reasonText', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <footer>
        <button type="button" @click="emit('closeReason')">取消</button>
        <button :disabled="busy">确认执行</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped src="./PlatformAccountDialogs.css"></style>
