import { createRouter, createWebHistory } from "vue-router";
import { createSessionRouteGuard } from "./account-route-guard";
import { createApiClient } from "./api-client";
import { publicConfig } from "./config";
import { rememberValidRoute } from "./navigation-memory";
import { appRoutes, legacyScopeRouteNames } from "./route-catalog";

const apiRequest = createApiClient(publicConfig.apiBaseUrl);

export const router = createRouter({
  history: createWebHistory(),
  routes: appRoutes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.path === from.path) return false;
    return { top: 0 };
  },
});

const verifySessionRoute = createSessionRouteGuard(router, legacyScopeRouteNames, async () => (
  await apiRequest<{ authenticated: boolean; account_rehearsal?: true }>("/auth/session-status")
).data);

router.beforeEach((to) => {
  if (to.path === "/settings/theme")
    return { path: "/me", query: { section: "appearance" }, replace: true };
  return verifySessionRoute(to);
});

router.afterEach((to) => {
  const title = typeof to.meta.title === "string" ? to.meta.title : "";
  document.title = title ? `${title} · 米兜智能选品` : "米兜智能选品";
  if (to.meta.notFound !== true) rememberValidRoute(to.fullPath);
});
