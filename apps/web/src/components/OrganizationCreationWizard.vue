<script setup lang="ts">
import { ref, watch } from "vue";
import { useModalDialog } from "../use-modal-dialog";

interface OrganizationForm {
  name: string;
  slug: string;
  initial_admin_user_id: string;
}

const props = defineProps<{
  open: boolean;
  busy: boolean;
  errorMessage: string;
  users: Array<{ id: string; email: string; status: string }>;
  form: OrganizationForm;
}>();
const emit = defineEmits<{ close: []; submit: []; clearError: [] }>();
const step = ref<1 | 2>(1);
const formElement = ref<HTMLFormElement | null>(null);
const { dialogElement, handleCancel } = useModalDialog(
  () => props.open,
  () => emit("close"),
);

watch(
  () => props.open,
  (open) => {
    if (open) step.value = 1;
  },
);

function continueToConfirmation() {
  if (!formElement.value?.reportValidity()) return;
  emit("clearError");
  step.value = 2;
}

function close() {
  step.value = 1;
  emit("close");
}
</script>

<template>
  <dialog
    ref="dialogElement"
    class="organization-wizard"
    aria-label="新建组织"
    @cancel="handleCancel"
  >
    <form ref="formElement" @submit.prevent="$emit('submit')">
      <div class="organization-wizard__layout">
        <aside class="organization-wizard__identity">
          <small>组织创建</small>
          <h3>新建组织</h3>
          <p>建立组织及默认工作区。</p>
          <ol class="organization-wizard__progress" aria-label="创建组织步骤">
            <li :aria-current="step === 1 ? 'step' : undefined"><span>1</span>组织资料</li>
            <li :aria-current="step === 2 ? 'step' : undefined"><span>2</span>管理员与确认</li>
          </ol>
        </aside>
        <section class="organization-wizard__content">
          <section v-if="step === 1" class="organization-wizard__step">
            <p>先填写团队名称和用于系统识别的英文标识。</p>
            <label>
              组织名称
              <input
                v-model="form.name"
                required
                minlength="2"
                maxlength="120"
                placeholder="例如：智能选品团队"
                aria-label="组织名称"
                aria-describedby="p41-name-help"
                @input="emit('clearError')"
              />
              <small id="p41-name-help">2–120 个字符，用于显示组织名称。</small>
            </label>
            <label>
              组织标识
              <input
                v-model="form.slug"
                required
                pattern="[a-z0-9](?:[a-z0-9]|-){1,62}"
                minlength="2"
                maxlength="63"
                autocapitalize="none"
                autocomplete="off"
                spellcheck="false"
                aria-label="组织标识"
                aria-describedby="organization-slug-help"
                placeholder="例如：midou-team"
                @input="emit('clearError')"
              />
              <small id="organization-slug-help">2–63 位小写字母、数字或连字符。</small>
            </label>
          </section>
          <section v-else class="organization-wizard__step">
            <p>选择首位组织管理员，并在创建前核对影响范围。</p>
            <label>
              首位组织管理员
              <select
                aria-label="首位组织管理员"
                aria-describedby="p41-admin-help"
                v-model="form.initial_admin_user_id"
                @change="emit('clearError')"
              >
                <option value="">当前超级管理员</option>
                <option
                  v-for="item in users"
                  :key="item.id"
                  :value="item.id"
                  :disabled="item.status !== 'active'"
                >
                  {{ item.email }}
                </option>
              </select>
              <small id="p41-admin-help"
                >这里只列出本次账号概览返回的用户；不指定时使用当前超级管理员。</small
              >
            </label>
            <p v-if="errorMessage" class="organization-wizard__error" role="alert">
              <strong>创建未完成</strong>
              <span>{{ errorMessage }}</span>
            </p>
            <dl class="organization-wizard__summary">
              <div>
                <dt>组织</dt>
                <dd>{{ form.name }}</dd>
              </div>
              <div>
                <dt>组织标识</dt>
                <dd>{{ form.slug }}</dd>
              </div>
              <div>
                <dt>创建后</dt>
                <dd>同时创建默认工作区和组织级数据范围</dd>
              </div>
            </dl>
          </section>
          <footer class="organization-wizard__actions">
            <button class="organization-wizard__secondary" type="button" @click="close">
              取消
            </button>
            <button
              v-if="step === 2"
              class="organization-wizard__secondary"
              type="button"
              @click="((step = 1), emit('clearError'))"
            >
              上一步
            </button>
            <button
              v-if="step === 1"
              class="organization-wizard__primary"
              type="button"
              @click="continueToConfirmation"
            >
              下一步：选择管理员
            </button>
            <button v-else class="organization-wizard__primary" :disabled="busy">
              {{ busy ? "正在创建…" : "确认创建" }}
            </button>
          </footer>
        </section>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.organization-wizard {
  position: fixed;
  inset: 0;
  z-index: 10;
  width: min(900px, calc(100% - 32px));
  max-height: min(720px, calc(100dvh - 32px));
  overflow: auto;
  margin: auto;
  padding: 0;
  border: 1px solid #c8d7e8;
  border-radius: 14px;
  color: #182b45;
  background: #fff;
  box-shadow: 0 28px 90px rgb(8 25 49 / 34%);
}
.organization-wizard::backdrop {
  background: rgb(11 24 43 / 58%);
  backdrop-filter: blur(5px);
}
.organization-wizard form {
  min-width: 0;
  margin: 0;
}
.organization-wizard__layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 420px;
}
.organization-wizard__identity {
  padding: 28px 24px;
  color: #fff;
  background: #254a9c;
}
.organization-wizard__identity > small {
  color: #dbe8ff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.organization-wizard__identity h3 {
  margin: 12px 0 6px;
  color: #fff;
  font-size: 26px;
  line-height: 1.25;
}
.organization-wizard__identity > p {
  margin: 0;
  color: #e6eeff;
  font-size: 14px;
  line-height: 1.55;
}
.organization-wizard__progress {
  margin: 28px 0 0;
  padding: 0;
  display: grid;
  list-style: none;
}
.organization-wizard__progress li {
  min-height: 56px;
  padding: 12px 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgb(255 255 255 / 28%);
  color: #d7e3ff;
  font-size: 14px;
}
.organization-wizard__progress li[aria-current="step"] {
  color: #fff;
  font-weight: 800;
}
.organization-wizard__progress span {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid rgb(255 255 255 / 46%);
  border-radius: 50%;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}
