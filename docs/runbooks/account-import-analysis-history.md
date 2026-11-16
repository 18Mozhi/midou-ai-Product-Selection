# ERP receipts and AI history after cutover

An old ERP request may return its saved receipt only to the original verified caller if the exact task still matches both native and sealed ownership. The receipt cannot enqueue a new import, inherit another caller's identity or allow a different result task. Imported selections already present remain in their native account and may be read through the normal selection and task surfaces.

The AI history endpoint returns original results and review signatures only through a matching owned selection and exact request/result/review references. The account runtime does not register the old AI generation or review writes, and the Worker does not poll the legacy AI generation queue. Historical rows are not rewritten, rerun or used as new decisions.

Production pre-cutover readback found zero ERP import receipts, zero AI requests/results/reviews and zero active AI jobs. No nonempty production history is claimed. No new setting. Build and verify API and Worker, then restart both through the approved BaoTa coordinator.
