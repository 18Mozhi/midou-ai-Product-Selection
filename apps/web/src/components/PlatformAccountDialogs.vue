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
    aria-label="新建用户或平台管理员"
    @cancel="handleCreateUserCancel"
  >
    <form @submit.prevent="emit('createUser')">
      <h3>{{ createUserTitle }}</h3>
      <p>账号立即可用；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。</p>
      <p v-if="createUserError" class="dialog-feedback dialog-feedback--error" role="alert">
        {{ createUserError }}
      </p>
      <label>邮箱<input v-model="userForm.email" type="email" required maxlength="254" /></label>
      <label
        >临时密码<input
          v-model="userForm.temporary_password"
          type="password"
          required
          minlength="12"
          maxlength="128"
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
      <footer>
        <button type="button" @click="emit('closeCreateUser')">取消</button>
        <button :disabled="busy">确认创建</button>
      </footer>
    </form>
  </dialog>

  <dialog ref="passwordDialogElement" aria-label="强制重置密码" @cancel="handlePasswordCancel">
    <form @submit.prevent="emit('resetPassword')">
      <h3>强制重置密码</h3>
      <p>保存后会撤销该用户全部活动会话，并要求首次登录修改密码。</p>
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

  <dialog ref="reasonDialogElement" :aria-label="reasonTitle" @cancel="handleReasonCancel">
    <form @submit.prevent="emit('submitReason')">
      <h3>{{ reasonTitle }}</h3>
      <p>原因会写入平台审计记录。</p>
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
