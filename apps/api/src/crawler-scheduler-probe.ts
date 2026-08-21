import { cpus, freemem, loadavg } from "node:os";
import { readdir, readFile, statfs } from "node:fs/promises";

const mb = (value: number) => Math.max(0, Math.floor(value / 1_048_576));
export const classifyCrawlerSchedulerCommand = (value: string) => ({
  worker: /product-scout-worker|apps\/worker\/dist\/index\.js/.test(value),
  crawler: /(?:^|\s)(?:\S*\/)?python(?:3(?:\.12)?)?\s+-m\s+scoutops_crawler(?:\s|$)/.test(value),
});

export class CrawlerSchedulerHostProbe {
  constructor(
    private readonly diskPath: string,
    private readonly now = () => new Date(),
  ) {}

  private async processes() {
    if (process.platform !== "linux") return { worker_instances: 1, crawler_instances: 1 };
    let worker = 0,
      crawler = 0;
    for (const entry of await readdir("/proc", { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[0-9]+$/.test(entry.name)) continue;
      try {
        const value = (await readFile(`/proc/${entry.name}/cmdline`, "utf8")).replaceAll("\0", " ");
        const kind = classifyCrawlerSchedulerCommand(value);
        if (kind.worker) worker += 1;
        if (kind.crawler) crawler += 1;
      } catch {
        // The process can exit between listing /proc and reading cmdline.
      }
    }
    return { worker_instances: worker, crawler_instances: crawler };
  }

  async snapshot() {
    const disk = await statfs(this.diskPath);
    const cores = Math.max(1, cpus().length);
    return {
      ...(await this.processes()),
      resource: {
        load_basis_points: Math.max(0, Math.round((loadavg()[0]! / cores) * 10_000)),
        available_memory_mb: mb(freemem()),
        free_disk_mb: mb(Number(disk.bavail) * Number(disk.bsize)),
        observed_at: this.now().toISOString(),
      },
    };
  }
}
