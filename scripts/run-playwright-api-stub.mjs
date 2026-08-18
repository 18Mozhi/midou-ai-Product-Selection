import { createServer } from "node:http";

const port = Number(process.env.PLAYWRIGHT_API_PORT ?? process.env.APP_PORT ?? 4101);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PLAYWRIGHT_API_PORT must be an integer port between 1024 and 65535");

const server = createServer((request, response) => {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  if (request.method === "GET" && request.url === "/api/v1/health/live") {
    response.statusCode = 200;
    response.end(
      JSON.stringify({
        data: { status: "alive", service: "playwright-api-stub" },
        request_id: "playwright-api-stub",
        trace_id: "playwright-api-stub",
      }),
    );
    return;
  }
  response.statusCode = 503;
  response.end(
    JSON.stringify({
      error: {
        code: "playwright_route_not_mocked",
        message: "该 E2E API 路由未显式模拟。",
        action_hint: "在对应 Playwright 用例中声明 page.route 合同。",
      },
      request_id: "playwright-api-stub",
      trace_id: "playwright-api-stub",
    }),
  );
});

server.listen(port, "127.0.0.1");
const stop = () => server.close(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
