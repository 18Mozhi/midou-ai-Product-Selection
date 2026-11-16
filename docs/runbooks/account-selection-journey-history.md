# Original selection journeys after account cutover

The verified account may read an original historical selection journey and its original task, decision actor, request and trace identifiers. Query the sealed owner and the native task account together. An optional selection or evidence reference is shown only if the exact referenced record exists and its present native and sealed ownership also match. The API does not rewrite IDs or offer legacy journey creation or decision writes in account mode.

The production baseline was checked read-only: eight historical journeys and six decision rows, with zero missing original task, selection, journey or selected evidence references. These counts are a pre-cutover inventory, not post-cutover readback.

No new setting. Build the API, run the selection acceptance and historical journey tests, and restart Node through the approved BaoTa coordinator. Post-release verify the original IDs and actors under their verified owner; do not replay a decision to test the history endpoint.
