import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("M07-03.A01-A05 manifest freezes fixed Node and Python BaoTa targets and healthy state", async () => {
  const manifest = JSON.parse(await read("infra/baota/service-manifest.json"));
  assert.equal(manifest.schemaVersion, 4);
  assert.equal(manifest.productionDeployed, true);
  assert.equal(manifest.deploymentStatus, "healthy");
  assert.equal(manifest.target.deployRoot, "/www/wwwroot/ai选品");
  assert.deepEqual(manifest.target.privatePorts, [4101, 3306, 6379]);
  const nodeProjects = manifest.objects.filter((item) => item.kind === "baota-node-project");
  assert.equal(nodeProjects.length, 1);
  assert.equal(nodeProjects[0].name, "ai选品");
  assert.match(nodeProjects[0].startCommand, /^node --env-file=/);
  assert.equal(nodeProjects[0].workingDirectory, "/www/wwwroot/ai选品/backend");
  assert.equal(nodeProjects[0].processMode, "foreground");
  const pythonProjects = manifest.objects.filter((item) => item.kind === "baota-python-project");
  assert.equal(pythonProjects.length, 1);
  assert.equal(pythonProjects[0].workingDirectory, "/www/wwwroot/ai选品/python");
  assert.equal(
    manifest.objects.find((item) => item.name === "ai选品网站").workingDirectory,
    "/www/wwwroot/ai选品/frontend",
  );
});

test("M07-03.A06-A11 site, runtime, permission, config and logging contracts fail closed", async () => {
  const manifest = JSON.parse(await read("infra/baota/service-manifest.json"));
  const nginx = await read("infra/baota/nginx/scoutops.conf.template");
  assert.match(nginx, /server_name midouai\.medouai\.com/);
  assert.match(nginx, /location \/open\//);
  assert.match(nginx, /location \/api\/v1\/realtime\/events[\s\S]*proxy_buffering off/);
  assert.match(nginx, /include \/www\/wwwroot\/ai选品\/config\/nginx-spa-routes\.conf/);
  assert.match(nginx, /error_page 404 \/index\.html/);
  assert.match(nginx, /try_files \$uri \$uri\/ =404/);
  assert.doesNotMatch(nginx, /try_files \$uri \$uri\/ \/index\.html/);
  for (const name of ["ai选品", "ai选品数据库", "ai选品缓存"])
    assert.equal(manifest.objects.find((item) => item.name === name).public, false);
  assert.deepEqual(manifest.restrictedConfig.browserAllowlist, ["VITE_API_BASE_URL"]);
  assert.ok(manifest.logging.forbiddenFields.includes("master_key"));
});

test("M07-03.A12-A16 preflight always passes and production evidence is opt-in", () => {
  const preflight = spawnSync(
    process.execPath,
    ["scripts/verify-baota-deployment.mjs", "--preflight"],
    { encoding: "utf8" },
  );
  assert.equal(preflight.status, 0, preflight.stderr);
  assert.equal(JSON.parse(preflight.stdout).production_deployed, true);
  if (process.env.SCOUTOPS_REQUIRE_PRODUCTION_EVIDENCE !== "1") return;
  const production = spawnSync(
    process.execPath,
    ["scripts/verify-baota-deployment.mjs", "--production"],
    { encoding: "utf8" },
  );
  assert.equal(production.status, 0, production.stderr);
  assert.equal(JSON.parse(production.stdout).status, "passed");
});

test("M07-03 deployer runs source and built-artifact gates before remote credentials", async () => {
  const deployer = await readFile("scripts/deploy-baota.py", "utf8");
  assert.match(
    deployer,
    /verify_local_source_preflight[\s\S]*format:check[\s\S]*verify:runtime-docs[\s\S]*verify:release-matrix/,
  );
  assert.match(
    deployer,
    /def build_package[\s\S]*npm_executable\(\), "run", "build"[\s\S]*verify_local_build_preflight/,
  );
  const main = deployer.slice(deployer.indexOf("def main()"));
  assert.ok(
    main.indexOf("verify_local_source_preflight(repo)") <
      main.indexOf("release_source_identity(repo)"),
  );
  assert.ok(main.indexOf("build_package(") < main.indexOf("read_windows_credential()"));
  assert.match(deployer, /verify-baota-deployment\.mjs", "--preflight"/);
  assert.match(deployer, /config \/ "nginx-spa-routes\.conf"/);
  assert.match(deployer, /route\.get\("acceptance"\) == "fallback"/);
  assert.match(deployer, /nginx", "-t"/);
  assert.match(deployer, /unknown_route_status == 404/);
});

test("M07-03.A17 docs, OpenAPI, Feature Map and evidence schema stay synchronized", async () => {
  const all = (
    await Promise.all(
      [
        "docs/openapi.yaml",
        "docs/feature-map.json",
        "docs/architecture/m07-03-baota-deployment.md",
        "docs/runbooks/m07-03-baota-deployment.md",
        "verification/baota-production-evidence.schema.json",
      ].map(read),
    )
  ).join("\n");
  for (const token of [
    "M07-03",
    "192.168.1.220",
    "midouai.medouai.com",
    "productionDeployed",
    "healthy",
    "宝塔",
    "回滚",
  ])
    assert.match(all, new RegExp(token.replaceAll(".", "\\.")));
  assert.match(all, /"runtime"[\s\S]*"python"/);
});
