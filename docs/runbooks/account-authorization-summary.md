# Account authorization summary

After the cutover, `GET /api/v1/me/authorization` verifies the session and ownership receipt without choosing or restoring an organization or workspace. It reports null legacy coordinates, no organization roles or scopes, and only the existing account read capabilities in the member summary. Platform grants still come from the active platform assignments for that same account. The summary does not authorize a mutation or add platform, selection-manager or workflow approval permissions.

Personal Center and platform audit can load without a legacy session. The organization authorization and resource-grant screens stop before making a scoped request when the summary has no organization. The legacy deployment retains its previous response and permissions.

No new settings or flags. Build the contracts, authorization package, API and frontend. Run the account authorization fixture, M01-04 authorization tests, and account startup checks. Deploy through the approved coordinator to load the new API and frontend; the formal acceptance is a verified member summary plus unchanged platform-role behavior on the production release.
