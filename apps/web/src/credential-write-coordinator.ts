import { readonly, shallowRef } from "vue";

export type CredentialWriteOutcome = "success" | "unknown" | "failure" | "partial";

export interface CredentialWriteSettlement {
  label: string;
  outcome: CredentialWriteOutcome;
  actionHint: string;
  message: string;
  requestId: string;
}

export interface CredentialWriteOperation {
  id: number;
  label: string;
  settlement: CredentialWriteSettlement | null;
}

const operation = shallowRef<CredentialWriteOperation | null>(null);
let nextOperationId = 0;

export const credentialWriteOperation = readonly(operation);

export function beginCredentialWrite(label: string): number | null {
  if (operation.value) return null;
  const id = ++nextOperationId;
  operation.value = { id, label, settlement: null };
  return id;
}

export function settleCredentialWrite(id: number, settlement: CredentialWriteSettlement): boolean {
  if (operation.value?.id !== id) return false;
  operation.value = { ...operation.value, settlement };
  return true;
}

export function finishCredentialWrite(id: number): boolean {
  if (operation.value?.id !== id) return false;
  operation.value = null;
  return true;
}

export function consumeCredentialWriteSettlement(id: number): boolean {
  if (operation.value?.id !== id || !operation.value.settlement) return false;
  operation.value = null;
  return true;
}
