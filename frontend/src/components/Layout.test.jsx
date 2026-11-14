import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setToken } from "../api.js";
import { USER, mockApi, renderApp } from "../test/helpers.jsx";

beforeEach(() => setToken("t1"));

test("current page link is marked and every link stays available", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, { predictions: [], message: "No assessments yet." }] });
  renderApp("/dashboard");
  const nav = await screen.findByRole("navigation", { name: "Main" });
  expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  expect(within(nav).getByRole("link", { name: "Care Navigator" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
});

test("clicking the logo goes to the user's home page", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, { predictions: [], message: "No assessments yet." }],
    "GET /navigator": [200, { messages: [] }] });
  renderApp("/navigator");
  await userEvent.click(await screen.findByRole("link", { name: "CardioXplain home" }));
  expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
});

test("every page after login has a footer with the disclaimer", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, { predictions: [], message: "No assessments yet." }] });
  renderApp("/dashboard");
  const footer = await screen.findByRole("contentinfo");
  expect(within(footer).getByText(/Results are not a medical diagnosis/)).toBeInTheDocument();
  expect(within(footer).getByText(/Final Year Project/)).toBeInTheDocument();
});
