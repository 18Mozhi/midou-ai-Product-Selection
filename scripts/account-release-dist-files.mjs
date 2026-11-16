import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

// tsc does not remove outputs for renamed or deleted source files.
const outputs = {};
for (const group of ["apps", "packages"]) {
  for (const entry of readdirSync(group, { withFileTypes: true })) {
    if (!entry.isDirectory() || (group === "apps" && entry.name === "web")) continue;
    const workspace = `${group}/${entry.name}`;
    if (!existsSync(`${workspace}/package.json`)) continue;
    const config = path.resolve(workspace, "tsconfig.json");
    const project = ts.getParsedCommandLineOfConfigFile(
      config,
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: ({ code }) => {
          throw new Error(`account_release_dist_config_invalid:${workspace}:${code}`);
        },
      },
    );
    const dist = path.resolve(workspace, "dist");
    if (
      !project ||
      project.errors.length ||
      !project.options.outDir ||
      path.relative(dist, project.options.outDir) !== ""
    )
      throw new Error(`account_release_dist_config_invalid:${workspace}`);
    const files = new Set();
    for (const source of project.fileNames) {
      for (const output of ts.getOutputFileNames(
        project,
        source,
        !ts.sys.useCaseSensitiveFileNames,
      )) {
        const relative = path.relative(dist, output).split(path.sep).join("/");
        if (!/\.(?:js|cjs|mjs|d\.ts|d\.cts|d\.mts)$/.test(relative)) continue;
        if (!relative || relative.startsWith("../") || path.isAbsolute(relative))
          throw new Error(`account_release_dist_output_outside_workspace:${workspace}`);
        files.add(relative);
      }
    }
    if (!files.size) throw new Error(`account_release_dist_outputs_empty:${workspace}`);
    outputs[workspace] = [...files].sort();
  }
}
process.stdout.write(JSON.stringify(outputs));
