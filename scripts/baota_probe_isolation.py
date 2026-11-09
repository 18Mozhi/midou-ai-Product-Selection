"""Finite reverse-loopback transport for destructive verification fixtures."""

from contextlib import contextmanager
import json
import re
import select
import shlex
import socket
from threading import Event, Thread


def isolation_config(env):
    token = env.get("VERIFY_ISOLATION_ID", "")
    if not re.fullmatch("[a-f0-9]{32}", token):
        raise ValueError("missing dedicated fixture isolation marker")
    config = {"token": token}
    for prefix, standard in (("DB", 3306), ("REDIS", 6379)):
        raw_port = env.get(f"{prefix}_PORT", "")
        if (
            env.get(f"{prefix}_HOST") != "127.0.0.1"
            or not re.fullmatch("[0-9]{4,5}", raw_port)
            or not 1024 < int(raw_port) < 65536
            or int(raw_port) == standard
        ):
            raise ValueError("fixture service must use an explicit non-default loopback port")
        password = env.get(f"{prefix}_PASSWORD", "")
        if len(password) < 24:
            raise ValueError("isolated fixture requires a generated password")
        config[prefix] = {"port": int(raw_port), "password": password}
    if (
        config["DB"]["port"] == config["REDIS"]["port"]
        or env.get("DB_NAME") != "product_scout"
        or env.get("DB_USER") != "product_scout"
        or env.get("DB_READ_HOST")
        or env.get("DB_WRITE_HOST")
    ):
        raise ValueError("fixture must use the standalone MySQL business schema and account")
    return config


@contextmanager
def loopback_forwards(transport, target_ports):
    done = Event()
    destinations = {}

    def pump(channel, target_port):
        try:
            with socket.create_connection(("127.0.0.1", target_port), timeout=5) as target:
                target.settimeout(15)
                channel.settimeout(15)
                while not done.is_set():
                    readable, _, _ = select.select([target, channel], [], [], 0.5)
                    for source in readable:
                        data = source.recv(65536)
                        if not data:
                            return
                        (channel if source is target else target).sendall(data)
        except (EOFError, OSError):
            pass
        finally:
            channel.close()

    def accept(channel, _origin, listener):
        target_port = destinations.get(listener[1])
        if done.is_set() or target_port is None:
            channel.close()
        else:
            Thread(target=pump, args=(channel, target_port), daemon=True).start()

    try:
        # Paramiko keeps one handler per transport, not one per forward.
        for target_port in target_ports:
            port = transport.request_port_forward("127.0.0.1", 0, accept)
            destinations[port] = target_port
            if not isinstance(port, int) or not 1024 < port < 65536 or port in (3306, 6379):
                raise RuntimeError("invalid remote fixture listener")
        if len(destinations) != len(target_ports):
            raise RuntimeError("duplicate remote fixture listener")
        yield tuple(destinations)
    finally:
        done.set()
        for port in reversed(destinations):
            transport.cancel_port_forward("127.0.0.1", port)


