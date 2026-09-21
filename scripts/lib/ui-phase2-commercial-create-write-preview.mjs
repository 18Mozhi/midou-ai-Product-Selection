import assert from "node:assert/strict";
import { previewCommercialCreate } from "./ui-phase2-commercial-create-preview.mjs";

export const draftWriteUi = `const draftFeedback = ref("");
function closeDraftReview() {
  if (mutating.value) return;
  draftFeedback.value = "";
  creatingPlan.value = false;
}
function cancelDraftReview(event: Event) {
  event.preventDefault();
  closeDraftReview();
}
async function submitDraftReview(event: SubmitEvent) {
  if (mutating.value) return;
  draftFeedback.value = "";
  (event.currentTarget as HTMLFormElement).querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
  await createPlan();
}
`;
export const draftCatch =
  '    draftFeedback.value = error instanceof ApiClientError ? error.actionHint : "创建失败";\n';

export function previewCommercialCreateWrite(source) {
  let result = previewCommercialCreate(source);
  const marker = "async function createPlan() {";
  assert.equal(result.split(marker).length, 2);
  result = result.replace(marker, draftWriteUi + marker);
  const error =
    '    setNotice(error instanceof ApiClientError ? error.actionHint : "创建失败", "error");';
  assert.equal(result.split(error).length, 2);
  result = result.replace(error, draftCatch + error);
  const start = result.indexOf('<dialog class="p58-draft-c"'),
    end = result.indexOf("</dialog>", start);
  let dialog = result.slice(start, end);
  const replace = (before, after) => {
    assert.equal(dialog.split(before).length, 2, before);
    dialog = dialog.replace(before, after);
  };
  replace('@cancel="handleCreateCancel"', '@cancel="cancelDraftReview"');
  replace('@submit.prevent="createPlan"', '@submit.prevent="submitDraftReview($event)"');
  replace("<h3>创建配额方案草稿</h3>", '<h3 tabindex="-1">创建配额方案草稿</h3>');
  replace(
    'aria-label="关闭新建配额方案" @click="creatingPlan = false"',
    'aria-label="关闭新建配额方案" :disabled="mutating" @click="closeDraftReview"',
  );
  replace(
    ':disabled="mutating" @click="creatingPlan = false">取消',
    ':disabled="mutating" @click="closeDraftReview">取消',
  );
  replace(
    "          </header>",
    `          </header>
          <p v-if="mutating" class="p58-draft-wait" role="status">正在创建草稿，请等待本次结果。暂时不能修改或关闭此窗。</p>
          <section v-if="draftFeedback" class="p58-draft-feedback" role="alert" aria-label="本次创建反馈"><h4>本次创建未完成</h4><p>{{ draftFeedback }}</p><TechnicalDetails :request-id="requestId" /></section>`,
  );
  let fields = 0;
  dialog = dialog.replace(/<(input|textarea)\b/g, (_, tag) => {
    fields++;
    return `<${tag} :disabled="mutating"`;
  });
  assert.equal(fields, 7);
  return result.slice(0, start) + dialog + result.slice(end);
}
