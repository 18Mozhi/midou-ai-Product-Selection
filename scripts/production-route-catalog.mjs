import { readFile } from "node:fs/promises";
import ts from "typescript";

const SHELL_FACTORIES = new Map([
  ["member", "member"],
  ["organization", "organization_admin"],
  ["platform", "platform_admin"],
]);

const stringValue = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;

const stringArray = (node) => {
  if (!node) return [];
  if (!ts.isArrayLiteralExpression(node))
    throw new Error("route_capabilities_must_be_literal_array");
  const values = node.elements.map(stringValue);
  if (values.some((value) => value === null))
    throw new Error("route_capabilities_must_be_literal_strings");
  return values;
};

export async function readProtectedRouteCatalog(file = "apps/web/src/route-catalog.ts") {
  const sourceText = await readFile(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const routes = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const shell = SHELL_FACTORIES.get(node.expression.text);
      if (shell) {
        const path = stringValue(node.arguments[0]);
        if (!path) throw new Error(`route_path_must_be_literal:${node.expression.text}`);
        routes.push({
          path,
          shell,
          capabilities: stringArray(node.arguments[4]),
          dynamic: path.includes(":"),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const duplicates = routes.filter(
    (route, index) => routes.findIndex((candidate) => candidate.path === route.path) !== index,
  );
  if (duplicates.length) throw new Error(`duplicate_protected_routes:${duplicates.join(",")}`);
  return routes;
}

export function authorizedRoutesFor(catalog, shell, capabilities) {
  const granted = new Set(capabilities);
  return catalog.filter(
    (route) =>
      route.shell === shell &&
      (route.capabilities.length === 0 ||
        route.capabilities.some((capability) => granted.has(capability))),
  );
}
