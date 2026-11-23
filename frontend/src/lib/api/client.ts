// =============================================================================
// The API client.
// -----------------------------------------------------------------------------
// Every call to the backend goes through here.
//
// The access token lives in an httpOnly cookie, so the page's
// JavaScript never sees it: the client sends `credentials: "include"`
// and the browser attaches the cookie. The server functions read the
// cookie from the incoming request and forward it as an
// `Authorization: Bearer` header.
//
// When the access token expires the API answers 401. The client
// refreshes it once and retries the request, so a fifteen-minute
// session does not interrupt the user.
// =============================================================================

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8010").replace(/\/$/, "");

/** The error the API returns. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;

  constructor(status: number, message: string, code = "error", body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }

  /** True when the failure is about the session rather than the request. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Internal: prevents an infinite refresh loop. */
  _retried?: boolean;
};

/** A single-flight refresh, so concurrent 401s trigger one refresh. */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the refresh cookie for a new access token.
 *
 * The refresh token lives in an httpOnly cookie too, so the browser
 * sends it automatically. The response sets a fresh cookie.
 */
async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_URL}/v1/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: "" }),
        });
        return response.ok;
      } catch {
        return false;
      } finally {
        // Let the next 401 start a new refresh.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function readError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  let message = `Request failed with status ${response.status}`;
  let code = "error";

  try {
    body = await response.json();
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      if (typeof record.detail === "string") {
        message = record.detail;
      } else if (Array.isArray(record.detail)) {
        // FastAPI's validation errors: show the first one.
        const first = record.detail[0] as { msg?: string } | undefined;
        message = first?.msg ?? message;
      }
      // The backend explains a refusal field by field (the contrast of
      // a colour, for example). Those reasons are more useful than the
      // generic summary, so they go with it.
      const fields = record.fields;
      if (fields && typeof fields === "object" && !Array.isArray(fields)) {
        const reasons = Object.values(fields as Record<string, unknown>)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .map((value) => value.replace(/\.$/, ""));
        if (reasons.length > 0) {
          message = `${message}. ${reasons.join(" ")}`;
        }
      }
      if (typeof record.code === "string") {
        code = record.code;
      }
    }
  } catch {
    // The body was not JSON; the status is all we have.
  }

  return new ApiError(response.status, message, code, body);
}

/**
 * Call the API.
 *
 * On a 401 the session is refreshed once and the request retried. A
 * second 401 is returned to the caller: the session is really over.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, _retried } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && !_retried) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }
  }

  if (!response.ok) {
    throw await readError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as unknown as T;
  }

  return (await response.json()) as T;
}

// --- Verb helpers ----------------------------------------------------------

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) =>
    apiRequest<T>(path, { method: "GET", query }),

  post: <T>(path: string, body?: unknown, query?: RequestOptions["query"]) =>
    apiRequest<T>(path, { method: "POST", body, query }),

  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PATCH", body }),

  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }),

  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};

/** The base URL of the API, for the places that need it directly. */
export const apiBaseUrl = API_URL;

/**
 * Call the API from the server.
 *
 * The server functions run on the server, where the browser's cookie
 * is not available: the caller passes the access token it read from
 * the incoming request.
 */
export async function apiRequestAs<T>(
  path: string,
  accessToken: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw await readError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as unknown as T;
  }

  return (await response.json()) as T;
}

export const apiAs = {
  get: <T>(path: string, accessToken: string, query?: RequestOptions["query"]) =>
    apiRequestAs<T>(path, accessToken, { method: "GET", query }),

  post: <T>(path: string, accessToken: string, body?: unknown, query?: RequestOptions["query"]) =>
    apiRequestAs<T>(path, accessToken, { method: "POST", body, query }),

  patch: <T>(path: string, accessToken: string, body?: unknown) =>
    apiRequestAs<T>(path, accessToken, { method: "PATCH", body }),

  put: <T>(path: string, accessToken: string, body?: unknown) =>
    apiRequestAs<T>(path, accessToken, { method: "PUT", body }),

  delete: <T>(path: string, accessToken: string) =>
    apiRequestAs<T>(path, accessToken, { method: "DELETE" }),
};
