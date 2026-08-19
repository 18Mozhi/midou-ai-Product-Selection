import { createRouter, createWebHistory } from "vue-router";

const ApplicationRoot = () => import("./App.vue");

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/:pathMatch(.*)*",
      name: "application",
      component: ApplicationRoot,
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.path === from.path) return false;
    return { top: 0 };
  },
});
