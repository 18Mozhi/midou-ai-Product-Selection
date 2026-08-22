import { navigationItemsFor } from "./route-catalog";
import type { NavigationShellKind } from "./navigation-shell-route-state";

export interface NavigationGuardFacts {
  roles: string[];
  capabilities: string[];
  platform_roles: string[];
  platform_capabilities: string[];
}

export function shellCapabilities(shell: NavigationShellKind, guard: NavigationGuardFacts | null) {
  return shell === "platform_admin"
    ? (guard?.platform_capabilities ?? [])
    : (guard?.capabilities ?? []);
}

export function authorizedNavigation(shell: NavigationShellKind, capabilities: string[]) {
  return navigationItemsFor(shell).filter(
    (item) =>
      item.capabilities.length === 0 ||
      item.capabilities.some((capability) => capabilities.includes(capability)),
  );
}

export function canOpenRoute(required: string[], capabilities: string[]) {
  return required.length === 0 || required.some((capability) => capabilities.includes(capability));
}

export function shellRoleSummary(shell: NavigationShellKind, guard: NavigationGuardFacts | null) {
  const roles = shell === "platform_admin" ? guard?.platform_roles : guard?.roles;
  const labels: Record<string, string> = {
    member: "普通成员",
    selection_manager: "选品经理",
    procurement_member: "采购成员",
    organization_admin: "组织管理员",
    platform_operations_admin: "平台运营管理员",
    platform_security_admin: "平台安全管理员",
    platform_super_admin: "平台超级管理员",
    auditor: "审计员",
  };
  return roles?.length ? roles.map((role) => labels[role] ?? "已授权角色").join(" · ") : "当前角色";
}
