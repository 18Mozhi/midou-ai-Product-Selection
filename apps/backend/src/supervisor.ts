import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

export interface ManagedProcess {
  name: "api" | "worker";
  entrypoint: string;
}

export interface SupervisorOptions {
  cwd?: string;
  restartDelayMs?: number;
  shutdownGraceMs?: number;
  spawnProcess?: (command: string, args: string[], options: Parameters<typeof spawn>[2]) => ChildProcess;
}

const DEFAULT_PROCESSES: ManagedProcess[] = [
  { name: "api", entrypoint: "apps/api/dist/server.js" },
  { name: "worker", entrypoint: "apps/worker/dist/index.js" },
];

export class BackendSupervisor {
  readonly children = new Map<string, ChildProcess>();
  private readonly cwd: string;
  private readonly restartDelayMs: number;
  private readonly shutdownGraceMs: number;
  private readonly spawnProcess: NonNullable<SupervisorOptions["spawnProcess"]>;
  private stopping = false;

  constructor(
    private readonly processes: ManagedProcess[] = DEFAULT_PROCESSES,
    options: SupervisorOptions = {},
  ) {
    this.cwd = options.cwd ?? process.cwd();
    this.restartDelayMs = options.restartDelayMs ?? 1_000;
    this.shutdownGraceMs = options.shutdownGraceMs ?? 15_000;
    this.spawnProcess = options.spawnProcess ?? spawn;
  }

  start(): void {
    for (const managed of this.processes) this.startProcess(managed);
  }

  async stop(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;

    const active = [...this.children.values()].filter((child) => child.exitCode === null);
    for (const child of active) child.kill(signal);

    if (active.length === 0) return;
    await Promise.race([
      Promise.all(active.map((child) => new Promise<void>((done) => child.once("exit", () => done())))),
      new Promise<void>((done) =>
        setTimeout(() => {
          for (const child of active) {
            if (child.exitCode === null) child.kill("SIGKILL");
          }
          done();
        }, this.shutdownGraceMs).unref(),
      ),
    ]);
  }

  private startProcess(managed: ManagedProcess): void {
    if (this.stopping) return;
    const entrypoint = resolve(this.cwd, managed.entrypoint);
    const child = this.spawnProcess(process.execPath, [entrypoint], {
      cwd: this.cwd,
      env: process.env,
      stdio: "inherit",
    });
    this.children.set(managed.name, child);
    this.log("started", managed.name, child.pid);

    child.once("error", (error) => {
      this.log("error", managed.name, child.pid, error.message);
    });
    child.once("exit", (code, signal) => {
      this.children.delete(managed.name);
      this.log("exited", managed.name, child.pid, `${code ?? signal ?? "unknown"}`);
      if (!this.stopping) {
        setTimeout(() => this.startProcess(managed), this.restartDelayMs).unref();
      }
    });
  }

  private log(event: string, processName: string, pid?: number, detail?: string): void {
    process.stdout.write(`${JSON.stringify({
      level: event === "error" ? "error" : "info",
      service: "ai-selection-backend",
      event: `backend_child_${event}`,
      process: processName,
      pid: pid ?? null,
      detail: detail ?? null,
      observed_at: new Date().toISOString(),
    })}\n`);
  }
}
