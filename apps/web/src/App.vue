<script setup lang="ts">
import VerificationFramework from "./components/VerificationFramework.vue";
import ConfigBoundary from "./components/ConfigBoundary.vue";
import RedisFoundation from "./components/RedisFoundation.vue";
import MySqlFoundation from "./components/MySqlFoundation.vue";
import ApiFoundation from "./components/ApiFoundation.vue";
import FileAuditFoundation from "./components/FileAuditFoundation.vue";
import DeploymentFoundation from "./components/DeploymentFoundation.vue";
import LocalIdentity from "./components/LocalIdentity.vue";
import TenancyChooser from "./components/TenancyChooser.vue";
import AuthorizationCenter from "./components/AuthorizationCenter.vue";
import ResourceGrantCenter from "./components/ResourceGrantCenter.vue";
import AuditSecurityCenter from "./components/AuditSecurityCenter.vue";
import ThemeStudio from "./components/ThemeStudio.vue";
import OnboardingGuide from "./components/OnboardingGuide.vue";
import NavigationShell from "./components/NavigationShell.vue";
import UiStateShowcase from "./components/UiStateShowcase.vue";
import LandingRedirect from "./components/LandingRedirect.vue";
import { publicConfig } from "./config";

const apiBase = publicConfig.apiBaseUrl;
const routePath = window.location.pathname.replace(/\/$/, "") || "/";
const requestedInternalView = new URLSearchParams(window.location.search).get(
  "view",
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
const selectedView =
  publicViews[routePath] ??
  (import.meta.env.DEV &&
  requestedInternalView &&
  internalViews.has(requestedInternalView)
    ? requestedInternalView
    : null);
const isInternalView = selectedView !== null;
const memberRoute =
  routePath === "/home" ||
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
  ].some((path) => routePath === path || routePath.startsWith(`${path}/`));
const navigationShell = memberRoute
  ? "member"
  : routePath === "/org-admin" || routePath.startsWith("/org-admin/")
    ? "organization_admin"
    : routePath === "/platform-admin" ||
        routePath.startsWith("/platform-admin/")
      ? "platform_admin"
      : null;
const isUiStatesView =
  import.meta.env.DEV &&
  (requestedInternalView === "ui-states" || routePath === "/ui-states");
const isNotFoundRoute = !isInternalView && !navigationShell && !isUiStatesView;
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
