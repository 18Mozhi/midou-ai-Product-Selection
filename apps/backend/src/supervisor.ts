import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
  readinessTimeoutMs?: number;
  readinessPollMs?: number;
  workerStateFile?: string;
  workerStateStaleMs?: number;
  stateFile?: string | null;
  spawnProcess?: (
    command: string,
    args: string[],
    options: Parameters<typeof spawn>[2],
  ) => ChildProcess;
  readinessProbe?: (
    managed: ManagedProcess,
    child: ChildProcess,
    startedAt: number,
  ) => Promise<boolean>;
}

interface ProcessRuntime {
  status: "starting" | "running" | "restarting" | "circuit_open" | "stopped";
  pid: number | null;
  restartCount: number;
  startedAt: number | null;
  readyAt: number | null;
  recentExits: number[];
  circuitOpenUntil: number | null;
  lastFailure: string | null;
}

const DEFAULT_PROCESSES: ManagedProcess[] = [
  { name: "api", entrypoint: "apps/api/dist/server.js" },
  { name: "worker", entrypoint: "apps/worker/dist/index.js" },
];

function replaceStateFile(stateFile: string, serialized: string): void {
  const temporary = `${stateFile}.${process.pid}.tmp`;
  writeFileSync(temporary, serialized, { encoding: "utf8", mode: 0o640 });
  try {
    renameSync(temporary, stateFile);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    try {
      if (process.platform !== "win32" || !["EACCES", "EEXIST", "EPERM"].includes(code))
        throw error;
      writeFileSync(stateFile, serialized, { encoding: "utf8", mode: 0o640 });
    } finally {
      rmSync(temporary, { force: true });
    }
  }
}

export class BackendSupervisor {
  readonly children = new Map<string, ChildProcess>();
  private readonly cwd: string;
  private readonly restartDelayMs: number;
  private readonly restartMaxDelayMs: number;
  private readonly restartWindowMs: number;
  private readonly circuitThreshold: number;
  private readonly circuitOpenMs: number;
  private readonly shutdownGraceMs: number;
  private readonly readinessTimeoutMs: number;
  private readonly readinessPollMs: number;
  private readonly workerStateFile: string;
  private readonly workerStateStaleMs: number;
  private readonly stateFile: string | null;
  private readonly spawnProcess: NonNullable<SupervisorOptions["spawnProcess"]>;
  private readonly readinessProbe: NonNullable<SupervisorOptions["readinessProbe"]>;
  private readonly runtime = new Map<string, ProcessRuntime>();
  private stopping = false;

