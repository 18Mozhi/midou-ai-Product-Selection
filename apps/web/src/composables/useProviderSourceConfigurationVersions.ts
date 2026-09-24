import { onBeforeUnmount, ref } from "vue";
import type { Ref } from "vue";
import { ApiClientError } from "../api-client";
import type { ApiEnvelope, ApiRequestOptions } from "../api-client";
import type {
  ConfigurationVersion,
  ProviderSourceItem as SourceItem,
} from "../components/provider-source-types";

type ProviderSourceRequest = <T>(
  path: string,
  options?: ApiRequestOptions,
) => Promise<ApiEnvelope<T>>;

type VersionActionStage =
  | "idle"
  | "submitting"
  | "reloading"
  | "success"
  | "sync_failed"
  | "read_failed"
  | "conflict"
  | "forbidden"
  | "failed";

interface UseProviderSourceConfigurationVersionsOptions {
  request: ProviderSourceRequest;
  loadCatalog: () => Promise<boolean>;
  items: Ref<SourceItem[]>;
  message: Ref<string>;
  requestId: Ref<string>;
}

export function useProviderSourceConfigurationVersions({
  request,
  loadCatalog,
  items,
  message,
  requestId,
}: UseProviderSourceConfigurationVersionsOptions) {
  const versionSource = ref<SourceItem | null>(null);
  const versionLoading = ref(false);
  const versionHistory = ref<ConfigurationVersion[]>([]);
  const versionCurrentVersion = ref<number | null>(null);
  const rollingBack = ref<number | null>(null);
  const versionActionStage = ref<VersionActionStage>("idle");
  const versionActionTitle = ref("");
  const versionActionDescription = ref("");
  const versionActionRequestId = ref("");
  const versionLastTarget = ref<number | null>(null);
  const versionWriteConfirmed = ref(false);
  const rollbackReason = ref("恢复已验证的来源采集设置");
  let versionOwnership = 0;

  async function loadConfigurationVersions(item: SourceItem) {
    if (!item.provisioned) return;
    message.value = "";
    requestId.value = "";
    const operation = ++versionOwnership;
    const providerId = item.provisioned.id;
    versionSource.value = item;
    versionLoading.value = true;
    versionHistory.value = [];
    versionCurrentVersion.value = null;
    rollbackReason.value = "恢复已验证的来源采集设置";
    versionLastTarget.value = null;
    versionWriteConfirmed.value = false;
    setVersionActionFeedback("idle", "", "");
    try {
      const result = await fetchConfigurationVersions(item);
      if (!ownsVersionOperation(operation, providerId)) return;
      versionLoading.value = false;
      if (result.ok) {
        applyConfigurationVersions(result);
      } else {
        setVersionActionFeedback("read_failed", result.title, result.description, result.requestId);
      }
    } finally {
      if (ownsVersionOperation(operation, providerId)) versionLoading.value = false;
    }
  }

  function setVersionActionFeedback(
    stage: VersionActionStage,
    title: string,
    description: string,
    technicalRequestId = "",
  ) {
    versionActionStage.value = stage;
    versionActionTitle.value = title;
    versionActionDescription.value = description;
    versionActionRequestId.value = technicalRequestId;
    message.value = "";
    requestId.value = "";
  }

  function ownsVersionOperation(operation: number, providerId: string) {
    return operation === versionOwnership && versionSource.value?.provisioned?.id === providerId;
  }

  function closeConfigurationVersions() {
    if (rollingBack.value !== null) return;
    versionOwnership += 1;
    versionSource.value = null;
    versionActionStage.value = "idle";
    versionActionRequestId.value = "";
    versionLastTarget.value = null;
    versionWriteConfirmed.value = false;
  }

  function configurationVersionFailure(error: unknown, mode: "read" | "rollback") {
    const failure = error instanceof ApiClientError ? error : null;
    if (mode === "read") {
      if (failure?.kind === "expired")
        return ["read_failed", "登录状态已失效", "重新登录后，可以再次读取配置历史。"] as const;
      if (failure?.kind === "forbidden")
        return [
          "read_failed",
          "当前权限还不能查看配置历史",
          "权限调整后，可以在此重新读取。",
        ] as const;
      if (failure?.kind === "rate_limited")
        return ["read_failed", "读取请求较多，请稍后再试", failure.actionHint] as const;
      return [
        "read_failed",
        "配置历史暂时未能读取",
        failure?.actionHint ?? "来源目录仍可使用；可以在此重新读取配置历史。",
      ] as const;
    }
    if (failure?.kind === "conflict")
      return [
        "conflict",
        "当前版本已经变化",
        "配置没有修改。请读取最新版本后，再选择需要恢复的版本。",
      ] as const;
    if (failure?.kind === "forbidden")
      return [
        "forbidden",
        "当前权限还不能恢复配置",
        "配置没有修改。权限调整后，可以重新读取历史再操作。",
      ] as const;
    if (failure?.kind === "expired")
      return [
        "failed",
        "登录状态已失效",
        "尚未确认生成新版本。重新登录并核对历史后再操作。",
      ] as const;
    return [
      "failed",
      "尚未确认生成新版本",
      "请保留当前原因并核对服务状态，再决定是否重新提交。",
    ] as const;
  }

  async function fetchConfigurationVersions(item: SourceItem) {
    try {
      const response = await request<{
        current_version?: unknown;
        versions?: ConfigurationVersion[];
      }>(`/platform/provider-sources/${item.provisioned?.id}/configuration/versions`);
      const currentVersion = Number(response.data?.current_version);
      if (!Number.isInteger(currentVersion) || currentVersion < 1)
        return {
          ok: false as const,
          title: "配置历史响应不完整",
          description: "当前版本编号无效；本窗不会把这次响应显示为有效历史。",
          requestId: response.request_id,
        };
      return {
        ok: true as const,
        currentVersion,
        versions: response.data?.versions ?? [],
        requestId: response.request_id,
      };
    } catch (error) {
      const [, title, description] = configurationVersionFailure(error, "read");
      return {
        ok: false as const,
        title,
        description,
        requestId: error instanceof ApiClientError ? error.requestId : "",
      };
    }
  }

  function applyConfigurationVersions(result: {
    currentVersion: number;
    versions: ConfigurationVersion[];
  }) {
    versionCurrentVersion.value = result.currentVersion;
    versionHistory.value = result.versions;
  }

  async function reloadVersionSurfaces(
    operation: number,
    sourceSnapshot: SourceItem,
    successTitle: string,
    successDescription: string,
  ) {
    const providerId = sourceSnapshot.provisioned?.id;
    if (!providerId) return false;
    const catalogLoaded = await loadCatalog();
    if (!ownsVersionOperation(operation, providerId)) return false;
    const catalogFailure = message.value;
    const catalogRequestId = requestId.value;
    message.value = "";
    requestId.value = "";
    if (!catalogLoaded) {
      setVersionActionFeedback(
        "sync_failed",
        versionWriteConfirmed.value ? "新版本已生成，来源目录尚未更新" : "最新来源目录暂时未能读取",
        versionWriteConfirmed.value
          ? "本窗仍显示操作前历史，不会把旧内容当作最新结果。"
          : catalogFailure || "当前页面不会把旧内容当作最新配置。",
        catalogRequestId,
      );
      return false;
    }
    const refreshed = items.value.find((item) => item.code === sourceSnapshot.code);
    if (!refreshed?.provisioned) {
      setVersionActionFeedback(
        "sync_failed",
        versionWriteConfirmed.value
          ? "新版本已生成，来源目录尚未找到该来源"
          : "当前目录未找到该来源",
        "本窗保留已知历史，但不会把它标记为最新结果。",
      );
      return false;
    }
    versionSource.value = refreshed;
    const result = await fetchConfigurationVersions(refreshed);
    if (!ownsVersionOperation(operation, providerId)) return false;
    if (!result.ok) {
      setVersionActionFeedback(
        "sync_failed",
        versionWriteConfirmed.value ? "新版本已生成，配置历史尚未更新" : "最新配置历史暂时未能读取",
        versionWriteConfirmed.value
          ? "本窗仍显示操作前历史，不会把旧内容当作最新结果。"
          : result.description,
        result.requestId,
      );
      return false;
    }
    applyConfigurationVersions(result);
    setVersionActionFeedback("success", successTitle, successDescription, result.requestId);
    return true;
  }

  async function rollbackConfiguration(version: ConfigurationVersion) {
    const sourceSnapshot = versionSource.value;
    const source = sourceSnapshot?.provisioned;
    const expectedVersion = versionCurrentVersion.value;
    const reason = rollbackReason.value.trim();
    if (
      !sourceSnapshot ||
      !source ||
      expectedVersion === null ||
      !version.rollback_available ||
      reason.length < 2 ||
      rollingBack.value !== null
    )
      return;
    const operation = ++versionOwnership;
    const providerId = source.id;
    rollingBack.value = version.version;
    versionLastTarget.value = version.version;
    versionWriteConfirmed.value = false;
    setVersionActionFeedback(
      "submitting",
      "正在生成新的当前版本",
      `正在把第 ${version.version} 版的安全设置写成新版本；完成前不会再次提交。`,
    );
    try {
      const response = await request(
        `/platform/provider-sources/${providerId}/configuration/rollbacks`,
        {
          method: "POST",
          body: JSON.stringify({
            target_version: version.version,
            expected_version: expectedVersion,
            reason,
          }),
        },
      );
      if (!ownsVersionOperation(operation, providerId)) return;
      versionWriteConfirmed.value = true;
      setVersionActionFeedback(
        "reloading",
        "新版本已生成，正在核对目录与历史",
        "写入结果已经确认；正在读取新的当前版本。",
        response.request_id,
      );
      await reloadVersionSurfaces(
        operation,
        sourceSnapshot,
        "已生成新的当前版本",
        `已从第 ${version.version} 版恢复；原有历史保持不变。`,
      );
    } catch (error) {
      if (!ownsVersionOperation(operation, providerId)) return;
      const [stage, title, description] = configurationVersionFailure(error, "rollback");
      setVersionActionFeedback(
        stage,
        title,
        description,
        error instanceof ApiClientError ? error.requestId : "",
      );
    } finally {
      if (ownsVersionOperation(operation, providerId)) rollingBack.value = null;
    }
  }

  async function retryConfigurationVersions() {
    const sourceSnapshot = versionSource.value;
    const providerId = sourceSnapshot?.provisioned?.id;
    if (!sourceSnapshot || !providerId || rollingBack.value !== null) return;
    if (versionActionStage.value === "read_failed") {
      await loadConfigurationVersions(sourceSnapshot);
      return;
    }
    const operation = ++versionOwnership;
    const wroteVersion = versionWriteConfirmed.value;
    setVersionActionFeedback(
      "reloading",
      wroteVersion ? "正在重新核对目录与历史" : "正在读取最新版本",
      wroteVersion ? "不会再次提交回滚，只进行安全读取。" : "正在读取服务端当前版本。",
    );
    await reloadVersionSurfaces(
      operation,
      sourceSnapshot,
      wroteVersion ? "新的当前版本已确认" : "已读取最新版本",
      wroteVersion
        ? `第 ${versionLastTarget.value ?? "—"} 版已恢复为新的当前版本，原有历史保持不变。`
        : "配置历史已更新，可以重新选择需要恢复的版本。",
    );
  }

  onBeforeUnmount(() => {
    versionOwnership += 1;
  });

  return {
    versionSource,
    versionLoading,
    versionHistory,
    versionCurrentVersion,
    rollingBack,
    versionActionStage,
    versionActionTitle,
    versionActionDescription,
    versionActionRequestId,
    versionWriteConfirmed,
    rollbackReason,
    loadConfigurationVersions,
    closeConfigurationVersions,
    retryConfigurationVersions,
    rollbackConfiguration,
  };
}
