/** Client-safe fetch helpers shared across every page. */

const UNREACHABLE = "Clinic Desk's server could not be reached. Check that the app is running.";

/** An error carrying the HTTP status, so callers can tell a 503 setup problem from a 502 upstream failure. */
export class ApiError extends Error {
  status: number;
  /** True when the failure is a missing/rejected configuration (HTTP 503 from the API). */
  isConfig: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isConfig = status === 503;
  }
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError(UNREACHABLE, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
  return data as T;
}

/**
 * POST JSON. `timeoutMs` puts a ceiling on the wait so a stalled server can never leave a
 * button loading forever; hitting it is reported as a 504 with a message that says so.
 */
export async function postJson<T>(url: string, body: unknown, opts: { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = opts.timeoutMs ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl?.signal });
  } catch (e) {
    if (ctrl?.signal.aborted) {
      throw new ApiError(`No response after ${Math.round((opts.timeoutMs ?? 0) / 1000)} seconds. The server may still be busy — try again in a moment.`, 504);
    }
    throw new ApiError(UNREACHABLE, 0);
  } finally {
    if (timer) clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
  return data as T;
}
