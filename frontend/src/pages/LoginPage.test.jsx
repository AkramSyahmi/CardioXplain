import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearToken, setToken } from "../api.js";
import { ADMIN, USER, mockApi, renderApp } from "../test/helpers.jsx";

beforeEach(() => clearToken());

async function signIn(email = "ali@mail.com", password = "Passw0rd!") {
  await userEvent.type(screen.getByLabelText("Email Address"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
}

test("sign in shows the API message on wrong password", async () => {
  mockApi({ "POST /auth/login": [401, { error: "Invalid email or password" }] });
  renderApp("/login");
  await signIn("ali@mail.com", "wrong");
  expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
});

test("sign in sends general user to dashboard", async () => {
  mockApi({ "POST /auth/login": [200, { token: "t1", user: USER }] });
  renderApp("/login");
  await signIn();
  expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  expect(screen.getByText(/Ali Ahmad/)).toBeInTheDocument();
});

test("sign in sends admin to admin page", async () => {
  mockApi({ "POST /auth/login": [200, { token: "t2", user: ADMIN }] });
  renderApp("/login");
  await signIn("admin@cardioxplain.com");
  expect(await screen.findByRole("heading", { name: "Model Performance" })).toBeInTheDocument();
});

test("create account checks confirm password locally", async () => {
  const api = mockApi({});
  renderApp("/login");
  await userEvent.click(screen.getByRole("tab", { name: "Create Account" }));
  await userEvent.type(screen.getByLabelText("Full Name"), "Ali Ahmad");
  await userEvent.type(screen.getByLabelText("Email Address"), "ali@mail.com");
  await userEvent.type(screen.getByLabelText("Password"), "Passw0rd!");
  await userEvent.type(screen.getByLabelText("Confirm Password"), "Different1");
  await userEvent.click(screen.getByRole("button", { name: "Create my account" }));
  expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});

test("create account shows field errors from the API, then success switches to sign in", async () => {
  const rule = "Password must contain at least 8 characters including uppercase, lowercase, and a number.";
  let attempt = 0;
  mockApi({
    "POST /auth/register": () => (attempt++ === 0
      ? [400, { error: "Please correct the highlighted fields.", fields: { password: rule } }]
      : [201, { message: "Registration successful. Please log in." }]),
  });
  renderApp("/login");
  await userEvent.click(screen.getByRole("tab", { name: "Create Account" }));
  await userEvent.type(screen.getByLabelText("Full Name"), "Ali Ahmad");
  await userEvent.type(screen.getByLabelText("Email Address"), "ali@mail.com");
  await userEvent.type(screen.getByLabelText("Password"), "weakpass");
  await userEvent.type(screen.getByLabelText("Confirm Password"), "weakpass");
  await userEvent.click(screen.getByRole("button", { name: "Create my account" }));
  expect(await screen.findByText(rule)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Create my account" }));
  expect(await screen.findByText("Registration successful. Please log in.")).toBeInTheDocument();
  expect(screen.queryByLabelText("Confirm Password")).not.toBeInTheDocument();
});

test("protected route sends logged-out user to login", async () => {
  mockApi({});
  renderApp("/history");
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
});

test("general user cannot open admin page", async () => {
  setToken("t1");
  mockApi({ "GET /auth/me": [200, { user: USER }] });
  renderApp("/admin/users");
  expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
});

test("saved login is restored on page load", async () => {
  setToken("t1");
  mockApi({ "GET /auth/me": [200, { user: USER }] });
  renderApp("/");
  expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
});

test("logout event sends user to login", async () => {
  setToken("t1");
  mockApi({ "GET /auth/me": [200, { user: USER }] });
  renderApp("/dashboard");
  await screen.findByRole("heading", { name: "Dashboard" });
  window.dispatchEvent(new Event("auth:logout"));
  expect(await screen.findByText("Please log in again.")).toBeInTheDocument();
});

test("sign out returns to login and forgets the token", async () => {
  setToken("t1");
  mockApi({ "GET /auth/me": [200, { user: USER }] });
  renderApp("/dashboard");
  await userEvent.click(await screen.findByRole("button", { name: "Sign Out" }));
  expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  expect(localStorage.getItem("cardioxplain_token")).toBeNull();
});

test("wrong password does not also say please log in again", async () => {
  mockApi({ "POST /auth/login": [401, { error: "Invalid email or password" }] });
  renderApp("/login");
  await signIn("ali@mail.com", "wrong");
  await screen.findByText("Invalid email or password");
  expect(screen.queryByText("Please log in again.")).not.toBeInTheDocument();
});

test("refresh while the backend is down keeps the saved login and says why", async () => {
  setToken("t1");
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new SyntaxError()) }));
  renderApp("/dashboard");
  expect(await screen.findByText("Cannot reach the server. Please check that the backend is running.")).toBeInTheDocument();
  expect(localStorage.getItem("cardioxplain_token")).toBe("t1");
});
