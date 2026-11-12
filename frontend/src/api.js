// One place for every call to the Flask API (Phase 4 endpoints under /api).

const TOKEN_KEY = "cardioxplain_token";
const SERVER_DOWN = "Cannot reach the server. Please check that the backend is running.";
const GENERIC_ERROR = "Something went wrong. Please try again later.";

export class ApiError extends Error {
  constructor(status, message, fields = {}, data = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.data = data; // the whole error reply, e.g. risk_category on a 503
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, SERVER_DOWN);
  }

  const data = await response.json().catch(() => null);
  if (response.ok) return data ?? {};

  if (response.status === 401 && token) {
    // Expired, invalid or deactivated login: forget it and tell the app to go to the login page.
    // (A 401 without a saved login is just a wrong password on the login page.)
    clearToken();
    window.dispatchEvent(new Event("auth:logout"));
  }
  if (data === null && response.status >= 500) {
    // No JSON from a server error: Flask is not running (e.g. the Vite proxy answers 500 with no body).
    throw new ApiError(response.status, SERVER_DOWN);
  }
  throw new ApiError(response.status, data?.error || GENERIC_ERROR, data?.fields || {}, data ?? {});
}
