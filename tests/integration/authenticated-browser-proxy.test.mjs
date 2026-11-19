import test from "node:test";
import assert from "node:assert/strict";
import { createServer, connect } from "node:net";
import { chromium } from "playwright";
import {
  createAuthenticatedBrowserProxy,
  browserResourceHostname,
} from "../../packages/playwright-crawler/dist/authenticated-proxy.js";
import { installNavigationRequestTransport } from "../../packages/playwright-crawler/dist/navigation-transport.js";

test("resource diagnostics retain only bounded HTTPS DNS hostnames", () => {
  assert.equal(
    browserResourceHostname("https://user:password@www.amazon.com/path?token=secret#answer"),
    "www.amazon.com",
  );
  for (const value of [
    "not a URL",
    "http://www.amazon.com/path",
    "https://127.0.0.1/path",
    "https://[::1]/",
    "https://localhost/",
  ])
    assert.equal(browserResourceHostname(value), undefined);
});

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
    details = [],
    relay = await createAuthenticatedBrowserProxy(
      {
        server: `http://127.0.0.1:${upstream.address().port}`,
        username: "fixture-user",
        password: "fixture-password",
        connectTimeoutMs: 1000,
      },
      (s, detail) => {
        statuses.push(s);
        if (detail) details.push(detail);
      },
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
      "cloudfront.net:443",
      "other.cloudfront.net:443",
      "attacker.d2lbyuknrhysf9.cloudfront.net:443",
      "d2lbyuknrhysf9.cloudfront.net.evil.test:443",
    ]) {
      const badTarget = await tunnel(target);
      assert.equal(badTarget.status, 403);
      badTarget.socket.destroy();
    }
    assert.equal(receipts.length, 0);
    assert.ok(
      details.some((d) => d.hostname === "evilamazon.com" && d.reason === "target_not_allowed"),
    );
    assert.ok(!JSON.stringify(details).includes("127.0.0.1"));
    const good = await tunnel("m.media-amazon.com:443");
    assert.equal(good.status, 200);
    const payload = Buffer.from([0x17, 3, 3, 0, 4, 200, 201, 202, 203]);
    const echoed = new Promise((r) => good.socket.once("data", r));
    good.socket.write(payload);
    assert.deepEqual(await echoed, payload);
    good.socket.destroy();
    assert.equal(receipts[0].auth, upstreamAuth);
    assert.notEqual(receipts[0].auth, localAuth);
    const cdn = await tunnel("d2lbyuknrhysf9.cloudfront.net:443");
    assert.equal(cdn.status, 200);
    cdn.socket.destroy();
    deny = true;
    const refused = await tunnel("www.amazon.com:443");
    assert.equal(refused.status, 502);
    refused.socket.destroy();
    assert.ok(statuses.includes(407));
    assert.ok(
      details.some((d) => d.hostname === "www.amazon.com" && d.reason === "upstream_response"),
    );
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
    for (const mode of ["browser", "request", "observed_cdn"]) {
      const before = receipts.length,
        context = await browser.newContext(),
        page = await context.newPage();
      if (mode === "request")
        await installNavigationRequestTransport(context, "https://www.amazon.com", 2000);
      await assert.rejects(
        page.goto(
          mode === "observed_cdn"
            ? "https://d2lbyuknrhysf9.cloudfront.net/"
            : "https://www.amazon.com/",
          { timeout: 5000 },
        ),
      );
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

test("manual WAF allowance is exact, bounded and revokes existing tunnels without touching ordinary Amazon", async () => {
  const host = "1c5c1ecf7303.eb59107c.us-west-1.token.awswaf.com",
    peers = new Set();
  const upstream = createServer((socket) => {
    peers.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => peers.delete(socket));
    let header = "";
    const read = (data) => {
      header += data.toString("latin1");
      if (!header.includes("\r\n\r\n")) return;
      socket.off("data", read);
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    };
    socket.on("data", read);
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  const relay = await createAuthenticatedBrowserProxy({
    server: `http://127.0.0.1:${upstream.address().port}`,
    username: "fixture",
    password: "fixture",
  });
  const auth =
      "Basic " + Buffer.from(relay.proxy.username + ":" + relay.proxy.password).toString("base64"),
    port = Number(new URL(relay.proxy.server).port);
  const tunnel = (target) =>
    new Promise((resolve, reject) => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.on("error", reject);
      const timer = setTimeout(() => {
        socket.destroy();
        reject(Error("local fixture timeout"));
      }, 2000);
      let data = "";
      socket.once("connect", () =>
        socket.write(`CONNECT ${target} HTTP/1.1\r\nProxy-Authorization: ${auth}\r\n\r\n`),
      );
      const read = (b) => {
        data += b.toString("latin1");
        if (!data.includes("\r\n\r\n")) return;
        clearTimeout(timer);
        socket.off("data", read);
        resolve({ socket, status: Number(/^HTTP\/1.1 (\d{3})/.exec(data)?.[1]) });
      };
      socket.on("data", read);
    });
  const deny = async (target) => {
    const t = await tunnel(target);
    assert.equal(t.status, 403);
    t.socket.destroy();
  };
  try {
    await deny(host + ":443");
    for (const invalid of [NaN, Infinity, Date.now() - 1, Date.now() + 400000])
      assert.throws(() => relay.allowManualChallengeUntil(invalid), /expiry_invalid/);
    const ordinary = await tunnel("www.amazon.com:443");
    assert.equal(ordinary.status, 200);
    const revoke = relay.allowManualChallengeUntil(Date.now() + 2000);
    const manual = await tunnel(host + ":443");
    assert.equal(manual.status, 200);
    for (const bad of [
      host + ":80",
      "other.token.awswaf.com:443",
      "token.awswaf.com:443",
      "x." + host + ":443",
      host + ".evil.test:443",
      "127.0.0.1:443",
    ])
      await deny(bad);
    const closed = new Promise((r) => manual.socket.once("close", r));
    revoke();
    await closed;
    assert.equal(ordinary.socket.destroyed, false);
    await deny(host + ":443");
    ordinary.socket.destroy();
    relay.allowManualChallengeUntil(Date.now() + 200);
    const expiring = await tunnel(host + ":443");
    assert.equal(expiring.status, 200);
    await new Promise((r) => expiring.socket.once("close", r));
    await deny(host + ":443");
  } finally {
    await relay.close();
    for (const p of peers) p.destroy();
    await new Promise((r) => upstream.close(r));
  }
});
