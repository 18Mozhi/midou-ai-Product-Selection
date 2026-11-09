import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { QueueSchedulerSnapshot } from "./queue-scheduler.js";

export function reportWorkerSchedulerSnapshotError(error: unknown) {
  console.error(
    JSON.stringify({
      service: "product-scout-worker",
      status: "scheduler_state_write_failed",
      error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
      observed_at: new Date().toISOString(),
    }),
  );
}

export function reportWorkerSchedulerHeartbeat(input: {
  stopping: boolean;
  workerId: string;
  sources: string[];
  snapshot: QueueSchedulerSnapshot | null;
  configFingerprint: string;
}) {
  console.log(
    JSON.stringify({
      service: "product-scout-worker",
      status: input.stopping ? "stopping" : "idle",
      worker_id: input.workerId,
      registered_sources: input.sources,
      registered_queues: input.snapshot?.queues.map((queue) => queue.name) ?? [],
      scheduler: input.snapshot,
      config_fingerprint: input.configFingerprint,
      observed_at: new Date().toISOString(),
    }),
  );
}

export class WorkerSchedulerStateWriter {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async writeBestEffort(snapshot: QueueSchedulerSnapshot): Promise<void> {
    try {
      await this.write(snapshot);
    } catch {
      console.error(
        JSON.stringify({
          service: "product-scout-worker",
          status: "scheduler_state_write_failed",
          observed_at: new Date().toISOString(),
        }),
      );
    }
  }

  write(snapshot: QueueSchedulerSnapshot): Promise<void> {
    if (!this.filePath) return Promise.resolve();
    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        await mkdir(dirname(this.filePath), { recursive: true });
        const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
        await writeFile(temporaryPath, `${JSON.stringify(snapshot)}\n`, {
          encoding: "utf8",
          mode: 0o600,
        });
        await rename(temporaryPath, this.filePath);
      });
    return this.writeChain;
  }
}
