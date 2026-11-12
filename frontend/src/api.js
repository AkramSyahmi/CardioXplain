// One place for every call to the Flask API (Phase 4 endpoints under /api).

const TOKEN_KEY = "cardioxplain_token";
const SERVER_DOWN = "Cannot reach the server. Please check that the backend is running.";
const GENERIC_ERROR = "Something went wrong. Please try again later.";

export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
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

  const data = await response.json().catch(() => ({}));
  if (response.ok) return data;

  if (response.status === 401) {
    // Expired, invalid or deactivated login: forget it and tell the app to go to the login page.
    clearToken();
    window.dispatchEvent(new Event("auth:logout"));
  }
  throw new ApiError(response.status, data.error || GENERIC_ERROR, data.fields || {});
}
