<script setup lang="ts">
import ProviderSourceEditDialog from "./ProviderSourceEditDialog.vue";
import ProviderSourceVersionHistoryDialog from "./ProviderSourceVersionHistoryDialog.vue";
import type {
  ConfigurationVersion,
  ProviderSourceConfigurationForm,
  ProviderSourceConfigurationPreview,
  ProviderSourceItem,
} from "./provider-source-types";

defineProps<{
  editing: ProviderSourceItem | null;
  form: ProviderSourceConfigurationForm;
  preview: ProviderSourceConfigurationPreview | null;
  saving: boolean;
  saveStage: string;
  saveTitle: string;
  saveDescription: string;
  saveRequestId: string;
  versionSource: ProviderSourceItem | null;
  versionLoading: boolean;
  versionHistory: ConfigurationVersion[];
  versionActionStage: string;
  versionActionTitle: string;
  versionActionDescription: string;
  versionActionRequestId: string;
  versionWriteConfirmed: boolean;
  rollingBack: number | null;
  rollbackReason: string;
}>();

const emit = defineEmits<{
  closeEdit: [];
  acknowledge: [];
  save: [];
  closeVersions: [];
  retryVersions: [];
  rollback: [version: ConfigurationVersion];
  "update:form": [form: ProviderSourceConfigurationForm];
  "update:rollbackReason": [value: string];
}>();
</script>

<template>
  <div class="provider-source-configuration-dialog">
    <ProviderSourceEditDialog
      :editing="editing"
      :form="form"
      :preview="preview"
      :saving="saving"
      :save-stage="saveStage"
      :save-title="saveTitle"
      :save-description="saveDescription"
      :save-request-id="saveRequestId"
      @close-edit="emit('closeEdit')"
      @acknowledge="emit('acknowledge')"
      @save="emit('save')"
      @update:form="emit('update:form', $event)"
    />
    <ProviderSourceVersionHistoryDialog
      :version-source="versionSource"
      :version-loading="versionLoading"
      :version-history="versionHistory"
      :version-action-stage="versionActionStage"
      :version-action-title="versionActionTitle"
      :version-action-description="versionActionDescription"
      :version-action-request-id="versionActionRequestId"
      :version-write-confirmed="versionWriteConfirmed"
      :rolling-back="rollingBack"
      :rollback-reason="rollbackReason"
      @close-versions="emit('closeVersions')"
      @retry-versions="emit('retryVersions')"
      @rollback="emit('rollback', $event)"
      @update:rollback-reason="emit('update:rollbackReason', $event)"
    />
  </div>
</template>

<style src="./ProviderSourceConfigurationDialog.css"></style>
