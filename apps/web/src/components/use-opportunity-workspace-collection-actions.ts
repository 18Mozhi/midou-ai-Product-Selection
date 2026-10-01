import type { Ref } from "vue";
import type * as OpportunityTypes from "./opportunity-workspace-types";

interface OpportunityWorkspaceCollectionActionOptions {
  detail: Ref<OpportunityTypes.OpportunityDetail | null>;
  write: (path: string, body: unknown) => Promise<any>;
  message: Ref<string>;
}

export function useOpportunityWorkspaceCollectionActions(
  options: OpportunityWorkspaceCollectionActionOptions,
) {
  const { detail, write, message } = options;

  async function discoverCompetitors() {
    if (!detail.value) return;
    const result = await write(`/opportunities/${detail.value.id}/competitor-discovery`, {});
    if (result) message.value = `Amazon 竞品采集已排队，任务编号 ${result.task_id}。`;
  }

  async function discoverSuppliers() {
    if (!detail.value) return;
    const result = await write("/sourcing/searches", {
      input_type: "opportunity",
      input_ref: detail.value.id,
    });
    if (result) message.value = `公开供应商采集已排队，任务编号 ${result.task_id}。`;
  }

  return { discoverCompetitors, discoverSuppliers };
}
