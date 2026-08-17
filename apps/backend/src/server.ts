import { BackendSupervisor } from "./supervisor.js";

const supervisor = new BackendSupervisor();
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await supervisor.stop(signal);
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  process.stderr.write(`${JSON.stringify({ level: "error", service: "ai-selection-backend", event: "uncaught_exception", message: error.message })}\n`);
  void shutdown("SIGTERM").then(() => process.exit(1));
});
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`${JSON.stringify({ level: "error", service: "ai-selection-backend", event: "unhandled_rejection", message: String(reason) })}\n`);
  void shutdown("SIGTERM").then(() => process.exit(1));
});

supervisor.start();
