"""Exact Cookie-only overlay; no database migration or Python operation."""
import base64
import hashlib
import runpy
import subprocess
import tempfile
import zlib
from pathlib import Path

RUNTIME_BASE = "1b622274a6871d9d1ac3986223359b539a82aa76"
SOURCE_BASE = "e670d019fed4799178c7a9e117e842cb5ffff3fa"
COOKIE_PARENT = "fdaeda58abd6973c61044329461559bdf8c581ce"
COOKIE_FEATURE = "e24552f49d2bf6095586f7d903a0933c357f65b7"
ENGINE = "packages/playwright-crawler/dist/index.js"
BASE_HASHES = {'apps/api/dist/amazon-public-browser-health.js': '7969cb57ac7b6c978fc42eaa11b3c1a04839b67b1d121e0b5dafc10d5b3a16fd', 'apps/api/dist/credential-asset-routes.js': '22a42b57a5b66375cf932d620d3adc1b757746358c9f261fa16d739d8ddc2ccc', 'apps/api/dist/credential-asset-service.js': '921611f2cd16684673a4560d7fa4c5fa999bbdda665452af911c3de40f746502', 'apps/api/dist/mysql-credential-asset-repository.js': '34391b7604c8ee33d3d84c3a79baaff83af53aec7b670660ac99af435786ceb6', 'apps/api/dist/mysql-crawler-runtime-repository.js': 'd21ed7dccb7b8b989359473f280530b5f644e431ffec259b8d9aae12a3dc78aa', 'apps/api/dist/server.js': 'a98d79d8c5922c1c23af68bab21a8b588e1e038d8b6329a575a7edaef5f9e66d', 'packages/playwright-crawler/dist/index.js': '281f1e129d7f195e8a8a02efd795611d57fa18060ef8a64ba4c733170ea32708', 'scripts/run-playwright-crawler.mjs': '5f37f82adeb9bececa6f679d55991ebeffdb09567851a7925d05521e66427a24', 'apps/api/dist/amazon-cookie-session-service.js': None, 'packages/playwright-crawler/dist/amazon-administrator-session.js': None}

PROTECTED_HASHES = {'backend/packages/playwright-crawler/dist/amazon-delivery-context.js': '94a06bae3395056e8a438cc9cee2f380c759f72ffe5b9bcdefa48a969a7fd306', 'backend/packages/playwright-crawler/dist/public-http-transport.js': '8414c831da0ef0409212157028c69d9d78ad6cea4a58633b25edc15739c733e1', 'backend/packages/provider-sources/dist/index.js': '26d4531235632a1fcb837020a80b061d10fdfffc778a3a67e37751d8a1a77354', 'backend/apps/worker/dist/queue-scheduler.js': '7593ebd43e2da78148de0342b1c41c3e7a20df7057619d88bad9120c19849c58', 'backend/apps/worker/dist/worker-queue-registry.js': '81a51e4891a38f0d040fe44ba64a393f16f467244e16921b4b16d98759178785', 'backend/apps/worker/dist/trend-projection-account-queue.js': '5d46cfb0a50aac48b7c5893d64fa7ce3dc6a4ecc4d3c14694653d12dd0f0cbea', 'python/scoutops_crawler/public_http.py': 'efcf9127fbb85a648d9e59128dcf929727d012b566f72bc3e29eb24ffe32d7e2'}

def validate_changes(names):
    exact = {n.replace("/dist/", "/src/").removesuffix(".js") + ".ts"
             for n in BASE_HASHES if not n.startswith("scripts/")}
    exact |= {"scripts/run-playwright-crawler.mjs", "config/env.example",
              "packages/playwright-crawler/src/amazon-delivery-context.ts",
              "apps/web/src/components/AmazonCookieSessionControl.vue",
              "apps/web/src/components/CredentialAssetCenter.vue",
              "scripts/deploy-account-baota.py", "scripts/baota-account-trend-release.py",
              "scripts/baota-account-static-release.py", "scripts/baota-amazon-cookie-release.py"}
    if any(n not in exact and not n.startswith(("docs/", "tests/")) for n in names):
        raise RuntimeError("account_release_cookie_unrelated_runtime_change")

