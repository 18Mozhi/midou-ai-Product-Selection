import test from "node:test";
import assert from "node:assert/strict";
import { createServer, connect } from "node:net";
import { chromium } from "playwright";
import { createAuthenticatedBrowserProxy } from "../../packages/playwright-crawler/dist/authenticated-proxy.js";
import { installNavigationRequestTransport } from "../../packages/playwright-crawler/dist/navigation-transport.js";

test("private relay authenticates both hops, preserves opaque bytes, restricts targets and closes with its owner", async () => {
  const upstreamAuth = "Basic " + Buffer.from("fixture-user:fixture-password").toString("base64"),
    receipts = [],
    peers = new Set();
  let deny = false;
  const upstream = createServer((socket) => {
    peers.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => peers.delete(socket));
    let headers = "";
    const read = (chunk) => {
      headers += chunk.toString("latin1");
      if (!headers.includes("\r\n\r\n")) return;
      socket.off("data", read);
      const auth = /\r\nProxy-Authorization: ([^\r\n]+)/i.exec(headers)?.[1];
      receipts.push({ line: headers.split("\r\n")[0], auth });
      if (deny || auth !== upstreamAuth) {
        socket.end(
          "HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm=fixture\r\nContent-Length: 0\r\n\r\n",
        );
        return;
      }
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      socket.on("data", (data) => socket.write(data));
    };
    socket.on("data", read);
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  const statuses = [],
    relay = await createAuthenticatedBrowserProxy(
      {
        server: `http://127.0.0.1:${upstream.address().port}`,
        username: "fixture-user",
        password: "fixture-password",
        connectTimeoutMs: 1000,
      },
      (s) => statuses.push(s),
    );
  const u = new URL(relay.proxy.server),
    localAuth =
      "Basic " + Buffer.from(relay.proxy.username + ":" + relay.proxy.password).toString("base64");
  const tunnel = (authority, authorization = localAuth) =>
    new Promise((resolve, reject) => {
      const socket = connect({ host: "127.0.0.1", port: Number(u.port) });
      socket.on("error", reject);
      let headers = Buffer.alloc(0);
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("fixture connection timed out"));
      }, 3000);
      socket.once("connect", () =>
        socket.write(
          `CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\nProxy-Authorization: ${authorization}\r\n\r\n`,
        ),
      );
      const read = (data) => {
        headers = Buffer.concat([headers, data]);
        if (!headers.includes("\r\n\r\n")) return;
        clearTimeout(timer);
        socket.off("data", read);
        resolve({ socket, status: Number(/^HTTP\/1\.1 (\d{3})/.exec(headers.toString())?.[1]) });
      };
      socket.on("data", read);
    });
  try {
    const bad = await tunnel("www.amazon.com:443", "Basic wrong");
    assert.equal(bad.status, 407);
    bad.socket.destroy();
    assert.equal(receipts.length, 0);
    for (const target of [
      "127.0.0.1:443",
      "www.amazon.com.evil.test:443",
      "evilamazon.com:443",
      "www.amazon.com:80",
    ]) {
      const badTarget = await tunnel(target);
      assert.equal(badTarget.status, 403);
      badTarget.socket.destroy();
    }
    assert.equal(receipts.length, 0);
    const good = await tunnel("m.media-amazon.com:443");
    assert.equal(good.status, 200);
    const payload = Buffer.from([0x17, 3, 3, 0, 4, 200, 201, 202, 203]);
    const echoed = new Promise((r) => good.socket.once("data", r));
    good.socket.write(payload);
    assert.deepEqual(await echoed, payload);
    good.socket.destroy();
    assert.equal(receipts[0].auth, upstreamAuth);
    assert.notEqual(receipts[0].auth, localAuth);
    deny = true;
    const refused = await tunnel("www.amazon.com:443");
    assert.equal(refused.status, 502);
    refused.socket.destroy();
    assert.ok(statuses.includes(407));
  } finally {
    await relay.close();
    for (const peer of peers) peer.destroy();
    await new Promise((r) => upstream.close(r));
  }
});

test("real Chromium negotiates local proxy authentication and reaches the opaque upstream TLS boundary", async () => {
  const expected = "Basic " + Buffer.from("fixture-user:fixture-password").toString("base64"),
    receipts = [],
    peers = new Set();
  let tlsBytes = 0;
  const upstream = createServer((socket) => {
    peers.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => peers.delete(socket));
    let headers = "";
    const read = (data) => {
      headers += data.toString("latin1");
      if (!headers.includes("\r\n\r\n")) return;
      socket.off("data", read);
      receipts.push(/\r\nProxy-Authorization: ([^\r\n]+)/i.exec(headers)?.[1]);
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      socket.once("data", (data) => {
        tlsBytes += data.length;
        assert.equal(data[0], 0x16);
        socket.destroy();
      });
    };
    socket.on("data", read);
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  const relay = await createAuthenticatedBrowserProxy({
    server: `http://127.0.0.1:${upstream.address().port}`,
    username: "fixture-user",
    password: "fixture-password",
  });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, proxy: relay.proxy });
    for (const mode of ["browser", "request"]) {
      const before = receipts.length,
        context = await browser.newContext(),
        page = await context.newPage();
      if (mode === "request")
        await installNavigationRequestTransport(context, "https://www.amazon.com", 2000);
      await assert.rejects(page.goto("https://www.amazon.com/", { timeout: 5000 }));
      assert.ok(receipts.length > before, mode + " must reach the actual upstream tunnel");
      await context.close();
    }
    assert.ok(receipts.every((v) => v === expected));
    assert.ok(tlsBytes > 0);
  } finally {
    await browser?.close();
    await relay.close();
    for (const peer of peers) peer.destroy();
    await new Promise((r) => upstream.close(r));
  }
});
