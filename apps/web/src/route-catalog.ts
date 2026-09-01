import type { RouteRecordRaw } from "vue-router";
import generatedCatalog from "./route-catalog.generated.json";

export type AppShell = "member" | "organization_admin" | "platform_admin" | "account";

export interface AppRouteMeta {
  title: string;
  breadcrumb: string[];
  shell?: AppShell;
  view?: string;
  capabilities?: string[];
  notFound?: boolean;
  surface?: string;
  cachePolicy?: "none" | "preserve" | "reset_on_scope";
  sessionRequired?: boolean;
}

export interface ShellNavigationItem {
  label: string;
  path: string;
  icon: string;
  group: string;
  capabilities: string[];
}

interface RouteCatalogEntry {
  path: string;
  name: string;
  title: string;
  breadcrumb: string[];
  shell: AppShell | null;
  view: string | null;
  capabilities: string[];
  notFound: boolean;
  surface: string;
  cachePolicy: "none" | "preserve" | "reset_on_scope";
  acceptance: "public" | "protected" | "internal" | "fallback";
  sessionRequired?: boolean;
  navigation?: {
    label: string;
    icon: string;
    group: string;
  };
}

interface RouteCatalogManifest {
  schemaVersion: 1;
  routes: RouteCatalogEntry[];
}

const manifest = generatedCatalog as RouteCatalogManifest;
const ApplicationSurface = () => import("./App.vue");
const runtimeRoutes = manifest.routes.filter(
  (entry) => import.meta.env.DEV || entry.acceptance !== "internal",
);

export const appRoutes: RouteRecordRaw[] = runtimeRoutes.map((entry) => ({
  path: entry.path,
  name: entry.name,
  component: ApplicationSurface,
  meta: {
    title: entry.title,
    breadcrumb: [...entry.breadcrumb],
    ...(entry.shell ? { shell: entry.shell } : {}),
    ...(entry.view ? { view: entry.view } : {}),
    capabilities: [...entry.capabilities],
    notFound: entry.notFound,
    surface: entry.surface,
    cachePolicy: entry.cachePolicy,
    sessionRequired: entry.sessionRequired === true,
  } satisfies AppRouteMeta,
}));

export function navigationItemsFor(shell: Exclude<AppShell, "account">): ShellNavigationItem[] {
  return runtimeRoutes
    .filter((entry) => entry.shell === shell && entry.navigation)
    .map((entry) => ({
      label: entry.navigation!.label,
      path: entry.path,
      icon: entry.navigation!.icon,
      group: entry.navigation!.group,
      capabilities: [...entry.capabilities],
    }));
}
