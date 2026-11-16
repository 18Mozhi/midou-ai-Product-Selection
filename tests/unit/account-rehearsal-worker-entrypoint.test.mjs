import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

const run = promisify(execFile);
const worker = fileURLToPath(new URL("../../apps/worker/dist/index.js", import.meta.url));

test("the standard worker exits before connecting to a restored account rehearsal database or Redis", async (t) => {
  let connectionCount = 0;
  async function listen() {
    const server = createServer((socket) => {
      connectionCount++;
      socket.destroy();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => new Promise((resolve) => server.close(resolve)));
    return String(server.address().port);
  }
  const [dbPort, redisPort] = await Promise.all([listen(), listen()]);
  const systemEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => /^(systemroot|windir|path|temp|tmp)$/i.test(key)),
  );
  for (const DB_NAME of ["product_scout_scope_rehearsal", "PRODUCT_SCOUT_SCOPE_REHEARSAL"]) {
    await assert.rejects(
      run(process.execPath, [worker], {
        timeout: 10000,
        windowsHide: true,
        env: {
          ...systemEnv,
          NODE_ENV: "test",
          DB_NAME,
          DB_HOST: "127.0.0.1",
          DB_PORT: dbPort,
          REDIS_HOST: "127.0.0.1",
          REDIS_PORT: redisPort,
        },
      }),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /^Error: account_rehearsal_worker_disabled:/m);
        assert.equal(error.stdout, "");
        return true;
      },
    );
  }
  assert.equal(connectionCount, 0);
});
