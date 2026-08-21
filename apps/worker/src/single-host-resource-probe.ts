import { cpus, freemem, loadavg } from "node:os";
import { statfs } from "node:fs/promises";
export interface SingleHostResourcePolicy {
  maximumLoadBasisPoints: number;
  minimumAvailableMemoryMb: number;
  minimumFreeDiskMb: number;
}
export interface SingleHostResourceSnapshot {
  loadBasisPoints: number;
  availableMemoryMb: number;
  freeDiskMb: number;
  observedAt: Date;
}
const mb = (value: number) => Math.max(0, Math.floor(value / 1048576));
export class SingleHostResourceProbe {
  private lastRecordedAt = 0;
  constructor(
    private readonly diskPath: string,
    private readonly policy: SingleHostResourcePolicy,
    private readonly now = () => new Date(),
  ) {}
  async inspect() {
    const disk = await statfs(this.diskPath),
      snapshot: SingleHostResourceSnapshot = {
        loadBasisPoints: Math.max(
          0,
          Math.round((loadavg()[0]! / Math.max(1, cpus().length)) * 10000),
        ),
        availableMemoryMb: mb(freemem()),
        freeDiskMb: mb(Number(disk.bavail) * Number(disk.bsize)),
        observedAt: this.now(),
      },
      allowed =
        snapshot.loadBasisPoints < this.policy.maximumLoadBasisPoints &&
        snapshot.availableMemoryMb >= this.policy.minimumAvailableMemoryMb &&
        snapshot.freeDiskMb >= this.policy.minimumFreeDiskMb,
      shouldRecord = !allowed || snapshot.observedAt.getTime() - this.lastRecordedAt >= 60000;
    if (shouldRecord) this.lastRecordedAt = snapshot.observedAt.getTime();
    return { allowed, shouldRecord, snapshot };
  }
}
