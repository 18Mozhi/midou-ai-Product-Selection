import { createRouter, createWebHistory } from "vue-router";
import { createApiClient } from "./api-client";
import { publicConfig } from "./config";
import { rememberValidRoute } from "./navigation-memory";
import { appRoutes } from "./route-catalog";

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

router.beforeEach(async (to) => {
  if (to.meta.sessionRequired !== true) return true;
  try {
    const response = await apiRequest<{ authenticated: boolean }>("/auth/session-status");
    if (response.data.authenticated) return true;
  } catch {
    // A protected account surface cannot be rendered truthfully while session state is unknown.
  }
  return {
    path: "/login",
    query: {
      reason: "authentication_required",
      redirect: to.fullPath,
    },
  };
});

router.afterEach((to) => {
  const title = typeof to.meta.title === "string" ? to.meta.title : "";
  document.title = title ? `${title} · 智能选品` : "智能选品";
  if (to.meta.notFound !== true) rememberValidRoute(to.fullPath);
});
