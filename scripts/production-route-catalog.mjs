import { readFile } from "node:fs/promises";

export async function readRouteCatalogManifest(file = "config/route-catalog.json") {
  const manifest = JSON.parse(await readFile(file, "utf8"));
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.routes))
    throw new Error("route_catalog_schema_invalid");
  return manifest;
}

export async function readProtectedRouteCatalog(file = "config/route-catalog.json") {
  const manifest = await readRouteCatalogManifest(file);
  const routes = manifest.routes
    .filter((route) => route.acceptance === "protected")
    .map((route) => ({
      path: route.path,
      name: route.name,
      shell: route.shell,
      capabilities: [...route.capabilities],
      dynamic: route.path.includes(":"),
      resolver: route.productionResolver ?? null,
    }));
  const duplicates = routes.filter(
    (route, index) => routes.findIndex((candidate) => candidate.path === route.path) !== index,
  );
  if (duplicates.length)
    throw new Error(
      `duplicate_protected_routes:${duplicates.map((route) => route.path).join(",")}`,
    );
  return routes;
}

export function isRouteAuthorized(route, shell, capabilities) {
  if (route.shell !== shell) return false;
  const granted = new Set(capabilities);
  return (
    route.capabilities.length === 0 ||
    route.capabilities.some((capability) => granted.has(capability))
  );
}

export function authorizedRoutesFor(catalog, shell, capabilities) {
  return catalog.filter((route) => isRouteAuthorized(route, shell, capabilities));
}

export function roleRouteMatrix(catalog, shell, capabilities) {
  return catalog.map((route) => ({
    path: route.path,
    shell: route.shell,
    required_capabilities: [...route.capabilities],
    decision: isRouteAuthorized(route, shell, capabilities) ? "allow" : "deny",
  }));
}
