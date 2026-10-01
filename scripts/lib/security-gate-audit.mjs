export function npmAuditExecutionFailed({ status, signal, error, report }) {
  if (error || signal || status === null || report?.error) return true;
  const vulnerabilities = report?.metadata?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities.total !== "number") return true;
  return status !== 0 && vulnerabilities.total === 0;
}
