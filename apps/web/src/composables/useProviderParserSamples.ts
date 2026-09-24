import { onBeforeUnmount, reactive, ref } from "vue";
import type { Ref } from "vue";
import { ApiClientError } from "../api-client";
import type {
  ParserSample,
  ParserSampleCandidate,
  ParserSampleReplay,
  ProviderSourceItem as SourceItem,
} from "../components/provider-source-types";

type ProviderSourceApi = <T>(
  path: string,
  options?: RequestInit,
  isCurrent?: () => boolean,
) => Promise<T>;

interface UseProviderParserSamplesOptions {
  api: ProviderSourceApi;
  message: Ref<string>;
  requestId: Ref<string>;
}

export function useProviderParserSamples({
  api,
  message,
  requestId,
}: UseProviderParserSamplesOptions) {
  const sampleSource = ref<SourceItem | null>(null);
  const sampleLoading = ref(false);
  const sampleReadLoaded = ref(false);
  const sampleReadError = ref("");
  const sampleReadRequestId = ref("");
  const sampleActionMessage = ref("");
  const sampleActionRequestId = ref("");
  const sampleSaving = ref<string | null>(null);
  const sampleReplaying = ref<string | null>(null);
  const sampleReviewing = ref<string | null>(null);
  const sampleOverview = reactive<{
    samples: ParserSample[];
    candidates: ParserSampleCandidate[];
  }>({ samples: [], candidates: [] });
  const latestReplay = ref<ParserSampleReplay | null>(null);
  let sampleContextOperation = 0;
  let sampleReadOperation = 0;

  function ownsSampleContext(operation: number, providerId: string) {
    return (
      operation === sampleContextOperation && sampleSource.value?.provisioned?.id === providerId
    );
  }

  function openParserSamples(item: SourceItem) {
    if (!item.provisioned) return;
    const operation = ++sampleContextOperation;
    sampleReadOperation += 1;
    sampleSource.value = item;
    sampleLoading.value = false;
    sampleReadLoaded.value = false;
    sampleReadError.value = "";
    sampleReadRequestId.value = "";
    sampleActionMessage.value = "";
    sampleActionRequestId.value = "";
    sampleOverview.samples = [];
    sampleOverview.candidates = [];
    latestReplay.value = null;
    message.value = "";
    requestId.value = "";
    void readParserSamples(item, operation);
  }

  function closeParserSamples() {
    sampleContextOperation += 1;
    sampleReadOperation += 1;
    sampleSource.value = null;
    sampleLoading.value = false;
    sampleReadLoaded.value = false;
    sampleReadError.value = "";
    sampleReadRequestId.value = "";
    sampleActionMessage.value = "";
    sampleActionRequestId.value = "";
  }

  async function readParserSamples(item: SourceItem, contextOperation: number) {
    const providerId = item.provisioned?.id;
    if (!providerId || !ownsSampleContext(contextOperation, providerId)) return false;
    const readOperation = ++sampleReadOperation;
    const isCurrent = () =>
      readOperation === sampleReadOperation && ownsSampleContext(contextOperation, providerId);
    sampleLoading.value = true;
    sampleReadError.value = "";
    try {
      const result = await api<{
        samples?: ParserSample[];
        candidates?: ParserSampleCandidate[];
      }>(`/platform/provider-sources/${providerId}/parser-samples`, {}, isCurrent);
      if (!isCurrent()) return false;
      sampleOverview.samples = result?.samples ?? [];
      sampleOverview.candidates = result?.candidates ?? [];
      sampleReadLoaded.value = true;
      sampleReadError.value = "";
      sampleReadRequestId.value = "";
      return true;
    } catch {
      if (!isCurrent()) return false;
      sampleReadError.value = message.value || "固定样本列表暂时未能更新。";
      sampleReadRequestId.value = requestId.value;
      if (!sampleReadLoaded.value) {
        const errorMessage = sampleReadError.value;
        closeParserSamples();
        message.value = errorMessage;
      }
      message.value = "";
      requestId.value = "";
      return false;
    } finally {
      if (isCurrent()) sampleLoading.value = false;
    }
  }

  async function retryParserSamples() {
    const sourceSnapshot = sampleSource.value;
    const providerId = sourceSnapshot?.provisioned?.id;
    if (!sourceSnapshot || !providerId || sampleLoading.value) return;
    const operation = sampleContextOperation;
    if (
      (await readParserSamples(sourceSnapshot, operation)) &&
      ownsSampleContext(operation, providerId)
    ) {
      sampleActionMessage.value = "样本列表已更新；请依据当前样本状态继续操作。";
      sampleActionRequestId.value = requestId.value;
    }
  }

  async function createParserSample(candidate: ParserSampleCandidate) {
    const sourceSnapshot = sampleSource.value;
    const providerId = sourceSnapshot?.provisioned?.id;
    if (
      !sourceSnapshot ||
      !providerId ||
      sampleSaving.value ||
      sampleReplaying.value ||
      sampleReviewing.value
    )
      return;
    const operation = sampleContextOperation;
    const isCurrent = () => ownsSampleContext(operation, providerId);
    sampleSaving.value = candidate.browser_job_id;
    sampleActionMessage.value = "正在固定真实登录作业的样本。";
    sampleActionRequestId.value = "";
    try {
      await api(
        `/platform/provider-sources/${providerId}/parser-samples`,
        {
          method: "POST",
          body: JSON.stringify({
            browser_job_id: candidate.browser_job_id,
            name: `真实登录样本 ${new Date(candidate.captured_at).toLocaleString("zh-CN")}`,
          }),
        },
        isCurrent,
      );
      if (!isCurrent()) return;
      sampleActionRequestId.value = requestId.value;
      sampleActionMessage.value = "样本已固定，正在更新候选与样本列表。";
      if (await readParserSamples(sourceSnapshot, operation))
        sampleActionMessage.value = "已从真实登录作业固定样本；请执行差异回放后再启用来源。";
      else if (isCurrent())
        sampleActionMessage.value = "样本已固定，但列表暂未能更新；可重新读取列表。";
    } catch (error) {
      if (!isCurrent()) return;
      sampleActionMessage.value =
        error instanceof ApiClientError
          ? error.actionHint
          : "固定结果暂未确认，请读取样本列表后再决定下一步。";
      sampleActionRequestId.value = error instanceof ApiClientError ? error.requestId : "";
      message.value = "";
      requestId.value = "";
    } finally {
      if (isCurrent()) sampleSaving.value = null;
    }
  }

  async function replayParserSample(sample: ParserSample) {
    const sourceSnapshot = sampleSource.value;
    const providerId = sourceSnapshot?.provisioned?.id;
    if (
      !sourceSnapshot ||
      !providerId ||
      sampleSaving.value ||
      sampleReplaying.value ||
      sampleReviewing.value
    )
      return;
    const operation = sampleContextOperation;
    const isCurrent = () => ownsSampleContext(operation, providerId);
    sampleReplaying.value = sample.id;
    sampleActionMessage.value = "正在读取已保存快照并执行当前解析器回放。";
    sampleActionRequestId.value = "";
    try {
      const result = await api<ParserSampleReplay>(
        `/platform/provider-sources/${providerId}/parser-samples/${sample.id}/replays`,
        { method: "POST" },
        isCurrent,
      );
      if (!isCurrent()) return;
      latestReplay.value = result;
      sampleActionRequestId.value = requestId.value;
      sampleActionMessage.value = "回放结果已留存，正在更新样本列表。";
      if (await readParserSamples(sourceSnapshot, operation))
        sampleActionMessage.value =
          result.status === "passed"
            ? "固定样本与当前解析结果一致。"
            : "回放已留存差异，来源继续保持停用。";
      else if (isCurrent()) sampleActionMessage.value = "回放结果已留存，但样本列表暂未能更新。";
    } catch (error) {
      if (!isCurrent()) return;
      sampleActionMessage.value =
        error instanceof ApiClientError
          ? error.actionHint
          : "回放结果暂未确认，请读取样本列表后核对状态。";
      sampleActionRequestId.value = error instanceof ApiClientError ? error.requestId : "";
      message.value = "";
      requestId.value = "";
    } finally {
      if (isCurrent()) sampleReplaying.value = null;
    }
  }

  async function reviewParserSample(
    sample: ParserSample,
    decision: "approved" | "rejected",
    reason: string,
  ) {
    const sourceSnapshot = sampleSource.value;
    const providerId = sourceSnapshot?.provisioned?.id;
    if (
      !sourceSnapshot ||
      !providerId ||
      sampleSaving.value ||
      sampleReplaying.value ||
      sampleReviewing.value
    )
      return;
    const operation = sampleContextOperation;
    const isCurrent = () => ownsSampleContext(operation, providerId);
    sampleReviewing.value = sample.id;
    sampleActionMessage.value = "正在记录独立管理员的复核决定。";
    sampleActionRequestId.value = "";
    try {
      await api(
        `/platform/provider-sources/${providerId}/parser-samples/${sample.id}/reviews`,
        {
          method: "POST",
          body: JSON.stringify({
            decision,
            reason: reason.trim(),
            expected_version: sample.review_version,
          }),
        },
        isCurrent,
      );
      if (!isCurrent()) return;
      sampleActionRequestId.value = requestId.value;
      sampleActionMessage.value = "复核决定已记录，正在更新样本列表。";
      if (await readParserSamples(sourceSnapshot, operation))
        sampleActionMessage.value =
          decision === "approved"
            ? "固定样本审批通过；当前解析器回放一致后可启用来源。"
            : "固定样本已驳回并保留审计记录；请从新的真实作业重新固定样本。";
      else if (isCurrent()) sampleActionMessage.value = "复核决定已记录，但样本列表暂未能更新。";
    } catch (error) {
      if (!isCurrent()) return;
      sampleActionMessage.value =
        error instanceof ApiClientError
          ? error.actionHint
          : "复核结果暂未确认，请读取样本列表后核对状态。";
      sampleActionRequestId.value = error instanceof ApiClientError ? error.requestId : "";
      message.value = "";
      requestId.value = "";
    } finally {
      if (isCurrent()) sampleReviewing.value = null;
    }
  }

  onBeforeUnmount(() => {
    sampleContextOperation += 1;
    sampleReadOperation += 1;
  });

  return {
    sampleSource,
    sampleLoading,
    sampleReadLoaded,
    sampleReadError,
    sampleReadRequestId,
    sampleActionMessage,
    sampleActionRequestId,
    sampleSaving,
    sampleReplaying,
    sampleReviewing,
    sampleOverview,
    latestReplay,
    openParserSamples,
    closeParserSamples,
    retryParserSamples,
    createParserSample,
    replayParserSample,
    reviewParserSample,
  };
}
