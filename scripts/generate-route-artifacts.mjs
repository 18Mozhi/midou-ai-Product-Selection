import { readFile, writeFile } from "node:fs/promises";
import { format, resolveConfig } from "prettier";

const sourceFile = "config/route-catalog.json";
const frontendArtifactFile = "apps/web/src/route-catalog.generated.json";
const featureMapFile = "docs/feature-map.json";
const write = process.argv.includes("--write");

const normalizeFeaturePath = (path) => path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}");

export function validateRouteCatalog(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest?.source !== sourceFile)
    throw new Error("route_catalog_schema_invalid");
  if (!Array.isArray(manifest.routes) || !Array.isArray(manifest.productionAcceptance?.roles))
    throw new Error("route_catalog_collections_missing");
  const paths = new Set();
  const names = new Set();
  for (const route of manifest.routes) {
    if (
      !route?.path?.startsWith("/") ||
      !route.name ||
      paths.has(route.path) ||
      names.has(route.name)
    )
      throw new Error(`route_catalog_identity_invalid:${route?.path ?? "unknown"}`);
    paths.add(route.path);
    names.add(route.name);
    if (!Array.isArray(route.breadcrumb) || !Array.isArray(route.capabilities))
      throw new Error(`route_catalog_arrays_invalid:${route.path}`);
    if (route.acceptance === "protected") {
      if (!["member", "organization_admin", "platform_admin"].includes(route.shell))
        throw new Error(`protected_route_shell_invalid:${route.path}`);
      if (!route.featureMap) throw new Error(`protected_route_feature_map_missing:${route.path}`);
      if (
        route.path.includes(":") &&
        (!route.productionResolver?.parentPath || !route.productionResolver?.pathPattern)
      )
        throw new Error(`dynamic_route_production_resolver_missing:${route.path}`);
      if (
        route.productionResolver?.resourceIdKey &&
        !route.path.includes(`:${route.productionResolver.resourceIdKey}`)
      )
        throw new Error(`dynamic_route_resource_id_key_invalid:${route.path}`);
    }
    if (route.featureMap && route.featureMap.path !== normalizeFeaturePath(route.path))
      throw new Error(`route_feature_path_mismatch:${route.path}`);
  }
  if (manifest.productionAcceptance.roles.length !== 6)
    throw new Error("production_acceptance_requires_six_roles");
  const roleKeys = new Set();
  for (const profile of manifest.productionAcceptance.roles) {
    if (
      !profile.key ||
      roleKeys.has(profile.key) ||
      !profile.role ||
      !profile.credentialPrefix ||
      !profile.landingPath ||
      !["member", "organization_admin", "platform_admin"].includes(profile.shell) ||
      !Array.isArray(profile.forbiddenCapabilities)
    )
      throw new Error(`production_acceptance_role_invalid:${profile?.key ?? "unknown"}`);
    roleKeys.add(profile.key);
  }
  return manifest;
}

export async function generatedArtifacts(manifest, featureMap) {
  const prettierConfig = (await resolveConfig(frontendArtifactFile)) ?? {};
  const normalizedManifest = await format(JSON.stringify(manifest), {
    ...prettierConfig,
    parser: "json",
  });
  return {
    [frontendArtifactFile]: normalizedManifest,
    [featureMapFile]: await format(
      JSON.stringify({
        ...featureMap,
        routeCatalogSource: "../config/route-catalog.json",
        routes: manifest.routes
          .filter((route) => route.featureMap)
          .map((route) => route.featureMap),
      }),
      { ...prettierConfig, parser: "json" },
    ),
  };
}

const manifest = validateRouteCatalog(JSON.parse(await readFile(sourceFile, "utf8")));
const featureMap = JSON.parse(await readFile(featureMapFile, "utf8"));
const artifacts = await generatedArtifacts(manifest, featureMap);
const drift = [];
for (const [file, expected] of Object.entries(artifacts)) {
  if (write) await writeFile(file, expected, "utf8");
  else if ((await readFile(file, "utf8").catch(() => "")) !== expected) drift.push(file);
}
if (drift.length) throw new Error(`route_artifacts_out_of_date:${drift.join(",")}`);
console.log(
  `route_artifacts_${write ? "generated" : "verified"} routes=${manifest.routes.length} protected=${manifest.routes.filter((route) => route.acceptance === "protected").length} roles=${manifest.productionAcceptance.roles.length}`,
);
