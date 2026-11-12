import { ApiError, apiRequest, clearToken, getToken, setToken } from "./api.js";

function reply(status, body) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  clearToken();
  globalThis.fetch = vi.fn();
});

test("sends JSON with the saved token", async () => {
  setToken("abc");
  fetch.mockReturnValue(reply(200, {}));
  await apiRequest("/predict", { method: "POST", body: { age: 50 } });
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe("/api/predict");
  expect(options.method).toBe("POST");
  expect(options.headers.Authorization).toBe("Bearer abc");
  expect(options.headers["Content-Type"]).toBe("application/json");
  expect(JSON.parse(options.body)).toEqual({ age: 50 });
});

test("does not send a token header when logged out", async () => {
  fetch.mockReturnValue(reply(200, {}));
  await apiRequest("/auth/login", { method: "POST", body: {} });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
});

test("returns parsed JSON on success", async () => {
  fetch.mockReturnValue(reply(200, { user: { full_name: "Ali" } }));
  expect(await apiRequest("/auth/me")).toEqual({ user: { full_name: "Ali" } });
});

test("throws ApiError with message and fields", async () => {
  fetch.mockReturnValue(reply(400, {
    error: "Please correct the highlighted fields.",
    fields: { ap_hi: "Systolic blood pressure must be between 60 and 300 mmHg." },
  }));
  const error = await apiRequest("/predict", { method: "POST", body: {} }).catch((e) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(400);
  expect(error.message).toBe("Please correct the highlighted fields.");
  expect(error.fields.ap_hi).toBe("Systolic blood pressure must be between 60 and 300 mmHg.");
});

test("401 clears token and notifies logout", async () => {
  setToken("old");
  const listener = vi.fn();
  window.addEventListener("auth:logout", listener);
  fetch.mockReturnValue(reply(401, { error: "Please log in again." }));
  const error = await apiRequest("/history").catch((e) => e);
  window.removeEventListener("auth:logout", listener);
  expect(error.status).toBe(401);
  expect(getToken()).toBeNull();
  expect(listener).toHaveBeenCalledTimes(1);
});

test("network error gives server message", async () => {
  fetch.mockReturnValue(Promise.reject(new TypeError("Failed to fetch")));
  const error = await apiRequest("/history").catch((e) => e);
  expect(error.status).toBe(0);
  expect(error.message).toBe("Cannot reach the server. Please check that the backend is running.");
});

test("non-JSON error reply still gives a message", async () => {
  fetch.mockReturnValue(Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError("bad")) }));
  const error = await apiRequest("/history").catch((e) => e);
  expect(error.status).toBe(502);
  expect(error.message).toBe("Something went wrong. Please try again later.");
});

test("ApiError keeps the whole error reply as data", async () => {
  fetch.mockReturnValue(reply(503, { error: "Unavailable.", risk_category: "Moderate" }));
  const error = await apiRequest("/action-plan", { method: "POST", body: {} }).catch((e) => e);
  expect(error.data.risk_category).toBe("Moderate");
});
