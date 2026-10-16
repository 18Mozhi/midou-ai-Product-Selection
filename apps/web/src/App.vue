<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { useRoute } from "vue-router";
import { asyncSurface } from "./ui/async-surface";
import { publicConfig } from "./config";

const VerificationFramework = import.meta.env.DEV
  ? defineAsyncComponent(() => import("./components/VerificationFramework.vue"))
  : null;
const ConfigBoundary = asyncSurface(() => import("./components/ConfigBoundary.vue"));
const RedisFoundation = asyncSurface(() => import("./components/RedisFoundation.vue"));
const MySqlFoundation = asyncSurface(() => import("./components/MySqlFoundation.vue"));
const ApiFoundation = asyncSurface(() => import("./components/ApiFoundation.vue"));
const FileAuditFoundation = asyncSurface(() => import("./components/FileAuditFoundation.vue"));
const DeploymentFoundation = asyncSurface(() => import("./components/DeploymentFoundation.vue"));
const LocalIdentity = asyncSurface(() => import("./components/LocalIdentity.vue"));
const TenancyChooser = asyncSurface(() => import("./components/TenancyChooser.vue"));
const AuthorizationCenter = asyncSurface(() => import("./components/AuthorizationCenter.vue"));
const ResourceGrantCenter = asyncSurface(() => import("./components/ResourceGrantCenter.vue"));
const AuditSecurityCenter = asyncSurface(() => import("./components/AuditSecurityCenter.vue"));
const ThemeStudio = asyncSurface(() => import("./components/ThemeStudio.vue"));
const OnboardingGuide = asyncSurface(() => import("./components/OnboardingGuide.vue"));
const NavigationShell = asyncSurface(() => import("./components/NavigationShell.vue"));
const AccountShell = asyncSurface(() => import("./components/AccountShell.vue"));
const UiStateShowcase = import.meta.env.DEV
  ? defineAsyncComponent(() => import("./components/UiStateShowcase.vue"))
  : null;
const NotFoundPage = asyncSurface(() => import("./components/NotFoundPage.vue"));
const LandingRedirect = asyncSurface(() => import("./components/LandingRedirect.vue"));

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
  "ui-states",
]);
const selectedView = computed(
  () =>
    (import.meta.env.DEV &&
    requestedInternalView.value &&
    internalViews.has(requestedInternalView.value)
      ? requestedInternalView.value
      : null) ?? (typeof route.meta.view === "string" ? route.meta.view : null),
);
const navigationShell = computed(() =>
  ["member", "organization_admin", "platform_admin"].includes(String(route.meta.shell))
    ? (route.meta.shell as "member" | "organization_admin" | "platform_admin")
    : null,
);
const isUiStatesView = computed(() => import.meta.env.DEV && selectedView.value === "ui-states");
const isNotFoundRoute = computed(
  () => route.meta.notFound === true || selectedView.value === "not-found",
);
</script>

<template>
  <LandingRedirect v-if="selectedView === 'landing'" :api-base-url="apiBase" />
  <LocalIdentity v-else-if="selectedView === 'local-identity'" :key="routePath" />
  <TenancyChooser v-else-if="selectedView === 'tenancy'" :api-base-url="apiBase" />
  <AuthorizationCenter v-else-if="selectedView === 'authorization'" :api-base-url="apiBase" />
  <ResourceGrantCenter v-else-if="selectedView === 'resource-grants'" :api-base-url="apiBase" />
  <AuditSecurityCenter v-else-if="selectedView === 'audit-security'" :api-base-url="apiBase" />
  <ThemeStudio v-else-if="selectedView === 'theme'" :api-base-url="apiBase" />
  <OnboardingGuide v-else-if="selectedView === 'onboarding'" />
  <component
    :is="VerificationFramework"
    v-else-if="VerificationFramework && selectedView === 'verification'"
  />
  <ConfigBoundary v-else-if="selectedView === 'config'" :api-base-url="apiBase" />
  <RedisFoundation v-else-if="selectedView === 'redis'" />
  <MySqlFoundation v-else-if="selectedView === 'mysql'" />
  <ApiFoundation v-else-if="selectedView === 'api'" :api-base-url="apiBase" />
  <FileAuditFoundation v-else-if="selectedView === 'file-audit'" />
  <DeploymentFoundation v-else-if="selectedView === 'deployment'" :api-base-url="apiBase" />
  <NavigationShell v-else-if="navigationShell" :shell="navigationShell" :api-base-url="apiBase" />
  <AccountShell v-else-if="selectedView === 'account'" :api-base-url="apiBase" />
  <component :is="UiStateShowcase" v-else-if="UiStateShowcase && isUiStatesView" />
  <NotFoundPage v-else-if="isNotFoundRoute" />
</template>
