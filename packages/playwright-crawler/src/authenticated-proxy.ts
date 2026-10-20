import { createServer } from "node:http";
import { connect, type Socket } from "node:net";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

const suffixes = [
  "amazon.com",
  "media-amazon.com",
  "ssl-images-amazon.com",
  "images-amazon.com",
  "amazon-adsystem.com",
];
const digest = (s: string) => createHash("sha256").update(s).digest();
const publicDnsName = (host: string) =>
  host.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host);
export function browserResourceHostname(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && publicDnsName(url.hostname) ? url.hostname : undefined;
  } catch {
    return undefined;
  }
}

/** Private per-run CONNECT relay. The browser gets only short-lived local
 * credentials. Existing upstream credentials are sent preemptively to the
 * configured HTTP proxy, never to a website or a browser page. TLS is opaque. */
export async function createAuthenticatedBrowserProxy(
  input: {
    server: string;
    username: string;
    password: string;
    connectTimeoutMs?: number;
  },
  report: (
    status: number,
    detail?: { hostname: string; reason: "target_not_allowed" | "upstream_response" },
  ) => void = () => {},
) {
  const upstream = new URL(input.server);
  if (
    upstream.protocol !== "http:" ||
    upstream.username ||
    upstream.password ||
    (upstream.pathname !== "/" && upstream.pathname !== "") ||
    upstream.search ||
    upstream.hash ||
    !input.username ||
    !input.password
  )
    throw new Error("browser_proxy_config_invalid");
  const username = randomUUID(),
    password = randomUUID(),
    localAuthorization = digest(
      "Basic " + Buffer.from(username + ":" + password).toString("base64"),
    ),
    upstreamAuthorization =
      "Basic " + Buffer.from(input.username + ":" + input.password).toString("base64"),
    clients = new Set<Socket>(),
    sockets = new Set<Socket>(),
    timeout = input.connectTimeoutMs ?? 5000;
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 10000)
    throw new Error("browser_proxy_timeout_invalid");
  const server = createServer((_request, response) => {
    response.writeHead(405);
    response.end();
  });
  server.headersTimeout = timeout;
  server.on("connection", (socket) => {
    if (clients.size >= 64) {
      socket.destroy();
      return;
    }
    clients.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => clients.delete(socket));
  });
  server.on("connect", (request, client, head) => {
    const reply = (code: number, auth = false) => {
      if (!client.destroyed)
        client.end(
          `HTTP/1.1 ${code} ${code === 200 ? "Connection Established" : "Proxy Connection Failed"}\r\n${auth ? 'Proxy-Authenticate: Basic realm="ScoutOps Browser", charset="UTF-8"\r\n' : ""}Connection: close\r\nContent-Length: 0\r\n\r\n`,
        );
    };
    if (
      !timingSafeEqual(digest(request.headers["proxy-authorization"] ?? ""), localAuthorization)
    ) {
      reply(407, true);
      return;
    }
    const match = /^([a-z0-9.-]{1,253}):443$/i.exec(request.url ?? ""),
      host = match?.[1]?.toLowerCase();
    if (!host || !suffixes.some((s) => host === s || host.endsWith("." + s))) {
      report(
        403,
        host && publicDnsName(host) ? { hostname: host, reason: "target_not_allowed" } : undefined,
      );
      reply(403);
      return;
    }
    const peer = connect({ host: upstream.hostname, port: Number(upstream.port || 80) });
    sockets.add(peer);
    peer.once("close", () => sockets.delete(peer));
    let pending = Buffer.alloc(0),
      established = false,
      finished = false;
    const timer = setTimeout(() => fail(504), timeout);
    const fail = (code: number) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      peer.destroy();
      reply(code);
    };
    client.once("close", () => {
      clearTimeout(timer);
      peer.destroy();
    });
    client.on("error", () => peer.destroy());
    peer.on("error", () => {
      if (!established) fail(502);
      else client.destroy();
    });
    peer.once("connect", () =>
      peer.write(
        `CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\nProxy-Authorization: ${upstreamAuthorization}\r\nProxy-Connection: Keep-Alive\r\n\r\n`,
      ),
    );
    const onData = (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      if (pending.length > 16384) {
        fail(502);
        return;
      }
      const end = pending.indexOf("\r\n\r\n");
      if (end < 0) return;
      const status = Number(/^HTTP\/1\.[01]\s+(\d{3})/.exec(pending.toString("latin1"))?.[1] ?? 0);
      report(status, { hostname: host, reason: "upstream_response" });
      if (status !== 200) {
        fail(502);
        return;
      }
      clearTimeout(timer);
      peer.off("data", onData);
      established = true;
      finished = true;
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) peer.write(head);
      const remainder = pending.subarray(end + 4);
      if (remainder.length) client.write(remainder);
      peer.pipe(client);
      client.pipe(peer);
      pending = Buffer.alloc(0);
      peer.once("end", () => client.end());
    };
    peer.on("data", onData);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("browser_proxy_listener_invalid");
  }
  let closed = false;
  return {
    proxy: { server: `http://127.0.0.1:${address.port}`, username, password },
    close: async () => {
      if (closed) return;
      closed = true;
      for (const socket of clients) socket.destroy();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