def isolated_probe_payload(backend, node_bin, target_var, source, config, db_port, redis_port):
    # Send fixture credentials only via stdin; no production env file is loaded.
    # Only the attested connections are available to code loading after this gate.
    loader = r"""
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const input = JSON.parse(readFileSync(0, "utf8"));
const root = await mkdtemp(join(process.cwd(), "../runtime/tmp/scoutops-probe-"));
let db, redis;
try {
  Object.assign(process.env, input.env, {
    TMPDIR: root, TEMP: root, TMP: root,
    RUNTIME_TMP_ROOT: join(root, "runtime"), CREDENTIAL_TEMP_ROOT: join(root, "credentials"),
    EVIDENCE_ROOT: join(root, "evidence"), EXPORT_ROOT: join(root, "exports"),
    REPORT_EXPORT_ROOT: join(root, "reports"),
  });
  const load = (name) => import(pathToFileURL(join(process.cwd(), "packages", name, "dist/index.js")).href);
  const [{loadRuntimeConfig},{createDatabasePool},{createRedisProbeConnection}] =
    await Promise.all([load("config"),load("database"),load("redis")]);
  const config = loadRuntimeConfig(process.env, "api");
  db = createDatabasePool(config);
  redis = createRedisProbeConnection(config);
  redis.on("error", () => {});
  const [[identity]] = await db.query("SELECT VERSION() v, DATABASE() db, CURRENT_USER() account");
  const [markers] = await db.execute("SELECT name FROM schema_migrations WHERE name=?", ["scoutops-isolated-"+input.marker]);
  await redis.connect();
  const redisMarker = await redis.get("scoutops:verify-isolation:"+input.marker);
  if (!String(identity.v).startsWith("5.7.") || identity.db!=="product_scout" ||
      !String(identity.account).startsWith("product_scout@") || markers.length!==1 ||
      redisMarker!==input.marker) throw Error("fixture store attestation failed");
  await db.end(); db = null;
  await redis.quit(); redis = null;
  process.env.VERIFY_ISOLATION_ID = input.marker;
  console.log(JSON.stringify({status:"passed",fixture_isolation:"ssh_reverse_loopback_attested",production_queue:false}));
  await import("data:text/javascript;base64,"+Buffer.from(input.source,"utf8").toString("base64"));
} finally {
  try { if (db) await db.end(); }
  finally {
    try { if (redis?.isOpen) await redis.quit(); }
    finally { await rm(root,{recursive:true,force:true}); }
  }
}
"""
    env = {
        "NODE_ENV": "test",
        "DB_HOST": "127.0.0.1",
        "DB_PORT": str(db_port),
        "DB_NAME": "product_scout",
        "DB_USER": "product_scout",
        "DB_PASSWORD": config["DB"]["password"],
        "REDIS_HOST": "127.0.0.1",
        "REDIS_PORT": str(redis_port),
        "REDIS_PASSWORD": config["REDIS"]["password"],
        "AI_BASE_URL": "http://127.0.0.1:1/v1",
        target_var: "local",
    }
    command = (
        f"cd {shlex.quote(backend)} && env -i PATH=/usr/bin:/bin "
        f"{shlex.quote(node_bin)} --input-type=module -e {shlex.quote(loader)}"
    )
    return command, json.dumps({"env": env, "marker": config["token"], "source": source})


def run_isolated_probe(client, backend, node_bin, target_var, source, config):
    transport = client.get_transport()
    with loopback_forwards(transport, (config["DB"]["port"], config["REDIS"]["port"])) as ports:
        # An sshd GatewayPorts policy can widen a requested bind; verify the
        # server's actual addresses before sending fixture credentials.
        _, listeners, _ = client.exec_command("ss -H -lnt", timeout=15)
        rows = [line.split() for line in listeners.read().decode("utf-8").splitlines()]
        if listeners.channel.recv_exit_status() != 0:
            raise RuntimeError("cannot verify remote fixture listener addresses")
        for port in ports:
            addresses = [row[3] for row in rows if len(row) >= 5 and row[3].endswith(f":{port}")]
            if addresses != [f"127.0.0.1:{port}"]:
                raise RuntimeError("remote fixture listener is not loopback-only")
        command, payload = isolated_probe_payload(
            backend, node_bin, target_var, source, config, *ports
        )
        stdin, stdout, stderr = client.exec_command(command, timeout=120)
        stdin.write(payload)
        stdin.flush()
        stdin.channel.shutdown_write()
        output = stdout.read().decode("utf-8", "replace")
        errors = stderr.read().decode("utf-8", "replace")
        status = stdout.channel.recv_exit_status()
        data_url = r"data:text/javascript;base64,[A-Za-z0-9+/=]+"
        output = re.sub(data_url, "<isolated-probe>", output)
        errors = re.sub(data_url, "<isolated-probe>", errors)
        # Even an unexpected runtime error must not expose fixture credentials.
        for item in (config["DB"]["password"], config["REDIS"]["password"]):
            output, errors = output.replace(item, "[REDACTED]"), errors.replace(item, "[REDACTED]")
        return status, output, errors
