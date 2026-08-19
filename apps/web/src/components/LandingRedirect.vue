<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";

type State = "loading" | "blocked";
const props = defineProps<{ apiBaseUrl: string }>();
const request = createApiClient(props.apiBaseUrl);
const state = ref<State>("loading");
const requestId = ref("");

async function resolveLanding() {
  state.value = "loading";
  requestId.value = "";
  try {
    const response = await request<{ route: string }>("/me/landing");
    requestId.value = response.request_id;
    if (!response.data?.route) {
      state.value = "blocked";
      return;
    }
    window.location.replace(response.data.route);
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      if (error.kind === "expired") return window.location.replace("/login");
    }
    state.value = "blocked";
  }
}

onMounted(resolveLanding);
</script>

<template>
  <main class="landing-redirect" aria-live="polite">
    <UiStatePanel
      :kind="state === 'loading' ? 'loading' : 'blocked'"
      :request-id="requestId"
      :primary-label="state === 'loading' ? '正在进入工作台' : '重新检查'"
      @primary="resolveLanding"
    />
  </main>
</template>
