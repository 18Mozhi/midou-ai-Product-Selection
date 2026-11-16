# Browser collection in account mode

After verification of the production ownership seal, the Python crawler continues to use business-linked jobs. The API does not register standalone acquisition, heartbeat or completion. The old rehearsal flag only blocks writes in the historical rehearsal mode and is not a production control.

An account-native job is assigned only while its original collection task has a live lease and the task's native account agrees with the sealed task and exact subquery owners. Completion checks the same ownership before changing any result or creating a renewal task. A conflicting assignment remains unclaimed; completion returns 409 without rewriting the original task. An accepted browser run preserves the original business request and trace IDs. No limits, retries, credentials or provider configuration change.

Build the API and run the browser-chain, crawler boundary, lease and renewal tests, plus the Python crawler unit suite. Python already consumes the run ID and lease rather than legacy workspace fields. Activate via the approved BaoTa coordinator; it validates the new Node mode before starting Python. Local fixtures are not production crawl acceptance.
