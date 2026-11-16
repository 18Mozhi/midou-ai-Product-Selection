# Original evidence download after account cutover

Production pre-cutover readback joined 170,836 active raw evidence rows to active evidence assets. All 170,836 used the exact historical path, none used an account path, and the recorded size and digest matched on both sides of the join. This is a metadata check, not an assertion that all on-disk bytes were read.

Keep original files in place. For both historical and new paths the platform download endpoints retain their existing permission and now require the exact evidence, task, asset and sealed owner to agree in account mode. The signed grant binds owner, evidence, asset and physical path; the historical path must match the preserved task coordinates and original evidence ID. Do not copy, rename, or generate files for the cutover.

Download verifies size, SHA-256 and file identity, then rechecks the same database binding under lock and writes the audit event before returning any bytes. A changed path or expired or pre-cutover grant requires a fresh grant with a new idempotency key; an invalid owner or binding returns 404. Evidence records and existing audit actors are preserved.

No new setting or threshold. Use the same evidence root and existing short grant TTL. The API must restart via the approved BaoTa release coordinator for production to use this code. After release, verify a historical original via the authorized platform session and confirm its matching download audit; local tests do not replace this check.
