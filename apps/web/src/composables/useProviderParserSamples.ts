import { onBeforeUnmount, reactive, ref } from "vue";
import type { Ref } from "vue";
import { useProviderParserSampleActions } from "./useProviderParserSampleActions";
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
  let sampleReadController: AbortController | null = null;

  function ownsSampleContext(operation: number, providerId: string) {
    return (
      operation === sampleContextOperation && sampleSource.value?.provisioned?.id === providerId
    );
  }

  function openParserSamples(item: SourceItem) {
    if (!item.provisioned) return;
    const operation = ++sampleContextOperation;
    sampleReadController?.abort();
    sampleReadController = null;
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
    sampleReadController?.abort();
    sampleReadController = null;
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
    sampleReadController?.abort();
    const controller = new AbortController();
    sampleReadController = controller;
    const isCurrent = () =>
      !controller.signal.aborted &&
      readOperation === sampleReadOperation &&
      ownsSampleContext(contextOperation, providerId);
    sampleLoading.value = true;
    sampleReadError.value = "";
    try {
      const result = await api<{
        samples?: ParserSample[];
        candidates?: ParserSampleCandidate[];
      }>(
        `/platform/provider-sources/${providerId}/parser-samples`,
        { signal: controller.signal },
        isCurrent,
      );
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
      if (sampleReadController === controller) sampleReadController = null;
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

  const { createParserSample, replayParserSample, reviewParserSample } =
    useProviderParserSampleActions({
      api,
      message,
      requestId,
      sampleSource,
      sampleSaving,
      sampleReplaying,
      sampleReviewing,
      sampleActionMessage,
      sampleActionRequestId,
      latestReplay,
      currentContext: () => sampleContextOperation,
      ownsContext: ownsSampleContext,
      readSamples: readParserSamples,
    });

  onBeforeUnmount(() => {
    sampleContextOperation += 1;
    sampleReadOperation += 1;
    sampleReadController?.abort();
    sampleReadController = null;
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
