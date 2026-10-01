import { nextTick, shallowRef } from "vue";

export type OpportunityDecisionFocusIntent = {
  opportunityId: string;
  action: "adopt" | "observe" | "reject";
};

interface OpportunityWorkspaceDecisionFocusOptions {
  opportunityId: () => string | undefined;
  workspaceActive: () => boolean;
}

export function useOpportunityWorkspaceDecisionFocus(
  options: OpportunityWorkspaceDecisionFocusOptions,
) {
  const { opportunityId: getOpportunityId, workspaceActive } = options;
  const pendingDecisionFocus = shallowRef<OpportunityDecisionFocusIntent | null>(null);

  function captureDecisionFocus(opportunityId: string | undefined) {
    if (!opportunityId || typeof document === "undefined") return;
    const waiting = document.querySelector(".opportunity-decision-waiting");
    const activeElement = document.activeElement;
    if (!(waiting instanceof HTMLElement) || !(activeElement instanceof HTMLElement)) return;
    if (!waiting.contains(activeElement)) return;
    const label = activeElement
      .closest<HTMLButtonElement>("button")
      ?.textContent?.replace(/\s+/g, "");
    const action = label?.includes("继续观察")
      ? "observe"
      : label?.includes("驳回")
        ? "reject"
        : "adopt";
    pendingDecisionFocus.value = { opportunityId, action };
  }

  async function restoreDecisionFocus(currentOpportunityId: string) {
    const intent = pendingDecisionFocus.value;
    pendingDecisionFocus.value = null;
    if (
      !intent ||
      intent.opportunityId !== currentOpportunityId ||
      getOpportunityId() !== currentOpportunityId ||
      !workspaceActive() ||
      typeof document === "undefined"
    )
      return;
    await nextTick();
    if (getOpportunityId() !== currentOpportunityId || !workspaceActive()) return;
    const actionLabel =
      intent.action === "adopt" ? "采纳建议" : intent.action === "observe" ? "继续观察" : "驳回";
    const action = Array.from(
      document.querySelector("#opportunity-decision-actions")?.querySelectorAll("button") ?? [],
    ).find((button) => button.textContent?.replace(/\s+/g, "").includes(actionLabel));
    if (action && !action.disabled) {
      action.focus({ preventScroll: true });
      return;
    }
    document
      .querySelector<HTMLElement>("#opportunity-decision-actions details summary")
      ?.focus({ preventScroll: true });
  }

  return { pendingDecisionFocus, captureDecisionFocus, restoreDecisionFocus };
}
