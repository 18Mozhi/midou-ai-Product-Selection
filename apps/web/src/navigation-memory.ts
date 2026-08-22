const MEMBER_ROUTE_KEY = "scoutops:navigation:last-member-route";
const VALID_ROUTE_KEY = "scoutops:navigation:last-valid-route";
const RECENT_ORGANIZATIONS_KEY = "scoutops:navigation:recent-organizations";
const DEFAULT_MEMBER_ROUTE = "/home";

let lastMemberRoute = readRoute(MEMBER_ROUTE_KEY, DEFAULT_MEMBER_ROUTE);
let lastValidRoute = readRoute(VALID_ROUTE_KEY, DEFAULT_MEMBER_ROUTE);
let recentOrganizationIds = readStringArray(RECENT_ORGANIZATIONS_KEY);

function isSafeInternalRoute(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    void error;
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    void error;
  }
}

function readRoute(key: string, fallback: string) {
  const stored = readStorage(key);
  return isSafeInternalRoute(stored) ? stored : fallback;
}

function readStringArray(key: string) {
  try {
    const value = JSON.parse(readStorage(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, 5)
      : [];
  } catch (error) {
    void error;
    return [];
  }
}

export function rememberMemberRoute(path: string) {
  if (!isSafeInternalRoute(path)) return lastMemberRoute;
  lastMemberRoute = path;
  lastValidRoute = path;
  writeStorage(MEMBER_ROUTE_KEY, path);
  writeStorage(VALID_ROUTE_KEY, path);
  return lastMemberRoute;
}

export function getLastMemberRoute() {
  return lastMemberRoute;
}

export function rememberValidRoute(path: string) {
  if (!isSafeInternalRoute(path)) return lastValidRoute;
  lastValidRoute = path;
  writeStorage(VALID_ROUTE_KEY, path);
  return lastValidRoute;
}

export function getLastValidRoute() {
  return lastValidRoute;
}

export function rememberOrganization(organizationId: string) {
  recentOrganizationIds = [
    organizationId,
    ...recentOrganizationIds.filter((id) => id !== organizationId),
  ].slice(0, 5);
  writeStorage(RECENT_ORGANIZATIONS_KEY, JSON.stringify(recentOrganizationIds));
  return [...recentOrganizationIds];
}

export function getRecentOrganizationIds() {
  return [...recentOrganizationIds];
}
