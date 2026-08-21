import { Agent as HttpsAgent, request as httpsRequest, type RequestOptions } from "node:https";
import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";
import type { Duplex } from "node:stream";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

export interface ProviderSourceProxyConfig {
  url: string;
  username: string;
  password: string;
  connectTimeoutMs: number;
}

type TunnelFetch = (
  url: URL,
  init: RequestInit | undefined,
  proxy: ProviderSourceProxyConfig,
) => Promise<Response>;

export interface ProviderSourceFetchDependencies {
  directFetch?: typeof fetch;
  tunnelFetch?: TunnelFetch;
}

class HttpConnectProxyAgent extends HttpsAgent {
  private readonly proxy: URL;
  private readonly authorization: string;

  constructor(private readonly config: ProviderSourceProxyConfig) {
    super({ keepAlive: true, maxSockets: 4 });
    this.proxy = new URL(config.url);
    this.authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  }

  override createConnection(
    options: RequestOptions,
    callback?: (error: Error | null, stream: Duplex) => void,
  ): Duplex | null | undefined {
    if (!callback) throw new Error("Provider proxy connection callback is required");
    const targetHost = String(options.hostname ?? options.host ?? ""),
      targetPort = Number(options.port ?? 443),
      proxyPort = Number(this.proxy.port || 80),
      socket = netConnect({ host: this.proxy.hostname, port: proxyPort });
    let settled = false,
      headers = Buffer.alloc(0);
    const finish = (error: Error | null, stream: Duplex = socket) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(error, stream);
    };
    const fail = (message: string) => {
      socket.destroy();
      finish(new Error(message));
    };
    const timer = setTimeout(
      () => fail("Provider proxy CONNECT timed out"),
      this.config.connectTimeoutMs,
    );
    socket.once("error", (error) => finish(error));
    socket.once("connect", () => {
      socket.write(
        `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n` +
          `Host: ${targetHost}:${targetPort}\r\n` +
          `Proxy-Authorization: ${this.authorization}\r\n` +
          "Proxy-Connection: Keep-Alive\r\n\r\n",
      );
    });
    const onData = (chunk: Buffer) => {
      headers = Buffer.concat([headers, chunk]);
      if (headers.length > 16384) return fail("Provider proxy CONNECT response is too large");
      const end = headers.indexOf("\r\n\r\n");
      if (end < 0) return;
      socket.off("data", onData);
      const statusLine = headers.subarray(0, headers.indexOf("\r\n")).toString("ascii"),
        status = /^HTTP\/1\.[01]\s+(\d{3})/.exec(statusLine)?.[1];
      if (status !== "200")
        return fail(`Provider proxy CONNECT returned HTTP ${status ?? "invalid"}`);
      const remainder = headers.subarray(end + 4);
      if (remainder.length) socket.unshift(remainder);
      const tlsSocket = tlsConnect({
        socket: socket as Socket,
        servername: targetHost,
        ALPNProtocols: ["http/1.1"],
        rejectUnauthorized: true,
      });
      tlsSocket.once("secureConnect", () => finish(null, tlsSocket));
      tlsSocket.once("error", (error) => finish(error));
    };
    socket.on("data", onData);
    return undefined;
  }
}

const responseHeaders = (headers: Record<string, string | string[] | undefined>) => {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) for (const item of value) result.append(name, item);
    else if (value !== undefined) result.set(name, value);
  }
  return result;
};

const MAX_PROXY_RESPONSE_BYTES = 2_000_000;
export function decodeProviderProxyResponseBody(
  body: Buffer,
  contentEncoding: string | null | undefined,
) {
  if (body.length > MAX_PROXY_RESPONSE_BYTES)
    throw new Error("Provider proxy response exceeds 2 MB");
  const encoding = (contentEncoding ?? "").trim().toLowerCase();
  if (!encoding || encoding === "identity") return body;
  try {
    const options = { maxOutputLength: MAX_PROXY_RESPONSE_BYTES + 1 },
      decoded =
        encoding === "gzip"
          ? gunzipSync(body, options)
          : encoding === "deflate"
            ? inflateSync(body, options)
            : encoding === "br"
              ? brotliDecompressSync(body, options)
              : null;
    if (!decoded) throw new Error(`Provider proxy response encoding is unsupported: ${encoding}`);
    if (decoded.length > MAX_PROXY_RESPONSE_BYTES)
      throw new Error("Provider proxy response exceeds 2 MB");
    return decoded;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Provider proxy")) throw error;
    throw new Error("Provider proxy response decompression failed");
  }
}

const httpConnectFetch: TunnelFetch = async (url, init, proxy) => {
  const method = (init?.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method) || init?.body)
    throw new Error("Provider proxy fetch only supports GET and HEAD");
  const agent = new HttpConnectProxyAgent(proxy);
  return await new Promise<Response>((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method,
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        agent,
        signal: init?.signal ?? undefined,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2_000_000) request.destroy(new Error("Provider proxy response exceeds 2 MB"));
          else chunks.push(chunk);
        });
        response.once("error", (error) => {
          agent.destroy();
          reject(error);
        });
        response.once("end", () => {
          agent.destroy();
          try {
            const headers = responseHeaders(response.headers),
              contentEncoding = headers.get("content-encoding"),
              body = decodeProviderProxyResponseBody(Buffer.concat(chunks), contentEncoding);
            if (contentEncoding) {
              headers.delete("content-encoding");
              headers.delete("content-length");
            }
            const result = new Response(new Uint8Array(body), {
              status: response.statusCode ?? 502,
              headers,
              ...(response.statusMessage ? { statusText: response.statusMessage } : {}),
            });
            Object.defineProperty(result, "url", {
              configurable: true,
              value: url.toString(),
            });
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.once("error", (error) => {
      agent.destroy();
      reject(error);
    });
    request.end();
  });
};

export function createProviderSourceFetch(
  proxy: ProviderSourceProxyConfig | undefined,
  dependencies: ProviderSourceFetchDependencies = {},
  proxyHosts: readonly string[] = ["news.google.com"],
): typeof fetch {
  const directFetch = dependencies.directFetch ?? fetch,
    tunnelFetch = dependencies.tunnelFetch ?? httpConnectFetch,
    allowedProxyHosts = new Set(
      proxyHosts.map((value) => value.trim().toLowerCase()).filter(Boolean),
    );
  if (!proxy) return directFetch;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.protocol === "https:" && allowedProxyHosts.has(url.hostname.toLowerCase()))
      return tunnelFetch(url, init, proxy);
    return directFetch(input, init);
  }) as typeof fetch;
}
