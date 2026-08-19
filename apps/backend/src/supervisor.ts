import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface ManagedProcess {
  name: "api" | "worker";
  entrypoint: string;
}

export interface SupervisorOptions {
  cwd?: string;
  restartDelayMs?: number;
  restartMaxDelayMs?: number;
  restartWindowMs?: number;
  circuitThreshold?: number;
  circuitOpenMs?: number;
  shutdownGraceMs?: number;
  stateFile?: string | null;
  spawnProcess?: (command: string, args: string[], options: Parameters<typeof spawn>[2]) => ChildProcess;
}

interface ProcessRuntime {
  status: "starting" | "running" | "restarting" | "circuit_open" | "stopped";
  pid: number | null;
  restartCount: number;
  startedAt: number | null;
  recentExits: number[];
  circuitOpenUntil: number | null;
}

const DEFAULT_PROCESSES: ManagedProcess[] = [
  { name: "api", entrypoint: "apps/api/dist/server.js" },
  { name: "worker", entrypoint: "apps/worker/dist/index.js" },
];

export class BackendSupervisor {
  readonly children = new Map<string, ChildProcess>();
  private readonly cwd: string;
  private readonly restartDelayMs: number;
  private readonly restartMaxDelayMs: number;
  private readonly restartWindowMs: number;
  private readonly circuitThreshold: number;
  private readonly circuitOpenMs: number;
  private readonly shutdownGraceMs: number;
  private readonly stateFile: string | null;
  private readonly spawnProcess: NonNullable<SupervisorOptions["spawnProcess"]>;
  private readonly runtime = new Map<string, ProcessRuntime>();
  private stopping = false;

  constructor(
    private readonly processes: ManagedProcess[] = DEFAULT_PROCESSES,
    options: SupervisorOptions = {},
  ) {
    this.cwd = options.cwd ?? process.cwd();
    this.restartDelayMs = options.restartDelayMs ?? Number(process.env.BACKEND_RESTART_INITIAL_DELAY_MS ?? 1_000);
    this.restartMaxDelayMs = options.restartMaxDelayMs ?? Number(process.env.BACKEND_RESTART_MAX_DELAY_MS ?? 30_000);
    this.restartWindowMs = options.restartWindowMs ?? Number(process.env.BACKEND_RESTART_WINDOW_SECONDS ?? 60) * 1_000;
    this.circuitThreshold = options.circuitThreshold ?? Number(process.env.BACKEND_RESTART_CIRCUIT_THRESHOLD ?? 5);
    this.circuitOpenMs = options.circuitOpenMs ?? Number(process.env.BACKEND_RESTART_CIRCUIT_OPEN_SECONDS ?? 60) * 1_000;
    this.shutdownGraceMs = options.shutdownGraceMs ?? 15_000;
    const configuredStateFile = options.stateFile === undefined ? process.env.BACKEND_SUPERVISOR_STATE_FILE?.trim() : options.stateFile;
    this.stateFile = configuredStateFile ? resolve(this.cwd, configuredStateFile) : null;
    this.spawnProcess = options.spawnProcess ?? spawn;
    for (const processDefinition of processes) {
      this.runtime.set(processDefinition.name, {
        status: "stopped",
        pid: null,
        restartCount: 0,
        startedAt: null,
        recentExits: [],
        circuitOpenUntil: null,
      });
    }
  }

  start(): void {
    for (const managed of this.processes) this.startProcess(managed);
  }

  async stop(signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    const active = [...this.children.values()].filter((child) => child.exitCode === null);
    for (const child of active) child.kill(signal);
    if (active.length) {
      await Promise.race([
        Promise.all(active.map((child) => new Promise<void>((done) => child.once("exit", () => done())))),
        new Promise<void>((done) =>
          setTimeout(() => {
            for (const child of active) if (child.exitCode === null) child.kill("SIGKILL");
            done();
          }, this.shutdownGraceMs).unref(),
        ),
      ]);
    }
    for (const item of this.runtime.values()) {
      item.status = "stopped";
      item.pid = null;
    }
    this.publishState();
  }

  private startProcess(managed: ManagedProcess): void {
    if (this.stopping) return;
    const runtime = this.runtime.get(managed.name)!;
    runtime.status = runtime.restartCount ? "restarting" : "starting";
    this.publishState();
    const entrypoint = resolve(this.cwd, managed.entrypoint);
    const child = this.spawnProcess(process.execPath, [entrypoint], {
      cwd: this.cwd,
      env: process.env,
      stdio: "inherit",
    });
    this.children.set(managed.name, child);
    runtime.status = "running";
    runtime.pid = child.pid ?? null;
    runtime.startedAt = Date.now();
    runtime.circuitOpenUntil = null;
    this.publishState();
    this.log("started", managed.name, child.pid);

    child.once("error", (error) => this.log("error", managed.name, child.pid, error.message));
    child.once("exit", (code, signal) => {
      this.children.delete(managed.name);
      runtime.pid = null;
      this.log("exited", managed.name, child.pid, `${code ?? signal ?? "unknown"}`);
      if (this.stopping) return;
      const now = Date.now();
      runtime.restartCount += 1;
      runtime.recentExits = [...runtime.recentExits.filter((at) => now - at <= this.restartWindowMs), now];
      const exponent = Math.max(0, runtime.recentExits.length - 1);
      let delay = Math.min(this.restartMaxDelayMs, this.restartDelayMs * 2 ** exponent);
      if (runtime.recentExits.length >= this.circuitThreshold) {
        runtime.status = "circuit_open";
        runtime.circuitOpenUntil = now + this.circuitOpenMs;
        delay = this.circuitOpenMs;
        this.log("circuit_open", managed.name, undefined, `restart_after_ms=${delay}`);
      } else runtime.status = "restarting";
      this.publishState();
      setTimeout(() => this.startProcess(managed), delay).unref();
    });
  }

  private publishState(): void {
    if (!this.stateFile) return;
    const payload = {
      schema_version: 1,
      supervisor_pid: process.pid,
      status: this.stopping ? "stopping" : [...this.runtime.values()].every((item) => item.status === "running") ? "ready" : "degraded",
      processes: Object.fromEntries([...this.runtime.entries()].map(([name, item]) => [name, {
        status: item.status,
        pid: item.pid,
        restart_count: item.restartCount,
        circuit_open_until: item.circuitOpenUntil ? new Date(item.circuitOpenUntil).toISOString() : null,
      }])),
      observed_at: new Date().toISOString(),
    };
    mkdirSync(dirname(this.stateFile), { recursive: true });
    const temporary = `${this.stateFile}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(payload), { encoding: "utf8", mode: 0o640 });
    renameSync(temporary, this.stateFile);
  }

  private log(event: string, processName: string, pid?: number, detail?: string): void {
    process.stdout.write(`${JSON.stringify({ level: event === "error" ? "error" : "info", service: "ai-selection-backend", event: `backend_child_${event}`, process: processName, pid: pid ?? null, detail: detail ?? null, observed_at: new Date().toISOString() })}\n`);
  }
}
