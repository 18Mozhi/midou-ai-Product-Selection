import { MySqlOpportunityRepository } from "../../apps/api/dist/mysql-opportunity-repository.js";

/** Capture actual production query generation without running a query or creating records. */
export async function opportunityListSql(input) {
  const queries = [];
  const repository = new MySqlOpportunityRepository({
    query: async (sql, params) => {
      queries.push({ sql, params });
      return sql.startsWith("SELECT COUNT") ? [[{ total: 0 }]] : [[]];
    },
  });
  await repository.list(input);
  return queries;
}
