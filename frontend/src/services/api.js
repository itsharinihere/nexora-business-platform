/**
 * Thin fetch wrapper around the NEXORA REST API.
 *
 * Responsibilities kept in one place:
 *  - base URL / prefix
 *  - bearer token from storage
 *  - JSON encode + decode
 *  - unwrapping the `{ success, data, meta }` envelope
 *  - normalising every failure into a typed `ApiError`
 *  - one automatic retry for transient network failures
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'nexora.token';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error', details = null, isNetworkError = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isNetworkError = isNetworkError;
  }

  /** Field-keyed messages for form rendering. */
  get fieldErrors() {
    return this.details && typeof this.details === 'object' ? this.details : {};
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable (private mode) - session stays in memory only */
    }
  },
  clear: () => tokenStore.set(null),
};

/** Called by AuthContext so a 401 can drop the session without an import cycle. */
let unauthorizedHandler = null;
export const onUnauthorized = (handler) => {
  unauthorizedHandler = handler;
};

const NETWORK_ERRORS = new Set([
  'Failed to fetch',
  'NetworkError when attempting to fetch resource',
  'Load failed',
]);

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function request(path, { method = 'GET', body, params, signal, retry = true } = {}) {
  const url = `${BASE_URL}${path}${buildQuery(params)}`;
  const token = tokenStore.get();

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    // Retry once: a single dropped connection should not surface as an error.
    if (retry) {
      return request(path, { method, body, params, signal, retry: false });
    }
    const message = NETWORK_ERRORS.has(error?.message)
      ? 'Cannot reach the server. Check your connection and try again.'
      : 'Something went wrong while contacting the server.';
    throw new ApiError(message, { isNetworkError: true });
  }

  if (response.status === 204) return null;

  const payload = await parseBody(response);

  if (!response.ok) {
    const error = payload?.error ?? {};
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
    throw new ApiError(error.message || `Request failed with status ${response.status}`, {
      status: response.status,
      code: error.code || 'error',
      details: error.details ?? null,
    });
  }

  // The envelope always carries `success`; unwrap it so callers get `data`.
  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (payload.meta !== undefined) {
      return { data: payload.data, meta: payload.meta };
    }
    return payload.data;
  }

  return payload;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

/** Stable message for any thrown value, safe to show in a toast. */
export function errorMessage(error) {
  if (error instanceof ApiError) return error.message;
  if (error?.message) return error.message;
  return 'An unexpected error occurred.';
}

export { BASE_URL };