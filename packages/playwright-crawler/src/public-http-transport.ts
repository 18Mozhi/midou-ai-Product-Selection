import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";
import type { BrowserContext } from "playwright";

export async function installPublicHttpTransport(
  context: BrowserContext,
  executable: string,
  script: string,
  timeout: number,
  proxy?: { server: string; username?: string; password?: string },
) {
  if (
    !isAbsolute(executable) ||
    !isAbsolute(script) ||
    !/[/\\]scoutops_crawler[/\\]public_http\.py$/.test(script)
  )
    throw new Error("public_http_runtime_invalid");
  await context.route(
    (url) => url.origin === "https://www.amazon.com",
    async (route) => {
      const request = route.request();
      if (!request.isNavigationRequest() || request.frame().parentFrame() !== null) {
        await route.continue();
        return;
      }
      try {
        const headers = await request.allHeaders();
        let proxyUrl: string | undefined;
        if (proxy) {
          const url = new URL(proxy.server);
          if (proxy.username !== undefined) url.username = proxy.username;
          if (proxy.password !== undefined) url.password = proxy.password;
          proxyUrl = url.toString();
        }
        const result = await new Promise<{
          status: number;
          headers: [string, string][];
          body_base64: string;
        }>((resolve, reject) => {
          const child = spawn(executable, [script], {
            stdio: ["pipe", "pipe", "ignore"],
            windowsHide: true,
            shell: false,
          });
          const onContextClosed = () => {
            child.kill();
            reject(new Error("public_http_context_closed"));
          };
          context.once("close", onContextClosed);
          const chunks: Buffer[] = [];
          let size = 0;
          const timer = setTimeout(() => {
            child.kill();
            reject(new Error("public_http_timeout"));
          }, timeout + 2000);
          child.on("error", () => {
            clearTimeout(timer);
            reject(new Error("public_http_unavailable"));
          });
          child.stdout.on("data", (chunk) => {
            size += chunk.length;
            if (size > 12 * 1024 * 1024) {
              child.kill();
              reject(new Error("public_http_response_too_large"));
            } else chunks.push(chunk);
          });
          child.stdin.on("error", () => {});
          child.on("close", (code) => {
            context.off("close", onContextClosed);
            clearTimeout(timer);
            try {
              const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
              if (
                code !== 0 ||
                !Number.isInteger(parsed.status) ||
                parsed.status < 100 ||
                parsed.status > 599 ||
                !Array.isArray(parsed.headers) ||
                typeof parsed.body_base64 !== "string"
              )
                throw new Error();
              resolve(parsed);
            } catch {
              reject(new Error("public_http_invalid_response"));
            }
          });
          child.stdin.end(
            JSON.stringify({
              url: request.url(),
              method: request.method(),
              headers,
              body_base64: request.postDataBuffer()?.toString("base64") ?? "",
              timeout_ms: timeout,
              ...(proxyUrl ? { proxy: proxyUrl } : {}),
            }),
          );
        });
        const responseHeaders: Record<string, string> = {};
        for (const [key, value] of result.headers) {
          if (typeof key !== "string" || typeof value !== "string" || /[\r\n]/.test(key + value))
            throw new Error("public_http_headers_invalid");
          const name = key.toLowerCase();
          responseHeaders[name] = responseHeaders[name]
            ? responseHeaders[name] + (name === "set-cookie" ? "\n" : ", ") + value
            : value;
        }
        await route.fulfill({
          status: result.status,
          headers: responseHeaders,
          body: Buffer.from(result.body_base64, "base64"),
        });
      } catch {
        await route.abort("failed").catch(() => {});
      }
    },
  );
}
