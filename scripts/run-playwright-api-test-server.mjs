import { buildApp } from "../apps/api/dist/app.js";

const port = Number(process.env.PLAYWRIGHT_API_PORT ?? process.env.APP_PORT ?? 4101);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("PLAYWRIGHT_API_PORT must be an integer port between 1024 and 65535");
}

const available = (name) => ({
  name,
  check: async () => "available",
});
const app = buildApp({
  version: "playwright-e2e",
  buildSha: "0123456789abcdef0123456789abcdef01234567",
  configFingerprint: "a".repeat(64),
  readinessChecks: [available("mysql"), available("redis")],
});

await app.listen({ host: "127.0.0.1", port });
const stop = async () => {
  await app.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
