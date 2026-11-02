import { readCaptureSourceRevision } from "./ui-phase2-token-copy-baseline.mjs";

// Archived driver composition only. Never install this source in the current app.
export const readArchivedApprovalsParent = () =>
  readCaptureSourceRevision(
    "scripts/verify-ui-phase2-org-approvals-parent.mjs",
    "42806da668b4dc3fa4e278a62e2922b34c1a3363474bb548ae3f72dd9f0b96ed",
  );
