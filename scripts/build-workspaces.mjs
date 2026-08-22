import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { access, readdir, readFile } from "node:fs/promises";

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

async function workspaceDirectories(root, patterns) {
  const directories = [];
  for (const pattern of patterns) {
    if (!pattern.endsWith("/*")) throw new Error(`unsupported_workspace_pattern:${pattern}`);
    const parent = resolve(root, pattern.slice(0, -2));
    const entries = await readdir(parent, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const directory = join(parent, entry.name);
      try {
        await access(join(directory, "package.json"));
        directories.push(directory);
      } catch {
        // Workspace globs may also contain non-Node runtimes such as apps/crawler.
      }
    }
  }
  return directories.sort();
}

export function topologicalLevels(nodes) {
  const byName = new Map(nodes.map((node) => [node.name, node]));
  const completed = new Set();
  const levels = [];
  while (completed.size < nodes.length) {
    const ready = nodes
      .filter(
        (node) =>
          !completed.has(node.name) &&
          node.dependencies.every((dependency) => completed.has(dependency)),
      )
      .sort((left, right) => left.script.localeCompare(right.script));
    if (!ready.length) {
      const blocked = nodes
        .filter((node) => !completed.has(node.name))
        .map(
          (node) =>
            `${node.name}->${node.dependencies.filter((item) => !completed.has(item)).join(",")}`,
        )
        .join(";");
      throw new Error(`workspace_dependency_cycle:${blocked}`);
    }
    levels.push(ready);
    for (const node of ready) completed.add(node.name);
  }
  for (const node of nodes)
    for (const dependency of node.dependencies)
      if (!byName.has(dependency))
        throw new Error(`workspace_dependency_missing:${node.name}:${dependency}`);
  return levels;
}

export async function loadWorkspaceBuildPlan(root = process.cwd()) {
  const rootPackage = await readJson(join(root, "package.json"));
  const directories = await workspaceDirectories(root, rootPackage.workspaces ?? []);
  const manifests = await Promise.all(
    directories.map(async (directory) => ({
      directory,
      manifest: await readJson(join(directory, "package.json")),
    })),
  );
  const workspaceNames = new Set(manifests.map(({ manifest }) => manifest.name));
  const nodes = manifests.map(({ directory, manifest }) => {
    const script = `build:${basename(directory)}`;
    if (!rootPackage.scripts?.[script])
      throw new Error(`workspace_build_script_missing:${manifest.name}:${script}`);
    const dependencies = [
      ...new Set(
        dependencyFields
          .flatMap((field) => Object.keys(manifest[field] ?? {}))
          .filter((name) => workspaceNames.has(name)),
      ),
    ].sort();
    return { name: manifest.name, directory, script, dependencies };
  });
  return { nodes, levels: topologicalLevels(nodes) };
}

function runScript(root, node) {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const args = npmCli ? [npmCli, "run", node.script, "--silent"] : ["run", node.script, "--silent"];
  const startedAt = Date.now();
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        process.stdout.write(`[${node.script}] passed ${Date.now() - startedAt}ms\n`);
        resolvePromise();
        return;
      }
      if (stdout) process.stderr.write(`\n[${node.script}:stdout]\n${stdout}`);
      if (stderr) process.stderr.write(`\n[${node.script}:stderr]\n${stderr}`);
      rejectPromise(new Error(`workspace_build_failed:${node.script}:${code ?? "signal"}`));
    });
  });
}

async function runLevel(root, nodes, concurrency) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, nodes.length) }, async () => {
    while (cursor < nodes.length) {
      const node = nodes[cursor];
      cursor += 1;
      await runScript(root, node);
    }
  });
  await Promise.all(workers);
}

export async function runWorkspaceBuild(root = process.cwd()) {
  const plan = await loadWorkspaceBuildPlan(root);
  const concurrency = Math.max(1, Math.min(4, availableParallelism()));
  process.stdout.write(
    `workspace_build_plan levels=${plan.levels.length} workspaces=${plan.nodes.length} concurrency=${concurrency}\n`,
  );
  for (const [index, level] of plan.levels.entries()) {
    process.stdout.write(
      `workspace_build_level level=${index + 1} scripts=${level.map((node) => node.script).join(",")}\n`,
    );
    await runLevel(root, level, concurrency);
  }
  process.stdout.write(`workspace_build_passed workspaces=${plan.nodes.length}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runWorkspaceBuild().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
