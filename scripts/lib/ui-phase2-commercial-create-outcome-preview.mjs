import assert from "node:assert/strict";
import { previewCommercialCreateWrite } from "./ui-phase2-commercial-create-write-preview.mjs";

export const outcomeState = `type DraftReadResult = { kind: "ready" | "failed"; requestId: string; hint: string };
type DraftReceipt = { name: string; code: string; writeId: string; readId: string; hint: string; readState: "pending" | "ready" | "failed" | "unsettled" };
const draftReceipt = ref<DraftReceipt | null>(null);
function settleDraftRead(receipt: DraftReceipt, result?: DraftReadResult) {
  receipt.readState = result?.kind ?? "unsettled";
  receipt.readId = result?.requestId ?? "";
  receipt.hint = result?.hint ?? "本次读取尚未完成核对，可以重新读取当前目录。";
}
async function rereadDraftCatalog(event: MouseEvent) {
  if (refreshing.value || mutating.value || !draftReceipt.value) return;
  const receipt = draftReceipt.value;
  (event.currentTarget as HTMLElement).closest(".p58-draft-result")?.querySelector<HTMLElement>("[data-read-title]")?.focus({ preventScroll: true });
  receipt.readState = "pending";
  receipt.hint = "";
  receipt.readId = "";
  const result = await load({ preserveNotice: true });
  if (draftReceipt.value !== receipt) return;
  settleDraftRead(receipt, result);
  if (result?.kind === "ready") {
    requestId.value = receipt.writeId;
    setNotice("配额方案草稿已创建；启用前不影响任何组织。", "success");
  }
}
`;

export const outcomeTemplate = `
    <section v-if="draftReceipt" class="p58-draft-result" aria-label="本次草稿创建结果">
      <section class="p58-draft-written" aria-label="创建结果">
        <p class="p58-draft-result-eyebrow">创建结果</p>
        <h3>草稿已创建</h3>
        <p>{{ draftReceipt.name }} · {{ draftReceipt.code }}</p>
        <p>尚未启用，不影响任何组织。无需重复创建。</p>
        <TechnicalDetails :request-id="draftReceipt.writeId" summary="本次创建追踪" />
      </section>
      <section class="p58-draft-reread" aria-label="创建后的目录核对">
        <div role="status" aria-live="polite" aria-atomic="true">
          <h3 tabindex="-1" data-read-title>{{ draftReceipt.readState === "pending" ? "正在更新目录" : draftReceipt.readState === "ready" ? "目录读取完成" : draftReceipt.readState === "failed" ? "目录暂未更新" : "目录尚待核对" }}</h3>
          <p v-if="draftReceipt.readState === 'pending'">创建已完成，正在读取目录；这不是再次创建。</p>
          <p v-else-if="draftReceipt.readState === 'ready'">本次目录读取已完成，可在下方核对方案记录。</p>
          <template v-else><p>{{ draftReceipt.hint }}</p><p>{{ draftReceipt.readState === "failed" ? "创建结果不受影响。下方仍是上次成功读取的内容。" : "创建结果不受影响，目录内容仍需核对。" }}</p></template>
        </div>
        <TechnicalDetails :request-id="draftReceipt.readId" summary="本次目录读取追踪" />
        <button v-if="draftReceipt.readState !== 'ready'" class="p58-draft-reread-button" type="button" :disabled="refreshing || mutating" @click="rereadDraftCatalog($event)">{{ draftReceipt.readState === 'pending' ? "正在读取目录…" : "重新读取当前目录" }}</button>
      </section>
    </section>
`;

export function previewCommercialCreateOutcome(source) {
  let result = previewCommercialCreateWrite(source);
  const replace = (before, after) => {
    assert.equal(result.split(before).length, 2, before);
    result = result.replace(before, after);
  };
  replace('const draftFeedback = ref("");', outcomeState + 'const draftFeedback = ref("");');
  // Only add a return contract to load; existing call sites may keep ignoring it.
  const loadStart = result.indexOf("async function load("),
    loadEnd = result.indexOf(outcomeState, loadStart);
  assert.ok(loadStart > 0 && loadEnd > loadStart);
  let load = result.slice(loadStart, loadEnd);
  assert.equal(load.split("    syncLocation();\n  } catch (error) {").length, 2);
  load = load.replace(
    "    syncLocation();\n  } catch (error) {",
    '    syncLocation();\n    return { kind: "ready" as const, requestId: requestId.value, hint: "" };\n  } catch (error) {',
  );
  assert.equal(load.split("  } finally {").length, 2);
  load = load.replace(
    "  } finally {",
    '    return { kind: "failed" as const, requestId: failure?.requestId ?? "", hint: timedOut ? "读取超时，请稍后重试。" : failure?.actionHint ?? "读取失败" };\n  } finally {',
  );
  result = result.slice(0, loadStart) + load + result.slice(loadEnd);
  const createStart = result.indexOf("async function createPlan() {"),
    createEnd = result.indexOf("function beginEditPlan(", createStart);
  let create = result.slice(createStart, createEnd);
  const swap = (before, after) => {
    assert.equal(create.split(before).length, 2, before);
    create = create.replace(before, after);
  };
  swap(
    "  mutating.value = true;",
    "  const identity = { name: plan.value.name, code: plan.value.code };\n  draftReceipt.value = null;\n  mutating.value = true;",
  );
  swap(
    "    const mutationRequestId = requestId.value;",
    '    const mutationRequestId = requestId.value;\n    draftReceipt.value = { ...identity, writeId: mutationRequestId, readId: "", hint: "", readState: "pending" };\n    const receipt = draftReceipt.value;',
  );
  swap(
    "    await load({ preserveNotice: true });",
    "    const readResult = await load({ preserveNotice: true });\n    if (draftReceipt.value === receipt) settleDraftRead(receipt, readResult);",
  );
  swap(
    "    requestId.value = mutationRequestId;",
    '    if (readResult?.kind === "ready") requestId.value = mutationRequestId;',
  );
  swap(
    '    setNotice("配额方案草稿已创建；启用前不影响任何组织。", "success");',
    '    if (readResult?.kind === "ready") setNotice("配额方案草稿已创建；启用前不影响任何组织。", "success");',
  );
  result = result.slice(0, createStart) + create + result.slice(createEnd);
  const noticeAnchor = result.includes('    <p v-if="notice && loadedOnce" class="notice"')
    ? '    <p v-if="notice && loadedOnce" class="notice"'
    : '    <p v-if="notice" class="notice"';
  replace(noticeAnchor, outcomeTemplate + noticeAnchor);
  return result;
}
