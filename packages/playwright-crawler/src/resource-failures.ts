type ResourceFailure = Record<string, unknown>;

function priority(failure: ResourceFailure): number {
  if (["document", "script", "xhr", "fetch", "stylesheet"].includes(String(failure.resource_type)))
    return 2;
  return failure.resource_type === "proxy_connect" ? 1 : 0;
}

/** Keep bounded diagnostics without letting image/sync noise erase actionable failures. */
export function recordResourceFailure(
  failures: ResourceFailure[],
  failure: ResourceFailure,
): void {
  if (failures.length >= 10) {
    const lowest = Math.min(...failures.map(priority));
    if (priority(failure) < lowest) return;
    failures.splice(failures.findIndex((item) => priority(item) === lowest), 1);
  }
  failures.push(failure);
}
