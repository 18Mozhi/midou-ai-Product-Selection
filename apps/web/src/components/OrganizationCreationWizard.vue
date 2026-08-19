<script setup lang="ts">
import { ref, watch } from "vue";

interface OrganizationForm {
  name: string;
  slug: string;
  initial_admin_user_id: string;
}

const props = defineProps<{
  open: boolean;
  busy: boolean;
  users: Array<{ id: string; email: string; status: string }>;
  form: OrganizationForm;
}>();
const emit = defineEmits<{ close: []; submit: [] }>();
const step = ref<1 | 2>(1);
const formElement = ref<HTMLFormElement | null>(null);

watch(
  () => props.open,
  (open) => {
    if (open) step.value = 1;
  },
);

function continueToConfirmation() {
  if (!formElement.value?.reportValidity()) return;
  step.value = 2;
}

function close() {
  step.value = 1;
  emit("close");
}
</script>

<template>
  <dialog :open="open" class="organization-wizard">
    <form ref="formElement" @submit.prevent="$emit('submit')">
      <h3>新建组织</h3>
      <ol class="organization-wizard__progress" aria-label="创建组织步骤">
        <li :aria-current="step === 1 ? 'step' : undefined">
          <span>1</span>组织资料
        </li>
        <li :aria-current="step === 2 ? 'step' : undefined">
          <span>2</span>管理员与确认
        </li>
      </ol>
      <section v-if="step === 1" class="organization-wizard__step">
        <p>先填写团队名称和用于系统识别的英文标识。</p>
        <label>
          组织名称
          <input v-model="form.name" required minlength="2" maxlength="120" placeholder="例如：米豆选品团队" />
        </label>
        <label>
          组织标识
          <input v-model="form.slug" required pattern="[a-z0-9][a-z0-9-]{1,62}" placeholder="例如：midou-team" />
        </label>
      </section>
      <section v-else class="organization-wizard__step">
        <p>选择首位组织管理员，并在创建前核对影响范围。</p>
        <label>
          首位组织管理员
          <select v-model="form.initial_admin_user_id">
            <option value="">当前超级管理员</option>
            <option v-for="item in users" :key="item.id" :value="item.id" :disabled="item.status !== 'active'">
              {{ item.email }}
            </option>
          </select>
        </label>
        <dl class="organization-wizard__summary">
          <div><dt>组织</dt><dd>{{ form.name }}</dd></div>
          <div><dt>组织标识</dt><dd>{{ form.slug }}</dd></div>
          <div><dt>创建后</dt><dd>同时创建默认工作区和组织级数据范围</dd></div>
        </dl>
      </section>
      <footer>
        <button type="button" @click="close">取消</button>
        <button v-if="step === 2" type="button" @click="step = 1">上一步</button>
        <button v-if="step === 1" type="button" @click="continueToConfirmation">下一步：选择管理员</button>
        <button v-else :disabled="busy">确认创建</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
dialog {
  position:fixed;
  inset:0;
  z-index:10;
  width:min(560px,calc(100% - 28px));
  margin:auto;
  border:1px solid #31506b;
  border-radius:16px;
  color:#eef5ff;
  background:#10243a;
  box-shadow:0 24px 80px #0006;
}
form { display:grid; gap:14px; min-width:340px; padding:10px; }
label { display:grid; gap:6px; }
input,select { padding:10px; border:1px solid #31506b; border-radius:8px; color:#eef5ff; background:#0b1d2e; }
.organization-wizard__progress { margin:0; padding:0; display:grid; grid-template-columns:1fr 1fr; gap:8px; list-style:none; }
.organization-wizard__progress li {
  min-height:44px;
  padding:9px 11px;
  display:flex;
  align-items:center;
  gap:8px;
  border:1px solid #29465f;
  border-radius:10px;
  color:#9aadc1;
  background:#0b1d2e;
}
.organization-wizard__progress li[aria-current="step"] { border-color:#38d5b0; color:#eef5ff; }
.organization-wizard__progress span {
  width:24px;
  height:24px;
  display:grid;
  place-items:center;
  flex:0 0 auto;
  border-radius:50%;
  color:#08231d;
  background:#38d5b0;
  font-weight:800;
}
.organization-wizard__step { display:grid; gap:14px; }
.organization-wizard__step > p { margin:0; color:#9aadc1; }
.organization-wizard__summary { margin:0; padding:14px; display:grid; gap:10px; border:1px solid #29465f; border-radius:10px; background:#0b1d2e; }
.organization-wizard__summary div { display:grid; grid-template-columns:86px minmax(0,1fr); gap:10px; }
.organization-wizard__summary dt { color:#9aadc1; }
.organization-wizard__summary dd { margin:0; overflow-wrap:anywhere; }
footer { display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap; }
footer button { min-height:44px; }
@media(max-width:700px) {
  dialog { width:calc(100% - 28px); }
  form { min-width:0; }
}
</style>
