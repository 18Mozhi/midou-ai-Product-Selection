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
        <header class="organization-wizard__identity">
          <small>组织创建</small>
          <h3>新建组织</h3>
          <p>建立组织及默认工作区。</p>
          <ol class="organization-wizard__progress" aria-label="创建组织步骤">
            <li :aria-current="step === 1 ? 'step' : undefined"><span>1</span>组织资料</li>
            <li :aria-current="step === 2 ? 'step' : undefined"><span>2</span>管理员与确认</li>
          </ol>
        </header>
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
#app .organization-wizard {
  position: fixed;
  inset: 0;
  z-index: 10;
  width: min(640px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  overflow: auto;
  margin: auto;
  padding: 0;
  border: 1px solid var(--so-border-strong);
  border-radius: 10px;
  background: var(--so-panel);
  color: var(--so-text);
  box-shadow: var(--so-shadow-dialog);
}
#app .organization-wizard::backdrop {
  background: var(--so-scrim);
  backdrop-filter: none;
}
#app .organization-wizard form {
  min-width: 0;
  margin: 0;
  padding: 0;
  gap: 0;
}
.organization-wizard__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
}
.organization-wizard__identity {
  padding: 16px 20px;
  border-bottom: 1px solid var(--so-border);
  background: var(--so-panel);
}
.organization-wizard__identity > small {
  display: none;
}
.organization-wizard__identity h3 {
  margin: 0;
  font-size: 18px;
}
.organization-wizard__identity > p {
  margin: 6px 0 0;
  color: var(--so-text-muted);
  font-size: 13px;
}
.organization-wizard__progress {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}
.organization-wizard__progress li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-block: 8px;
  border-bottom: 2px solid var(--so-border);
  color: var(--so-text-muted);
  font-size: 13px;
}
.organization-wizard__progress li[aria-current="step"] {
  border-color: var(--so-primary);
  color: var(--so-primary);
  font-weight: 600;
}
.organization-wizard__progress span {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 12px;
}
.organization-wizard__content {
  display: grid;
  min-width: 0;
  gap: 16px;
  padding: 16px 20px 0;
}
.organization-wizard__step {
  display: grid;
  align-content: start;
  gap: 14px;
  min-width: 0;
}
.organization-wizard__step > p {
  margin: 0;
  color: var(--so-text-muted);
  font-size: 13px;
  line-height: 1.6;
}
.organization-wizard__step label {
  display: grid;
  min-width: 0;
  gap: 6px;
  font-size: 13px;
}
#app .organization-wizard__step :is(input, select) {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid var(--so-border-strong);
  border-radius: 6px;
  background: var(--so-panel);
  color: var(--so-text);
  font: inherit;
}
.organization-wizard__step small {
  color: var(--so-text-muted);
  font-size: 12px;
  line-height: 1.5;
}
.organization-wizard__error {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--so-danger-border);
  border-radius: 6px;
  background: var(--so-danger-soft);
  color: var(--so-danger);
}
.organization-wizard__summary {
  margin: 0;
  padding: 4px 12px;
  border: 1px solid var(--so-border);
  border-radius: 6px;
  background: var(--so-panel-soft);
}
.organization-wizard__summary div {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--so-border);
}
.organization-wizard__summary div:last-child {
  border: 0;
}
.organization-wizard__summary dt {
  color: var(--so-text-muted);
  font-size: 13px;
}
.organization-wizard__summary dd {
  margin: 0;
  overflow-wrap: anywhere;
}
#app .organization-wizard .organization-wizard__actions {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-inline: -20px;
  padding: 12px 20px;
  border-top: 1px solid var(--so-border);
  background: var(--so-panel);
}
#app .organization-wizard__actions button {
  min-height: 44px;
  padding: 9px 14px;
  border: 1px solid var(--so-border-strong);
  border-radius: 6px;
  background: var(--so-panel);
  color: var(--so-text);
  font: inherit;
}
#app .organization-wizard__actions .organization-wizard__primary {
  border-color: var(--so-primary);
  background: var(--so-primary);
  color: var(--so-on-primary);
}
#app .organization-wizard__actions button:disabled {
  background: var(--so-panel-soft);
  color: var(--so-text-muted);
  cursor: not-allowed;
}
#app .organization-wizard :is(input, select, button):focus-visible {
  outline: 3px solid var(--so-focus);
  outline-offset: 2px;
}
@media (max-width: 640px) {
  .organization-wizard__identity {
    padding: 14px 16px;
  }
  .organization-wizard__content {
    padding-inline: 16px;
  }
  #app .organization-wizard .organization-wizard__actions {
    margin-inline: -16px;
    padding-inline: 16px;
  }
  .organization-wizard__progress {
    gap: 8px;
  }
}
</style>
