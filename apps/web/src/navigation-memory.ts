let lastMemberRoute = "/home";
let recentOrganizationIds: string[] = [];

export function rememberMemberRoute(path: string) {
  if (path.startsWith("/") && !path.startsWith("//")) lastMemberRoute = path;
}

export function getLastMemberRoute() {
  return lastMemberRoute;
}

export function rememberOrganization(organizationId: string) {
  recentOrganizationIds = [
    organizationId,
    ...recentOrganizationIds.filter((id) => id !== organizationId),
  ].slice(0, 5);
  return [...recentOrganizationIds];
}

export function getRecentOrganizationIds() {
  return [...recentOrganizationIds];
}
