import { screen, within } from "@testing-library/react";
import { setToken } from "../api.js";
import { RESULT, USER, mockApi, renderApp } from "../test/helpers.jsx";

beforeEach(() => setToken("t1"));

test("result page loads from API after refresh", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history/7": [200, RESULT] });
  renderApp("/result/7");
  expect(await screen.findByText("41%")).toBeInTheDocument();
  expect(api.mock.calls.some(([url]) => url === "/api/history/7")).toBe(true);
});

test("result view shows score, factors and narrative", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history/7": [200, RESULT] });
  renderApp("/result/7");
  expect(await screen.findByText("Moderate")).toBeInTheDocument();
  const table = screen.getByRole("table", { name: "Factor contributions" });
  const rows = within(table).getAllByRole("row");
  expect(within(rows[1]).getByText("Systolic blood pressure")).toBeInTheDocument();
  expect(within(rows[1]).getByText("+15.2%")).toBeInTheDocument();
  expect(within(rows[1]).getByText("Raises risk")).toBeInTheDocument();
  expect(within(rows[2]).getByText("-3.1%")).toBeInTheDocument();
  expect(within(rows[2]).getByText("Lowers risk")).toBeInTheDocument();
  expect(screen.getByText(RESULT.narrative.text)).toBeInTheDocument();
  expect(screen.getByText(RESULT.disclaimer)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "What-If Lifestyle Simulator" })).toHaveAttribute("href", "/simulator");
});

test("result view shows shap_error when shap is null", async () => {
  const noShap = { ...RESULT, shap: null, shap_error: "The explanation could not be generated. Please try the assessment again." };
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history/7": [200, noShap] });
  renderApp("/result/7");
  expect(await screen.findByText(noShap.shap_error)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("result page shows not found message", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history/99": [404, { error: "Prediction not found." }] });
  renderApp("/result/99");
  expect(await screen.findByText("Prediction not found.")).toBeInTheDocument();
});
