<script setup lang="ts">
defineProps<{
  roles: any[];
  capabilities: string[];
  roleText: (value: string) => string;
  capabilityText: (value: string) => string;
}>();
</script>

<template>
  <section class="org-admin-role-grid">
    <article v-for="role in roles" :key="role.code" class="org-admin-card">
      <i>{{ roleText(role.code) }}</i>
      <h3>{{ role.name }}</h3>
      <p>{{ role.description }}</p>
      <div class="org-admin-chips">
        <span v-for="capability in role.capabilities" :key="capability">{{
          capabilityText(capability)
        }}</span>
      </div>
      <small>影响预览：该角色可执行 {{ role.capabilities.length }} 项业务操作。</small>
    </article>
    <article class="org-admin-card org-admin-role-matrix">
      <header>
        <div>
          <p>能力矩阵</p>
          <h3>角色影响对比</h3>
        </div>
      </header>
      <div role="table" aria-label="角色能力矩阵">
        <div role="row" class="org-admin-matrix-head">
          <b role="columnheader">业务能力</b
          ><b v-for="role in roles" :key="role.code" role="columnheader">{{
            roleText(role.code)
          }}</b>
        </div>
        <div v-for="capability in capabilities" :key="capability" role="row">
          <span role="cell">{{ capabilityText(capability) }}</span
          ><span v-for="role in roles" :key="role.code" role="cell">{{
            role.capabilities.includes(capability) ? "具备" : "—"
          }}</span>
        </div>
      </div>
    </article>
  </section>
</template>
