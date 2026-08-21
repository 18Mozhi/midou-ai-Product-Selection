export class BrowserConfigError extends Error {
  readonly code = "invalid_browser_config";
  constructor(
    readonly key: string,
    message: string,
  ) {
    super(`${key}: ${message}`);
    this.name = "BrowserConfigError";
  }
}

export function browserConfig(env: Record<string, string | boolean | undefined>) {
  const forbidden = Object.keys(env).filter(
    (key) => key.startsWith("VITE_") && key !== "VITE_API_BASE_URL",
  );
  if (forbidden.length)
    throw new BrowserConfigError(forbidden[0]!, "is not allowed in the browser bundle");
  const apiBaseUrl =
    typeof env.VITE_API_BASE_URL === "string" && env.VITE_API_BASE_URL.trim()
      ? env.VITE_API_BASE_URL.trim()
      : "/api/v1";
  return Object.freeze({ apiBaseUrl });
}
