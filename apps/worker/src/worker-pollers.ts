import type { QueueSchedulerJob } from "./queue-scheduler.js";

type PollResult = { status?: string } & Record<string, unknown>;

const asPollResult = (value: unknown): PollResult | null =>
  value !== null && typeof value === "object" ? (value as PollResult) : null;

export class WorkerPollers {
  private stopping = false;
  private readonly activeQueues = new Set<string>();

  get isStopping() {
    return this.stopping;
  }

  create(
    queue: string,
    run: (signal: AbortSignal) => Promise<unknown>,
    options: { enabled?: () => boolean; logResult?: boolean } = {},
  ): QueueSchedulerJob["run"] {
    return async (signal) => {
      if (this.stopping || this.activeQueues.has(queue) || options.enabled?.() === false) return;
      this.activeQueues.add(queue);
      try {
        const value = await run(signal);
        const result = asPollResult(value);
        if (options.logResult !== false && result?.status && result.status !== "idle") {
          console.log(
            JSON.stringify({
              service: "product-scout-worker",
              queue,
              ...result,
              observed_at: new Date().toISOString(),
            }),
          );
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            service: "product-scout-worker",
            queue,
            status: "dependency_failed",
            error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
            observed_at: new Date().toISOString(),
          }),
        );
        throw error;
      } finally {
        this.activeQueues.delete(queue);
      }
    };
  }

  requestStop() {
    this.stopping = true;
  }

  async waitForIdle() {
    while (this.activeQueues.size > 0) await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
