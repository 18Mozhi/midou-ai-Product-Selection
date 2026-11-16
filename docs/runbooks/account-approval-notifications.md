# Account notification and approval delivery

After the cutover the existing recipient keeps the original notification and its delivery history. The inbox and event stream only return delivered in-app entries for that verified recipient. Preferences are resolved by account; delivery settings and historical notification IDs are not reset.

An inbox mutation requires ownership and the original deliverable item before returning a saved receipt. The same key may replay only the same notification, action and expected version; a different request returns 409 without another mutation or audit write. A notification no longer delivered to the account returns 404.

Worker delivery verifies the original event, approval resource, template and active approver. In overdue cost review the verified primary replaces the former organization-admin escalation where authorized; the named reviewer is not replaced. This check neither approves the underlying item nor replays historical audit-only deliveries.

In the retired API, the cost-rule worklist and both decision slots require the native rule account to agree with its sealed owner. Both main-account and named-manager actions check the locked rule before using an idempotency receipt. A mismatch is hidden from the worklist and returns 404 on a direct decision, without overwriting any historical signature, event, or delivery.

Build API and Worker and run the notification, realtime and account approval fixtures. No new settings. Restart API and Worker via the approved BaoTa coordinator. After deployment validate a historical inbox entry and route and observe the next real eligible approval notification; local fixtures do not establish production delivery.
