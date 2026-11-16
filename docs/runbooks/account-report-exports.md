# Account report exports

After the cutover, opportunity and intelligence reports read only records belonging to the verified account. CSV requests and replay use the exact account, report type, format and original export reference. Historical metadata and original CSV paths are preserved; new files use the account path. No new team reports are produced, and their historical metadata is not removed.

Download refuses mismatched ownership, linked or changed files, and bytes that do not match the recorded size and SHA-256. The Worker locks the current export owner and lease before writing; a lost lease cannot overwrite another run's file or result. Expiry policy and row limits remain unchanged.

The production 0177 prerequisite was checked read-only: zero export records and zero active exports blocking migration. There is no real historical CSV sample in that database to validate. Build storage, API and Worker, and run the report tests under `tests/m05-06` and `tests/unit/account-report-exports.test.mjs`. No new setting. Deploy and restart API/Worker via the approved coordinator; post-release acceptance requires a real owned export and a matching download.
