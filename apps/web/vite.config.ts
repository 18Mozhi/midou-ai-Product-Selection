import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? process.env.APP_PORT ?? 4101);
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 5173);
const internalSurfaceNames = [
  "VerificationFramework",
  "UiStateShowcase",
  "ConfigBoundary",
  "RedisFoundation",
  "MySqlFoundation",
  "ApiFoundation",
  "FileAuditFoundation",
  "DeploymentFoundation",
];
const internalSurfaceDeclarations = internalSurfaceNames.map((name) => ({
  name,
  declaration: new RegExp(
    `const ${name} = import\\.meta\\.env\\.DEV\\s*\\? (?:defineAsyncComponent|asyncSurface)\\(\\(\\) => import\\("\\./components/${name}\\.vue"\\)\\)\\s*: null;`,
    "u",
  ),
}));

export default defineConfig(({ command, mode }) => {
  const productionBuild = command === "build" && mode !== "development";
  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    plugins: [
      productionBuild && {
        name: "scoutops-strip-internal-surfaces",
        enforce: "pre",
        transform(source, id) {
          if (!id.replaceAll("\\", "/").endsWith("/src/App.vue")) return null;
          let transformed = source;
          for (const { name, declaration } of internalSurfaceDeclarations) {
            if (!declaration.test(transformed))
              throw new Error(`internal_surface_production_strip_contract_missing:${name}`);
            transformed = transformed.replace(declaration, `const ${name} = null;`);
            if (transformed.includes(`./components/${name}.vue`))
              throw new Error(`internal_surface_production_import_remaining:${name}`);
          }
          return transformed;
        },
        generateBundle(_options, bundle) {
          for (const output of Object.values(bundle)) {
            if (
              output.type === "chunk" &&
              output.facadeModuleId &&
              internalSurfaceNames.some((name) =>
                output.facadeModuleId!.replaceAll("\\", "/").endsWith(`/components/${name}.vue`),
              )
            )
              throw new Error(
                `internal_surface_production_chunk_remaining:${output.facadeModuleId}`,
              );
          }
        },
      },
      vue(),
    ],
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      host: "127.0.0.1",
      port: webPort,
      proxy: {
        "/api": `http://127.0.0.1:${apiPort}`,
      },
    },
  };
});