def prepare(root, manifest, read_file):
    if tuple(manifest) != tuple(BASE_HASHES):
        raise RuntimeError("account_release_cookie_manifest_changed")
    replacements = {}
    for name, (before, encoded, after) in manifest.items():
        if before != BASE_HASHES[name]:
            raise RuntimeError("account_release_cookie_baseline_unpinned")
        path = root / "backend" / name
        if before is None:
            if path.exists() or path.is_symlink():
                raise RuntimeError("account_release_cookie_new_module_already_exists")
        elif hashlib.sha256(read_file(path, 131072)).hexdigest() != before:
            raise RuntimeError("account_release_cookie_live_module_drift")
        value = zlib.decompress(base64.b64decode(encoded, validate=True))
        if not 0 < len(value) <= 131072 or hashlib.sha256(value).hexdigest() != after or before == after:
            raise RuntimeError("account_release_cookie_payload_invalid")
        replacements[path] = (value, before, after)
    protected = {}
    for name, digest in PROTECTED_HASHES.items():
        path = root / name
        value = read_file(path, 131072)
        if hashlib.sha256(value).hexdigest() != digest:
            raise RuntimeError("account_release_cookie_protected_module_drift")
        protected[path] = value
    return replacements, protected

def engine_overlay(repo):
    source = "packages/playwright-crawler/src/index.ts"
    # Apply only the explicitly authorized Cookie commit to the proven live
    # source. Do NOT publish the unrelated, undeployed daily-cache refresh fix.
    with tempfile.TemporaryDirectory(prefix="scoutops-cookie-engine-") as directory:
        root = Path(directory)
        path = root / source
        path.parent.mkdir(parents=True)
        path.write_bytes(subprocess.check_output(["git", "show", SOURCE_BASE + ":" + source], cwd=repo))
        patch = subprocess.check_output(["git", "diff", COOKIE_PARENT, COOKIE_FEATURE, "--", source], cwd=repo)
        subprocess.run(["git", "apply", "--whitespace=error", "-"], input=patch, cwd=root, capture_output=True, check=True)
        return path.read_bytes()

def transpile(repo, source, name):
    code = """import ts from 'typescript';let s='';for await(const c of process.stdin)s+=c;
process.stdout.write(ts.transpileModule(s,{fileName:process.argv[1],compilerOptions:{
module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,sourceMap:true}}).outputText);"""
    return subprocess.run(["node", "--input-type=module", "-e", code, Path(name).name],
                          input=source, cwd=repo, capture_output=True, check=True).stdout

def manifest_for(repo, sha):
    output = {}
    for name, before in BASE_HASHES.items():
        src = name if name.startswith("scripts/") else name.replace("/dist/", "/src/").removesuffix(".js") + ".ts"
        source = engine_overlay(repo) if name == ENGINE else subprocess.check_output(["git", "show", sha + ":" + src], cwd=repo)
        value = source if name.startswith("scripts/") else transpile(repo, source, src)
        if before is not None:
            old_source = subprocess.check_output(["git", "show", SOURCE_BASE + ":" + src], cwd=repo)
            old = old_source if name.startswith("scripts/") else transpile(repo, old_source, src)
            if hashlib.sha256(old).hexdigest() != before:
                raise RuntimeError("account_release_cookie_source_baseline_drift")
        if not 0 < len(value) <= 131072:
            raise RuntimeError("account_release_cookie_payload_size")
        output[name] = (before, base64.b64encode(zlib.compress(value)).decode(), hashlib.sha256(value).hexdigest())
    return output

