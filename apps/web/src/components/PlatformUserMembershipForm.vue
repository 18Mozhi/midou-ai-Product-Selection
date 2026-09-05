<script setup lang="ts">
import { computed, reactive, watch } from "vue";

const props = defineProps<{
  open: boolean;
  userId: string;
  userStatus: string;
  memberships: any[];
  organizations: any[];
  busy: boolean;
  roleText: (value: string) => string;
}>();
const emit = defineEmits<{
  submit: [value: { organization_id: string; role_code: string; reason: string }];
}>();
const organizationRoleCodes = [
  "member",
  "selection_manager",
  "procurement_member",
  "organization_admin",
  "auditor",
];
const form = reactive({ organization_id: "", role_code: "member", reason: "" });
const availableOrganizations = computed(() => {
  const joined = new Set(props.memberships.map((item: any) => item.organization_id));
  return props.organizations.filter(
    (organization) => organization.status === "active" && !joined.has(organization.id),
  );
});
watch(
  () => [props.open, props.userId, availableOrganizations.value.map((item) => item.id).join(",")],
  () => {
    if (!props.open) return;
    if (!availableOrganizations.value.some((item) => item.id === form.organization_id))
      form.organization_id = availableOrganizations.value[0]?.id ?? "";
    form.role_code = "member";
    form.reason = "";
  },
  { immediate: true },
);
</script>

<template>
  <form v-if="availableOrganizations.length" @submit.prevent="emit('submit', { ...form })">
    <h5>加入其他组织</h5>
    <label
      >组织<select v-model="form.organization_id" required aria-label="加入组织">
        <option
          v-for="organization in availableOrganizations"
          :key="organization.id"
          :value="organization.id"
        >
          {{ organization.name }}
        </option>
      </select></label
    >
    <label
      >组织角色<select v-model="form.role_code" required aria-label="组织角色">
        <option v-for="code in organizationRoleCodes" :key="code" :value="code">
          {{ roleText(code) }}
        </option>
      </select></label
    >
    <label
      >授权原因<textarea
        v-model="form.reason"
        required
        minlength="2"
        maxlength="300"
        aria-label="授权原因"
      ></textarea>
    </label>
    <button :disabled="busy || userStatus !== 'active'">加入组织</button>
  </form>
</template>

<style scoped>
form {
  margin: 12px 0 18px;
  padding: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  border: 1px solid var(--so-border);
  border-radius: 10px;
  background: var(--so-panel-soft);
}
h5,
label:last-of-type {
  grid-column: 1 / -1;
}
label {
  display: grid;
  gap: 6px;
}
select,
textarea {
  min-height: 44px;
  padding: 9px 10px;
  border: 1px solid var(--so-border);
  border-radius: 8px;
  color: var(--so-text);
  background: var(--so-bg-elevated);
}
textarea {
  min-height: 76px;
  resize: vertical;
}
button {
  justify-self: start;
}
@media (max-width: 700px) {
  form {
    grid-template-columns: 1fr;
  }
  h5,
  label:last-of-type {
    grid-column: auto;
  }
}
</style>
