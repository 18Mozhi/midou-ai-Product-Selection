import type { RouteLocationNormalized, Router } from "vue-router";

type SessionRouteStatus = { authenticated: boolean; account_rehearsal?: true };

export function isLegacyScopeRoute(entry: {
  shell: string | null;
  view: string | null;
  path: string;
}) {
  return (
    entry.shell === "organization_admin" ||
    entry.view === "tenancy" ||
    entry.view === "resource-grants" ||
    entry.path === "/platform-admin/organizations" ||
    entry.path.startsWith("/platform-admin/organizations/")
  );
}

export function createSessionRouteGuard(
  router: Pick<Router, "hasRoute" | "removeRoute">,
  legacyScopeRouteNames: ReadonlySet<string>,
  readSession: () => Promise<SessionRouteStatus>,
) {
  const isLegacy = (route: { name?: unknown } | undefined) =>
    typeof route?.name === "string" && legacyScopeRouteNames.has(route.name);
  return async (to: RouteLocationNormalized) => {
    if (to.path === "/login") return true;
    const retiredTarget = isLegacy(to)
      ? to
      : to.meta.notFound !== true && isLegacy(to.redirectedFrom)
        ? to.redirectedFrom
        : null;
    const protectedRoute = to.meta.sessionRequired === true;
    const oldHome = to.path === "/home";
    if (!protectedRoute && !retiredTarget && !oldHome) return true;
    try {
      const session = await readSession();
      if (
        typeof session?.authenticated !== "boolean" ||
        (Object.hasOwn(session, "account_rehearsal") && session.account_rehearsal !== true)
      )
        throw new Error("invalid_session_route_status");
      if (session.account_rehearsal === true) {
        for (const name of legacyScopeRouteNames)
          if (router.hasRoute(name)) router.removeRoute(name);
        if (retiredTarget)
          return {
            path: retiredTarget.path,
            query: retiredTarget.query,
            hash: retiredTarget.hash,
            replace: true,
          };
        if (oldHome) return { path: "/opportunities", replace: true };
      }
      if (session.authenticated || !protectedRoute) return true;
    } catch {
      // Do not mount a legacy surface when the deployment mode is unknown.
    }
    return {
      path: "/login",
      query: {
        reason: "authentication_required",
        redirect: retiredTarget?.fullPath ?? to.fullPath,
      },
    };
  };
}
