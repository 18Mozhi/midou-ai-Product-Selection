# Account evidence write and replay

In the retired runtime, evidence capture requires an unexpired running-task lease. The native task account, sealed task owner and exact subquery owner must agree. A task ID, lease, or provider match on its own is not sufficient.

Raw capture and browser artifact replay reuse the original IDs and file only when the original evidence and exact file asset belong to the same account. If the file's ledger and native owner disagree, the transaction rolls back before adding a link or writing a replacement file. Legacy capture keeps its existing organization/workspace checks. Historical records are not overwritten, copied or removed by replay.

Provider execution carries the verified account and lease into browser and raw writes. Subquery completion locks the original task, verifies its account, attempt and active lease, and updates only the original subquery and provider. The completion event inherits that account in the same transaction; an expired lease or missing ownership rolls the write back. Replay status and parser-drift auto-pause recheck the same active task; native pause audits retain only the real task and account, without fabricated organization or workspace values.

No new configuration, threshold, queue policy or scheduled task. Worker changes take effect on restart through the approved BaoTa release coordinator, not on the currently running version.

Verify with `npm run build:worker`, followed by the evidence tests in `tests/m03-06` and the account owner, browser collection, file verification and provider persistence circuit tests in `tests/unit`. The tests cover valid replay, rejected lease scope, missing and foreign ownership, and rollback without a new evidence file. Production historical file accessibility must be read back independently after deployment.
