import { compactOrganizationSelectors } from "./build/organization-css-compaction.mjs";

export default ({ env }) => ({
  plugins: env === "production" ? [compactOrganizationSelectors()] : [],
});
