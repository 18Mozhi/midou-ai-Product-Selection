# Account API startup entry

The executable API entry resolves the runtime mode immediately after creating the MySQL pool and before opening Redis or starting the listener. The production retired mode requires the fixed database identity, exact migration receipts, ownership seal and physical table checks. Failure closes the pool and exits; it does not fall back to the old runtime.

The verified mode drives session identity, evidence, selection, scoring, sourcing, intelligence, competitor, task and approval registration. In account mode the legacy tenancy, organization administration, resource-grant and workspace dashboard routes are not registered. Platform role checks remain independent of ownership and the real historical audit remains readable in its authorized scope.

No new environment setting. Use the existing coordinator-managed `ACCOUNT_SCOPE_MODE` in `release.env`, never a manual production flip. The release packager runs the compiled API entry and account authorization fixtures on the built candidate before any upload; a successful build alone is not sufficient. Approved release must restart Node through BaoTa. Local startup and route tests do not establish production data migration or authenticated acceptance.