.organization-wizard__progress li[aria-current="step"] span {
  border-color: #fff;
  background: #fff;
  color: #254a9c;
}
.organization-wizard__content {
  min-width: 0;
  padding: 30px;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
}
.organization-wizard__step {
  align-content: start;
  display: grid;
  gap: 20px;
}
.organization-wizard__step > p {
  margin: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid #dbe4ee;
  color: #273d58;
  font-size: 17px;
  line-height: 1.55;
}
.organization-wizard__step label {
  display: grid;
  gap: 7px;
  color: #263d59;
  font-size: 14px;
  font-weight: 750;
}
.organization-wizard__step input,
.organization-wizard__step select {
  width: 100%;
  min-height: 48px;
  padding: 11px 13px;
  border: 1px solid #bdcad9;
  border-radius: 7px;
  color: #172b45;
  background: #fff;
  font: inherit;
  font-size: 16px;
}
.organization-wizard__step input::placeholder {
  color: #78879a;
}
.organization-wizard__step small {
  color: #64758c;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
}
.organization-wizard__error {
  padding: 12px 14px;
  display: grid;
  gap: 4px;
  border: 1px solid #dba9a5;
  border-left: 4px solid #a33d3a;
  border-radius: 7px;
  color: #572b2a;
  background: #fbf3f2;
}
.organization-wizard__error strong {
  color: #8f3431;
}
.organization-wizard__summary {
  margin: 0;
  padding: 14px 16px;
  display: grid;
  gap: 0;
  border: 1px solid #dbe4ee;
  border-radius: 8px;
  background: #f6f8fb;
}
.organization-wizard__summary div {
  padding: 10px 0;
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 12px;
  border-bottom: 1px solid #dbe4ee;
}
.organization-wizard__summary div:last-child {
  border-bottom: 0;
}
.organization-wizard__summary dt {
  color: #64758c;
  font-size: 13px;
}
.organization-wizard__summary dd {
  margin: 0;
  color: #172b45;
  overflow-wrap: anywhere;
}
.organization-wizard__actions {
  margin: 24px -30px -30px;
  padding: 16px 30px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  border-top: 1px solid #dbe4ee;
  background: #fff;
}
.organization-wizard__actions button {
  min-height: 46px;
  padding: 10px 16px;
  border: 1px solid #bdcad9;
  border-radius: 7px;
  color: #253b56;
  background: #fff;
  font: inherit;
  font-size: 15px;
  font-weight: 750;
  cursor: pointer;
}
.organization-wizard__actions .organization-wizard__primary {
  border-color: #254a9c;
  color: #fff;
  background: #254a9c;
}
.organization-wizard__actions button:hover:not(:disabled) {
  border-color: #254a9c;
  color: #173978;
  background: #edf3ff;
}
.organization-wizard__actions .organization-wizard__primary:hover:not(:disabled) {
  color: #fff;
  background: #193b80;
}
.organization-wizard__actions button:active:not(:disabled) {
  transform: translateY(1px);
}
.organization-wizard__actions button:disabled {
  border-color: #d7dee8;
  color: #718096;
  background: #edf0f5;
  cursor: not-allowed;
}
.organization-wizard :is(input, select, button):focus-visible {
  outline: 3px solid rgb(13 110 253 / 34%);
  outline-offset: 3px;
}
@media (max-width: 700px) {
  .organization-wizard {
    width: calc(100% - 24px);
    max-height: calc(100dvh - 24px);
  }
  .organization-wizard__layout {
    display: block;
    min-height: 0;
  }
  .organization-wizard__identity {
    padding: 20px 20px 14px;
  }
  .organization-wizard__identity h3 {
    margin: 7px 0 3px;
    font-size: 24px;
  }
  .organization-wizard__identity > p {
    font-size: 13px;
  }
  .organization-wizard__progress {
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 12px;
  }
  .organization-wizard__progress li {
    min-height: 42px;
    padding: 7px 0;
    font-size: 13px;
  }
  .organization-wizard__progress span {
    width: 26px;
    height: 26px;
  }
  .organization-wizard__content {
    padding: 20px 20px 0;
    grid-template-rows: auto auto;
  }
  .organization-wizard__step {
    gap: 18px;
  }
  .organization-wizard__step > p {
    font-size: 16px;
  }
  .organization-wizard__summary div {
    grid-template-columns: 78px minmax(0, 1fr);
    gap: 8px;
  }
  .organization-wizard__actions {
    position: sticky;
    bottom: 0;
    margin: 20px -20px 0;
    padding: 12px 20px;
    justify-content: flex-end;
    background: #fff;
    box-shadow: 0 -8px 20px rgb(23 43 69 / 7%);
  }
  .organization-wizard__actions button {
    min-height: 44px;
    padding-inline: 13px;
  }
}
</style>