  constructor(
    private readonly processes: ManagedProcess[] = DEFAULT_PROCESSES,
    options: SupervisorOptions = {},
  ) {
    this.cwd = options.cwd ?? process.cwd();
    this.restartDelayMs =
      options.restartDelayMs ?? Number(process.env.BACKEND_RESTART_INITIAL_DELAY_MS ?? 1_000);
    this.restartMaxDelayMs =
      options.restartMaxDelayMs ?? Number(process.env.BACKEND_RESTART_MAX_DELAY_MS ?? 30_000);
    this.restartWindowMs =
      options.restartWindowMs ?? Number(process.env.BACKEND_RESTART_WINDOW_SECONDS ?? 60) * 1_000;
    this.circuitThreshold =
      options.circuitThreshold ?? Number(process.env.BACKEND_RESTART_CIRCUIT_THRESHOLD ?? 5);
    this.circuitOpenMs =
      options.circuitOpenMs ??
      Number(process.env.BACKEND_RESTART_CIRCUIT_OPEN_SECONDS ?? 60) * 1_000;
    this.shutdownGraceMs = options.shutdownGraceMs ?? 15_000;
    this.readinessTimeoutMs =
      options.readinessTimeoutMs ??
      Number(process.env.BACKEND_CHILD_READINESS_TIMEOUT_SECONDS ?? 60) * 1_000;
    this.readinessPollMs =
      options.readinessPollMs ?? Number(process.env.BACKEND_CHILD_READINESS_POLL_MS ?? 250);
    this.workerStateFile = resolve(
      this.cwd,
      options.workerStateFile ??
        (process.env.WORKER_SCHEDULER_STATE_FILE?.trim() || "./runtime/worker-scheduler.json"),
    );
    this.workerStateStaleMs =
      options.workerStateStaleMs ??
      Number(process.env.WORKER_SCHEDULER_STALE_AFTER_SECONDS ?? 90) * 1_000;
    const configuredStateFile =
      options.stateFile === undefined
        ? process.env.BACKEND_SUPERVISOR_STATE_FILE?.trim()
        : options.stateFile;
    this.stateFile = configuredStateFile ? resolve(this.cwd, configuredStateFile) : null;
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.readinessProbe =
      options.readinessProbe ??
      ((managed, child, startedAt) => this.defaultReadinessProbe(managed, child, startedAt));
    for (const processDefinition of processes) {
      this.runtime.set(processDefinition.name, {
        status: "stopped",
        pid: null,
        restartCount: 0,
        startedAt: null,
        readyAt: null,
        recentExits: [],
        circuitOpenUntil: null,
        lastFailure: null,
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
        Promise.all(
          active.map((child) => new Promise<void>((done) => child.once("exit", () => done()))),
        ),
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
      item.readyAt = null;
    }
    this.publishState();
  }

  private startProcess(managed: ManagedProcess): void {
    if (this.stopping) return;
    const runtime = this.runtime.get(managed.name)!;
    runtime.status = runtime.restartCount ? "restarting" : "starting";
    runtime.readyAt = null;
    this.publishState();
    const entrypoint = resolve(this.cwd, managed.entrypoint);
    let child: ChildProcess;
    try {
      child = this.spawnProcess(process.execPath, [entrypoint], {
        cwd: this.cwd,
        env: process.env,
        stdio: "inherit",
      });
    } catch (error) {
      this.scheduleRestart(
        managed,
        runtime,
        `spawn_failed:${error instanceof Error ? error.message : "unknown"}`,
      );
      return;
    }
    this.children.set(managed.name, child);
    runtime.pid = child.pid ?? null;
    runtime.startedAt = Date.now();
    runtime.circuitOpenUntil = null;
    this.publishState();
    this.log("spawned", managed.name, child.pid);

    let finished = false;
    const fail = (detail: string) => {
      if (finished) return;
      finished = true;
      this.children.delete(managed.name);
      runtime.pid = null;
      runtime.readyAt = null;
      if (!this.stopping) this.scheduleRestart(managed, runtime, detail);
    };
    child.once("error", (error) => fail(`spawn_failed:${error.message}`));
    child.once("exit", (code, signal) => {
      this.log("exited", managed.name, child.pid, `${code ?? signal ?? "unknown"}`);
      fail(`exit:${code ?? signal ?? "unknown"}`);
    });
    void this.waitUntilReady(managed, child, runtime.startedAt).then((ready) => {
      if (finished || this.stopping || this.children.get(managed.name) !== child) return;
      if (!ready) {
        this.log(
          "readiness_failed",
          managed.name,
          child.pid,
          "child did not become ready before deadline",
        );
        fail("readiness_timeout");
        if (child.exitCode === null) child.kill("SIGTERM");
        return;
      }
      runtime.status = "running";
      runtime.readyAt = Date.now();
      runtime.lastFailure = null;
      this.publishState();
      this.log("ready", managed.name, child.pid);
    });
  }

  private async waitUntilReady(
    managed: ManagedProcess,
    child: ChildProcess,
    startedAt: number,
  ): Promise<boolean> {
    const deadline = Date.now() + this.readinessTimeoutMs;
    while (!this.stopping && child.exitCode === null && Date.now() <= deadline) {
      try {
        if (await this.readinessProbe(managed, child, startedAt)) return true;
      } catch (error) {
        this.log(
          "readiness_probe_failed",
          managed.name,
          child.pid,
          error instanceof Error ? error.message : "unknown",
        );
      }
      await new Promise<void>((done) => setTimeout(done, this.readinessPollMs));
    }
    return false;
  }

  private async defaultReadinessProbe(
    managed: ManagedProcess,
    _child: ChildProcess,
    startedAt: number,
  ): Promise<boolean> {
    if (managed.name === "api") {
      const port = Number(process.env.APP_PORT ?? 4101);
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/health/live`, {
        signal: AbortSignal.timeout(Math.min(2_000, this.readinessPollMs * 4)),
      });
      if (!response.ok) return false;
      const payload = (await response.json()) as { data?: { status?: string; build_sha?: string } };
      return (
        payload.data?.status === "ok" &&
        payload.data?.build_sha === (process.env.BUILD_SHA ?? "development")
      );
    }
    const snapshot = JSON.parse(readFileSync(this.workerStateFile, "utf8")) as {
      status?: string;
      observed_at?: string;
    };
    const observedAt = Date.parse(snapshot.observed_at ?? "");
    return (
      snapshot.status === "running" &&
      Number.isFinite(observedAt) &&
      observedAt >= startedAt &&
      Date.now() - observedAt <= this.workerStateStaleMs
    );
  }

  private scheduleRestart(managed: ManagedProcess, runtime: ProcessRuntime, detail: string): void {
    if (this.stopping) return;
    const now = Date.now();
    runtime.restartCount += 1;
    runtime.lastFailure = detail.slice(0, 240);
    runtime.recentExits = [
      ...runtime.recentExits.filter((at) => now - at <= this.restartWindowMs),
      now,
    ];
    const exponent = Math.max(0, runtime.recentExits.length - 1);
    let delay = Math.min(this.restartMaxDelayMs, this.restartDelayMs * 2 ** exponent);
    if (runtime.recentExits.length >= this.circuitThreshold) {
      runtime.status = "circuit_open";
      runtime.circuitOpenUntil = now + this.circuitOpenMs;
      delay = this.circuitOpenMs;
      this.log("circuit_open", managed.name, undefined, `${detail};restart_after_ms=${delay}`);
    } else {
      runtime.status = "restarting";
      this.log("restart_scheduled", managed.name, undefined, `${detail};restart_after_ms=${delay}`);
    }
    this.publishState();
    setTimeout(() => this.startProcess(managed), delay).unref();
  }

  private publishState(): void {
    if (!this.stateFile) return;
    const payload = {
      schema_version: 1,
      supervisor_pid: process.pid,
      status: this.stopping
        ? "stopping"
        : [...this.runtime.values()].every((item) => item.status === "running")
          ? "ready"
          : "degraded",
      processes: Object.fromEntries(
        [...this.runtime.entries()].map(([name, item]) => [
          name,
          {
            status: item.status,
            pid: item.pid,
            restart_count: item.restartCount,
            ready_at: item.readyAt ? new Date(item.readyAt).toISOString() : null,
            circuit_open_until: item.circuitOpenUntil
              ? new Date(item.circuitOpenUntil).toISOString()
              : null,
            last_failure: item.lastFailure,
          },
        ]),
      ),
      observed_at: new Date().toISOString(),
    };
    try {
      mkdirSync(dirname(this.stateFile), { recursive: true });
      replaceStateFile(this.stateFile, JSON.stringify(payload));
    } catch (error) {
      this.log(
        "state_write_failed",
        "supervisor",
        process.pid,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  private log(event: string, processName: string, pid?: number, detail?: string): void {
    const level =
      event.includes("failed") || event === "circuit_open" || event === "restart_scheduled"
        ? "error"
        : "info";
    const record = {
      level,
      service: "ai-selection-backend",
      event: `backend_child_${event}`,
      process: processName,
      pid: pid ?? null,
      detail: detail ?? null,
      observed_at: new Date().toISOString(),
    };
    process.stdout.write(`${JSON.stringify(record)}\n`);
  }
}
