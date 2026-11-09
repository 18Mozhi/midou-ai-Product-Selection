import { lstat, readFile, unlink, writeFile } from "node:fs/promises";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export const COLLECTION_CLAIM_PAUSE_FILE =
  "/www/wwwroot/ai选品/runtime/verification/collection-claims.pause";
const claimLock = "scoutops:collection-claims:v1";
type FenceConnection = Pick<PoolConnection, "query" | "destroy">;

export const createCollectionClaimFence =
  (path: string, connect: () => Promise<PoolConnection>) =>
  async <T>(work: (paused: boolean, connection: PoolConnection) => Promise<T>): Promise<T> => {
    const connection = await connect();
    try {
      return await withCollectionClaimFence(connection, path, (paused) => work(paused, connection));
    } finally {
      connection.release();
    }
  };
export type CollectionClaimFence = ReturnType<typeof createCollectionClaimFence>;

export async function withCollectionClaimFence<T>(
  connection: FenceConnection,
  path: string,
  work: (paused: boolean) => Promise<T>,
): Promise<T> {
  let acquired = false;
  try {
    let row: RowDataPacket | undefined;
    try {
      const [[result]] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?,3) acquired", [
        claimLock,
      ]);
      row = result;
    } catch (error) {
      connection.destroy();
      throw error;
    }
    if (row?.acquired !== 1) throw new Error("collection_claim_fence_busy");
    acquired = true;
    return await work(await collectionClaimPaused(path));
  } finally {
    if (acquired) {
      try {
        const [[row]] = await connection.query<RowDataPacket[]>("SELECT RELEASE_LOCK(?) released", [
          claimLock,
        ]);
        if (row?.released !== 1) throw new Error("collection_claim_fence_release_failed");
      } catch {
        // Never return a potentially lock-owning SQL session to its pool.
        // A committed claim must still be returned to its executor.
        connection.destroy();
        console.warn("collection_claim_fence_session_discarded");
      }
    }
  }
}

async function collectionClaimPaused(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function changeCollectionClaimPause(
  connection: FenceConnection,
  path: string,
  action: "pause" | "resume" | "status",
  maintenanceId?: string,
) {
  if (
    action !== "status" &&
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(maintenanceId ?? "")
  )
    throw new Error("collection_claim_maintenance_id_invalid");
  return withCollectionClaimFence(connection, path, async (paused) => {
    if (action === "pause" && !paused) {
      await writeFile(path, JSON.stringify({ maintenanceId, pausedAt: new Date().toISOString() }), {
        flag: "wx",
        mode: 0o644,
      });
      return { paused: true, maintenanceId };
    }
    if (!paused) return { paused: false, maintenanceId: null };
    if (!(await lstat(path)).isFile()) throw new Error("collection_claim_pause_file_invalid");
    const marker = JSON.parse(await readFile(path, "utf8")) as { maintenanceId?: string };
    if (action === "status") return { paused: true, maintenanceId: marker.maintenanceId ?? null };
    if (marker.maintenanceId !== maintenanceId)
      throw new Error("collection_claim_maintenance_owner_mismatch");
    if (action === "resume") {
      await unlink(path);
      return { paused: false, maintenanceId };
    }
    return { paused: true, maintenanceId };
  });
}
