import type { Ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import type * as OpportunityTypes from "./opportunity-workspace-types";
import type { createOpportunityWorkspaceForms } from "./opportunity-workspace-forms";

type OpportunityFeedbackForm = ReturnType<typeof createOpportunityWorkspaceForms>["feedbackForm"];
type OpportunityApiRequest = ReturnType<typeof createApiClient>;

interface OpportunityWorkspaceFeedbackWriteState {
  unknown: boolean;
  message: string;
  requestId: string;
}

interface OpportunityWorkspacePendingFeedbackWrite {
  idempotencyKey: string;
  body: Record<string, unknown>;
}

interface OpportunityWorkspaceFeedbackWriteOptions {
  request: OpportunityApiRequest;
  detail: Ref<OpportunityTypes.OpportunityDetail | null>;
  feedbackForm: OpportunityFeedbackForm;
  busy: Ref<boolean>;
  pendingFeedbackWrites: Ref<Record<string, OpportunityWorkspacePendingFeedbackWrite>>;
  feedbackWriteStates: Ref<Record<string, OpportunityWorkspaceFeedbackWriteState>>;
  requestId: Ref<string>;
  message: Ref<string>;
  currentWriteScopeGeneration: () => number;
  writeScopeKey: (opportunityId?: string) => string;
  beginScopedWrite: (scopeKey: string) => void;
  finishScopedWrite: (scopeKey: string) => void;
}

export function useOpportunityWorkspaceFeedbackWrites(
  options: OpportunityWorkspaceFeedbackWriteOptions,
) {
  const {
    request,
    detail,
    feedbackForm,
    busy,
    pendingFeedbackWrites,
    feedbackWriteStates,
    requestId,
    message,
    currentWriteScopeGeneration,
    writeScopeKey,
    beginScopedWrite,
    finishScopedWrite,
  } = options;

  async function submitOperatingFeedback() {
    if (!detail.value) return;
    const opportunityId = detail.value.id;
    let pending = pendingFeedbackWrites.value[opportunityId];
    if (!pending) {
      feedbackForm.observed_at = new Date().toISOString();
      pending = {
        idempotencyKey: crypto.randomUUID(),
        body: {
          ...feedbackForm,
          currency: feedbackForm.currency.toUpperCase(),
          expected_version: detail.value.version,
        },
      };
      pendingFeedbackWrites.value = {
        ...pendingFeedbackWrites.value,
        [opportunityId]: pending,
      };
    }
    await sendOperatingFeedback(opportunityId, pending);
  }

  async function retryUnknownOperatingFeedback() {
    const opportunityId = detail.value?.id;
    const pending = opportunityId ? pendingFeedbackWrites.value[opportunityId] : undefined;
    if (!opportunityId || !pending || !feedbackWriteStates.value[opportunityId]?.unknown) return;
    await sendOperatingFeedback(opportunityId, pending);
  }

  function markPendingFeedbackWritesUnknown() {
    const next = { ...feedbackWriteStates.value };
    let changed = false;
    for (const opportunityId of Object.keys(pendingFeedbackWrites.value)) {
      const current = next[opportunityId];
      if (current?.unknown) continue;
      next[opportunityId] = {
        unknown: true,
        message: "页面切换前未能确认本次提交结果；请返回该机会并用同一请求标识恢复核对。",
        requestId: current?.requestId ?? "",
      };
      changed = true;
    }
    if (changed) feedbackWriteStates.value = next;
  }

  async function sendOperatingFeedback(
    opportunityId: string,
    pending: OpportunityWorkspacePendingFeedbackWrite,
  ) {
    if (busy.value) return;
    const generation = currentWriteScopeGeneration();
    const scopeKey = writeScopeKey(opportunityId);
    const ownsScope = () => generation === currentWriteScopeGeneration();
    beginScopedWrite(scopeKey);
    message.value = "";
    feedbackWriteStates.value = {
      ...feedbackWriteStates.value,
      [opportunityId]: { unknown: false, message: "", requestId: "" },
    };
    try {
      const response = await request<OpportunityTypes.OpportunityDetail["operating_feedback"]>(
        `/opportunities/${opportunityId}/operating-feedback`,
        { method: "POST", body: pending.body, idempotencyKey: pending.idempotencyKey },
      );
      if (!ownsScope()) return;
      const result = response.data;
      if (!result || !Array.isArray(result.facts) || !("calibration" in result))
        throw new Error("服务端已响应，但返回内容不完整；请使用原请求标识恢复核对。");
      requestId.value = response.request_id;
      delete pendingFeedbackWrites.value[opportunityId];
      delete feedbackWriteStates.value[opportunityId];
      if (detail.value?.id !== opportunityId) return;
      detail.value.operating_feedback = result;
      feedbackForm.source_ref = "";
      feedbackForm.notes = "";
      message.value = "经营复盘事实已写入；规则和人工决策均未自动变更。";
    } catch (error) {
      if (!ownsScope()) return;
      const apiError = error instanceof ApiClientError ? error : null;
      const unknown = !apiError || apiError.status === 0 || apiError.status >= 500;
      const nextState = {
        unknown,
        message:
          apiError?.actionHint ?? (error instanceof Error ? error.message : "提交结果暂未确认。"),
        requestId: apiError?.requestId ?? "",
      };
      if (!unknown) delete pendingFeedbackWrites.value[opportunityId];
      feedbackWriteStates.value = {
        ...feedbackWriteStates.value,
        [opportunityId]: nextState,
      };
      if (nextState.requestId) requestId.value = nextState.requestId;
      message.value = nextState.message;
    } finally {
      finishScopedWrite(scopeKey);
    }
  }

  return {
    submitOperatingFeedback,
    retryUnknownOperatingFeedback,
    markPendingFeedbackWritesUnknown,
  };
}
