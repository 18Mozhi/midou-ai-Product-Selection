<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { useRoute } from "vue-router";
import { publicConfig } from "./config";

const VerificationFramework = defineAsyncComponent(() => import("./components/VerificationFramework.vue"));
const ConfigBoundary = defineAsyncComponent(() => import("./components/ConfigBoundary.vue"));
const RedisFoundation = defineAsyncComponent(() => import("./components/RedisFoundation.vue"));
const MySqlFoundation = defineAsyncComponent(() => import("./components/MySqlFoundation.vue"));
const ApiFoundation = defineAsyncComponent(() => import("./components/ApiFoundation.vue"));
const FileAuditFoundation = defineAsyncComponent(() => import("./components/FileAuditFoundation.vue"));
const DeploymentFoundation = defineAsyncComponent(() => import("./components/DeploymentFoundation.vue"));
const LocalIdentity = defineAsyncComponent(() => import("./components/LocalIdentity.vue"));
const TenancyChooser = defineAsyncComponent(() => import("./components/TenancyChooser.vue"));
const AuthorizationCenter = defineAsyncComponent(() => import("./components/AuthorizationCenter.vue"));
const ResourceGrantCenter = defineAsyncComponent(() => import("./components/ResourceGrantCenter.vue"));
const AuditSecurityCenter = defineAsyncComponent(() => import("./components/AuditSecurityCenter.vue"));
const ThemeStudio = defineAsyncComponent(() => import("./components/ThemeStudio.vue"));
const OnboardingGuide = defineAsyncComponent(() => import("./components/OnboardingGuide.vue"));
const NavigationShell = defineAsyncComponent(() => import("./components/NavigationShell.vue"));
const UiStateShowcase = defineAsyncComponent(() => import("./components/UiStateShowcase.vue"));
const LandingRedirect = defineAsyncComponent(() => import("./components/LandingRedirect.vue"));

const apiBase = publicConfig.apiBaseUrl;
const route = useRoute();
const routePath = computed(() => route.path.replace(/\/$/, "") || "/");
const requestedInternalView = computed(() =>
  typeof route.query.view === "string" ? route.query.view : null,
);
const internalViews = new Set([
  "verification",
  "config",
  "redis",
  "mysql",
  "api",
  "file-audit",
  "deployment",
  "local-identity",
  "tenancy",
  "authorization",
  "resource-grants",
  "audit-security",
  "theme",
  "onboarding",
]);
const publicViews: Record<string, string> = {
  "/login": "local-identity",
  "/register": "local-identity",
  "/forgot-password": "local-identity",
  "/verify-email": "local-identity",
  "/reset-password": "local-identity",
  "/security/mfa": "local-identity",
  "/select-context": "tenancy",
  "/onboarding": "onboarding",
  "/settings/theme": "theme",
};
const selectedView = computed(() =>
  publicViews[routePath.value] ??
  (import.meta.env.DEV && requestedInternalView.value && internalViews.has(requestedInternalView.value)
    ? requestedInternalView.value
    : null),
);
const isInternalView = computed(() => selectedView.value !== null);
const memberRoute = computed(() =>
  routePath.value === "/home" ||
  [
    "/work",
    "/trends",
    "/opportunities",
    "/competitors",
    "/sourcing",
    "/tasks",
    "/notifications",
    "/automations",
    "/reports",
    "/me",
  ].some((path) => routePath.value === path || routePath.value.startsWith(`${path}/`)),
);
const navigationShell = computed(() => memberRoute.value
  ? "member"
  : routePath.value === "/org-admin" || routePath.value.startsWith("/org-admin/")
    ? "organization_admin"
    : routePath.value === "/platform-admin" ||
        routePath.value.startsWith("/platform-admin/")
      ? "platform_admin"
      : null);
const isUiStatesView = computed(() =>
  import.meta.env.DEV &&
  (requestedInternalView.value === "ui-states" || routePath.value === "/ui-states"),
);
const isNotFoundRoute = computed(() => !isInternalView.value && !navigationShell.value && !isUiStatesView.value);
</script>

<template>
  <LandingRedirect
    v-if="routePath === '/' && !selectedView"
    :api-base-url="apiBase"
  />
  <LocalIdentity v-else-if="selectedView === 'local-identity'" />
  <TenancyChooser
    v-else-if="selectedView === 'tenancy'"
    :api-base-url="apiBase"
  />
  <AuthorizationCenter
    v-else-if="selectedView === 'authorization'"
    :api-base-url="apiBase"
  />
  <ResourceGrantCenter
    v-else-if="selectedView === 'resource-grants'"
    :api-base-url="apiBase"
  />
  <AuditSecurityCenter
    v-else-if="selectedView === 'audit-security'"
    :api-base-url="apiBase"
  />
  <ThemeStudio v-else-if="selectedView === 'theme'" :api-base-url="apiBase" />
  <OnboardingGuide v-else-if="selectedView === 'onboarding'" />
  <VerificationFramework v-else-if="selectedView === 'verification'" />
  <ConfigBoundary
    v-else-if="selectedView === 'config'"
    :api-base-url="apiBase"
  />
  <RedisFoundation v-else-if="selectedView === 'redis'" />
  <MySqlFoundation v-else-if="selectedView === 'mysql'" />
  <ApiFoundation v-else-if="selectedView === 'api'" :api-base-url="apiBase" />
  <FileAuditFoundation v-else-if="selectedView === 'file-audit'" />
  <DeploymentFoundation
    v-else-if="selectedView === 'deployment'"
    :api-base-url="apiBase"
  />
  <NavigationShell
    v-else-if="navigationShell"
    :shell="navigationShell"
    :api-base-url="apiBase"
  />
  <UiStateShowcase
    v-else-if="isUiStatesView || isNotFoundRoute"
    :initial-state="isNotFoundRoute ? 'not_found' : undefined"
  />
</template>
