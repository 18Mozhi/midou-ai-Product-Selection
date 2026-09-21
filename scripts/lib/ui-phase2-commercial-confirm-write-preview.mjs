import assert from "node:assert/strict";
import { previewCommercialConfirm } from "./ui-phase2-commercial-confirm-preview.mjs";
import { draftFocusBoundary } from "./ui-phase2-commercial-create-focus-preview.mjs";

export const confirmFocusBoundary = draftFocusBoundary.replace(
  "keepDraftFocus",
  "keepConfirmFocus",
);
export const confirmWriteUi = `const confirmWriteFeedback = ref<{ operation: any; hint: string; requestId: string } | null>(null);
function closeConfirmReview() {
  if (mutating.value) return;
  confirmWriteFeedback.value = null;
  pending.value = null;
}
function cancelConfirmReview(event: Event) {
  event.preventDefault();
  closeConfirmReview();
}
async function submitConfirmReview(event: SubmitEvent) {
  if (mutating.value || !pending.value) return;
  confirmWriteFeedback.value = null;
  const heading = (event.currentTarget as HTMLFormElement).querySelector<HTMLElement>("h3");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "center", inline: "nearest" });
  }
  await confirm();
}
`;
export const confirmWriteCatch = `    if (pending.value === operation) confirmWriteFeedback.value = {
      operation,
      hint: error instanceof ApiClientError ? error.actionHint : "变更未完成",
      requestId: error instanceof ApiClientError ? error.requestId ?? "" : "",
    };
`;

export function previewCommercialConfirmWrite(source) {
  let result = previewCommercialConfirm(source);
  const marker = "async function confirm() {";
  assert.equal(result.split(marker).length, 2);
  result = result.replace(marker, confirmFocusBoundary + confirmWriteUi + marker);
  const notice =
    '    setNotice(error instanceof ApiClientError ? error.actionHint : "变更未完成", "error");';
  assert.equal(result.split(notice).length, 2);
  result = result.replace(notice, confirmWriteCatch + notice);
  const start = result.indexOf('<dialog class="p58-impact-c"'),
    end = result.indexOf("</dialog>", start);
  assert.ok(start > 0 && end > start);
  let dialog = result.slice(start, end);
  const replace = (before, after) => {
    assert.equal(dialog.split(before).length, 2, before);
    dialog = dialog.replace(before, after);
  };
  replace(
    '@cancel="handleConfirmCancel"',
    '@cancel="cancelConfirmReview" @keydown="keepConfirmFocus"',
  );
  replace('@submit.prevent="confirm"', '@submit.prevent="submitConfirmReview($event)"');
  replace('@click="pending = null"', '@click="closeConfirmReview"');
  replace(
    "</p></header>",
    `</p></header>
          <p v-if="mutating" class="p58-impact-wait" role="status">正在提交，请等待本次结果。暂时不能关闭此窗。</p>
          <section v-if="confirmWriteFeedback && confirmWriteFeedback.operation === pending" class="p58-impact-feedback" role="alert" aria-label="本次请求反馈">
            <h4>本次请求反馈</h4><p>{{ confirmWriteFeedback.hint }}</p><TechnicalDetails :request-id="confirmWriteFeedback.requestId" />
          </section>`,
  );
  return result.slice(0, start) + dialog + result.slice(end);
}
