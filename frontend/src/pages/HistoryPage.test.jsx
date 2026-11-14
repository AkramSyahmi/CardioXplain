import { screen, within } from "@testing-library/react";
import { setToken } from "../api.js";
import { USER, mockApi, renderApp } from "../test/helpers.jsx";

const PREDICTIONS = Array.from({ length: 7 }, (_, i) => ({
  prediction_id: 20 - i, prediction_date: `2026-06-${String(12 - i).padStart(2, "0")}T08:48:00`,
  risk_score: 0.5, risk_percent: 50 - i, risk_category: "Moderate",
}));

beforeEach(() => setToken("t1"));

test("history lists all past results newest first", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, { predictions: PREDICTIONS }] });
  renderApp("/history");
  const rows = within(await screen.findByRole("table")).getAllByRole("row");
  expect(rows).toHaveLength(8); // header + all 7, not just 5
  expect(within(rows[1]).getByText("50%")).toBeInTheDocument();
  expect(within(rows[1]).getByRole("link", { name: "View" })).toHaveAttribute("href", "/result/20");
  expect(within(rows[7]).getByRole("link", { name: "View" })).toHaveAttribute("href", "/result/14");
  expect(screen.queryByRole("button", { name: /delete|edit/i })).not.toBeInTheDocument();
});

test("history shows empty message", async () => {
  mockApi({
    "GET /auth/me": [200, { user: USER }],
    "GET /history": [200, { predictions: [], message: "No prediction history found. Please complete a Risk Assessment." }],
  });
  renderApp("/history");
  expect(await screen.findByText("No prediction history found. Please complete a Risk Assessment.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Start risk assessment" })).toHaveAttribute("href", "/assessment");
});