def execute_remote(ssh, deploy, source):
    # Same fixed SSH host/identity and authoritative sentinel; avoid argv size
    # limits without weakening any runtime/path/hash/drain gate.
    if deploy["PANEL_PYTHON"] != "/www/server/panel/pyenv/bin/python" or len(source.encode("utf-8")) > 2 * 1024 * 1024:
        raise RuntimeError("account_release_cookie_transport_size_or_identity")
    stdin, stdout, stderr = ssh.exec_command(deploy["PANEL_PYTHON"] + " -B -", timeout=400)
    stdin.write(source)
    stdin.channel.shutdown_write()
    output = stdout.read().decode("utf-8")
    error = stderr.read()
    status = stdout.channel.recv_exit_status()
    lines = [line[len("SCOUTOPS_RESULT="):] for line in output.splitlines() if line.startswith("SCOUTOPS_RESULT=")]
    if status or error or len(lines) != 1:
        raise RuntimeError("account_release_cookie_remote_response_unverified")
    import json
    result = json.loads(lines[0])
    if not isinstance(result, dict) or type(result.get("status")) is not bool:
        raise RuntimeError("account_release_cookie_remote_response_unverified")
    return result

def publish(repo, deploy, ssh_connection, transfer, frontend_only=False):
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=repo).decode().strip()
    sha = git("rev-parse", "HEAD")
    if (git("status", "--porcelain") or
        deploy["normalize_github_repository"](git("remote", "get-url", "origin")).lower() != deploy["EXPECTED_GITHUB_REPOSITORY"].lower() or
        git("ls-remote", "--exit-code", "origin", "refs/heads/main") != sha + "\trefs/heads/main"):
        raise RuntimeError("account_release_cookie_requires_clean_approved_main")
    deploy["verify_production_sha_history"](repo, RUNTIME_BASE, sha)
    validate_changes(git("diff", "--name-only", SOURCE_BASE, sha).splitlines())
    manifest = manifest_for(repo, sha)
    if git("rev-parse", "HEAD") != sha or git("status", "--porcelain"):
        raise RuntimeError("account_release_cookie_source_changed")
    scripts = repo / "scripts"
    args = (deploy["PROJECT_ROOT"], RUNTIME_BASE, BASE_HASHES[ENGINE], sha, "", hashlib.sha256(b"").hexdigest(),
            None, False, None, manifest, "administrator_cookie")
    source = "trend=" + repr((scripts / "baota-account-trend-release.py").read_text(encoding="utf-8")) + \
        "\ncookie=" + repr(Path(__file__).read_text(encoding="utf-8")) + \
        "\ndrain_code=" + repr((scripts / "baota-account-claim-drain.py").read_text(encoding="utf-8")) + \
        "\nargs=" + repr(args) + "\nnode=" + repr(deploy["NODE_BIN"]) + r'''
import json
ns={"__name__":"cookie_trend"};exec(compile(trend,"cookie_trend","exec"),ns)
cs={"__name__":"cookie_release"};exec(compile(cookie,"cookie_release","exec"),cs)
ds={"__name__":"cookie_drain"};exec(compile(drain_code,"cookie_drain","exec"),ds)
ns["prepare_administrator_cookie"]=cs["prepare"]
drain=ds["BaselineClaimDrain"](ns["Path"](args[0]),node)
try:
 result=ns["install_with_claim_drain"](ns["install"],args,drain)
 result["drain_samples"]=drain.samples
except Exception as error:
 result={"status":False,"phase":ns["MODULE_PHASE"],"message":ns["MODULE_PHASE"]+":"+ns["release_error_code"](error),"drain_samples":drain.samples}
print("SCOUTOPS_RESULT="+json.dumps(result))
'''
    installed = {"status": True, "restarted": False, "skipped": "frontend_only"}
    if not frontend_only:
        with ssh_connection(deploy) as ssh:
            installed = execute_remote(ssh, deploy, source)
        if not installed.get("status"):
            return {"status": False, "node": installed}
    static = runpy.run_path(str(scripts / "baota-account-static-release.py"))
    front = static["deploy_static"](repo, RUNTIME_BASE, deploy, ssh_connection, transfer,
        {"administrator_cookie": {n: v[2] for n,v in manifest.items()},
         "validate": validate_changes, "source_base": SOURCE_BASE})
    return {"status": bool(front.get("status")), "node": installed, "frontend": front}
