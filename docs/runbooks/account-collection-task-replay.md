# Collection task history and replay after account cutover

Platform list and detail require matching native and sealed task ownership. Summaries show the account ID; legacy organization/workspace filters are not accepted in account mode. Keep task, attempt, event, dead-letter and trace IDs. Detail does not return lease tokens, credentials or internal query inputs.

The existing `collection:replay` permission, origin check and reason requirement remain. Apply replay only to a valid open dead letter tied to the original attempt. The new task and its subqueries, events and delivery keep the source account and ownership reason, not the operator's account. Record the real operator separately. The original transition, exact dead-letter update, child ownership and receipt commit atomically.

The same key and reason return the already committed task. Following a concurrent commit, the receipt and returned graph use current reads, even if a previous read opened an older snapshot. A changed reason, missing or foreign subquery, or owner mismatch returns 409 without a second task. No automatic replay, retry-policy, limit or scheduled task change.

Verify with `npm run build:api`, `npm run typecheck:web`, and the collection task and replay tests in `tests/m03-05` and `tests/unit`. Deploy the API and built frontend through the approved BaoTa coordinator; no separate Worker restart is needed for this slice. After release, use platform readback to verify historical tasks without triggering an unsolicited replay.
