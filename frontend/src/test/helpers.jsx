// Test helpers: a fake API and a way to render the whole app at a given URL.
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppRoutes } from "../App.jsx";
import { AuthProvider } from "../auth.jsx";

export const USER = { user_id: 1, full_name: "Ali Ahmad", email: "ali@mail.com", role: "general_user" };
export const ADMIN = { user_id: 2, full_name: "Admin", email: "admin@cardioxplain.com", role: "admin" };

/**
 * Replace fetch. routes: { "POST /auth/login": [200, {...}] | (body) => [status, body] }.
 * Unknown routes return 404. Returns the mock so tests can inspect calls.
 */
export function mockApi(routes) {
  globalThis.fetch = vi.fn((url, options = {}) => {
    const key = `${options.method || "GET"} ${url.replace(/^\/api/, "")}`;
    const handler = routes[key];
    const body = options.body ? JSON.parse(options.body) : undefined;
    const [status, data] = typeof handler === "function" ? handler(body) : handler || [404, { error: "Not found." }];
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(data) });
  });
  return globalThis.fetch;
}

export function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}
