import assert from "node:assert/strict";
import { previewAlibaba1688AcceptanceActions } from "./ui-phase2-1688-acceptance-actions-preview.mjs";

export const acceptanceRobustnessContract = {
  themes: ["deep-ocean", "aurora-purple", "cloud-white"],
  densities: ["standard", "compact"],
  smallestWidth: 320,
  zoomStress: "component-css-zoom-200",
};

export function previewAlibaba1688AcceptanceRobustness(source) {
  const review = previewAlibaba1688AcceptanceActions(source),
    anchor = 'class="acceptance-1688 p49-acceptance"';
  assert.equal(review.split(anchor).length, 2, "P49 robustness root anchor");
  return review.replace(anchor, 'class="acceptance-1688 p49-acceptance p49-robustness"');
}
