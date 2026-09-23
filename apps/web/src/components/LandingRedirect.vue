<script setup lang="ts">
import { onMounted, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import { getLastMemberRoute } from "../navigation-memory";
import LandingRedirectSurface from "./LandingRedirectSurface.vue";

type State = "loading" | "blocked";
const props = defineProps<{ apiBaseUrl: string }>();
const router = useRouter();
const request = createApiClient(props.apiBaseUrl);
const state = shallowRef<State>("loading");
const requestId = shallowRef("");

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
    await router.replace(
      response.data.route === "/home" ? getLastMemberRoute() : response.data.route,
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      if (error.kind === "expired") return router.replace("/login");
    }
    state.value = "blocked";
  }
}

onMounted(resolveLanding);
</script>

<template>
  <LandingRedirectSurface :state="state" :request-id="requestId" @retry="resolveLanding" />
</template>
