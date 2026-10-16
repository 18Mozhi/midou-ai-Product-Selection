<script setup lang="ts">
import { ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";

const props = defineProps<{ apiBaseUrl: string }>();
const busy = ref(false);
const errorMessage = ref("");
const idempotencyKey = crypto.randomUUID();
async function logout() {
  if (busy.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    await createApiClient(props.apiBaseUrl)("/auth/logout", { method: "POST", idempotencyKey });
    // A full navigation destroys cached protected views and all their background reads.
    window.location.replace("/login");
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      window.location.replace("/login");
      return;
    }
    errorMessage.value = "暂时无法确认退出结果，请重试。";
    busy.value = false;
  }
}
</script>

<template>
  <div class="session-logout">
    <button type="button" :disabled="busy" @click="logout">
      {{ busy ? "正在退出…" : "退出登录" }}
    </button>
    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.session-logout {
  position: relative;
}
.session-logout button {
  min-height: 44px;
  padding: 8px 12px;
  white-space: nowrap;
}
.session-logout p {
  position: absolute;
  z-index: 20;
  right: 0;
  top: 100%;
  width: min(280px, calc(100vw - 32px));
  padding: 12px;
  border: 1px solid var(--so-border);
  border-radius: 12px;
  background: var(--so-panel);
  color: var(--so-text);
  box-shadow: var(--glass-shadow);
}
</style>
