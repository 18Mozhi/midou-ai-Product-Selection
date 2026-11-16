import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type NewCollectionSubquery = {
  id: string;
  taskId: string;
  providerId: string;
  ordinal: number;
  targetJson: string;
  required: boolean | 0 | 1;
  now: Date;
} & ({ status: "pending" } | { status: "running"; startedAt: Date });

// The FK identifies the only parent. On the legacy layout copy its coordinates
// inside the insert instead of accepting independent scope from any producer.
export async function appendCollectionSubquery(
  db: Pick<PoolConnection, "query">,
  i: NewCollectionSubquery,
  accountOnly = false,
) {
  const insert = (legacy: boolean) =>
    db.query<ResultSetHeader>(
      `INSERT INTO collection_subqueries (id,task_id,${legacy ? "organization_id,workspace_id," : ""}provider_id,ordinal,` +
        "target_json,is_required,status,available_result_count,missing_fields_json,error_code,retryable," +
        "started_at,finished_at,version,created_at,updated_at) " +
        `SELECT ?,t.id,${legacy ? "t.organization_id,t.workspace_id," : ""}?,?,?,?,?,0,'[]',NULL,0,?,NULL,1,?,? ` +
        "FROM collection_tasks t WHERE t.id=?",
      [
        i.id,
        i.providerId,
        i.ordinal,
        i.targetJson,
        i.required ? 1 : 0,
        i.status,
        i.status === "running" ? i.startedAt : null,
        i.now,
        i.now,
        i.taskId,
      ],
    );
  const [result] = await insert(!accountOnly).catch(
    async (error: { code?: string; sqlMessage?: string }) => {
      // The rejected statement wrote nothing. Retry only for these exact absent
      // target columns, and only when both are absent.
      if (
        accountOnly ||
        error.code !== "ER_BAD_FIELD_ERROR" ||
        !/^Unknown column '(organization_id|workspace_id)' in 'field list'$/.test(
          error.sqlMessage ?? "",
        )
      )
        throw error;
      const [columns] = await db.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM collection_subqueries WHERE Field IN ('organization_id','workspace_id')",
      );
      if (columns.length) throw new Error("partial_inherited_scope_schema:collection_subqueries");
      return insert(false);
    },
  );
  if (result.affectedRows !== 1) throw new Error("collection_subquery_parent_not_found");
}
