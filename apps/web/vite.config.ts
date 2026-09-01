import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? process.env.APP_PORT ?? 4101);
const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 5173);
const internalSurfaceDeclarations = [
  /const VerificationFramework = import\.meta\.env\.DEV\s*\? defineAsyncComponent\(\(\) => import\("\.\/components\/VerificationFramework\.vue"\)\)\s*: null;/u,
  /const UiStateShowcase = import\.meta\.env\.DEV\s*\? defineAsyncComponent\(\(\) => import\("\.\/components\/UiStateShowcase\.vue"\)\)\s*: null;/u,
];

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
          for (const declaration of internalSurfaceDeclarations)
            transformed = transformed.replace(declaration, (value) =>
              value.startsWith("const VerificationFramework")
                ? "const VerificationFramework = null;"
                : "const UiStateShowcase = null;",
            );
          if (
            transformed === source ||
            transformed.includes("./components/UiStateShowcase.vue") ||
            transformed.includes("./components/VerificationFramework.vue")
          )
            throw new Error("internal_surface_production_strip_contract_missing");
          return transformed;
        },
        generateBundle(_options, bundle) {
          for (const [fileName, output] of Object.entries(bundle)) {
            if (
              output.type === "chunk" &&
              output.facadeModuleId &&
              /\/components\/(?:UiStateShowcase|VerificationFramework)\.vue$/u.test(
                output.facadeModuleId.replaceAll("\\", "/"),
              )
            )
              delete bundle[fileName];
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
