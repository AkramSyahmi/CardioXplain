import { screen, within } from "@testing-library/react";
import { setToken } from "../api.js";
import { USER, mockApi, renderApp } from "../test/helpers.jsx";

const HISTORY = {
  predictions: [
    { prediction_id: 9, prediction_date: "2026-06-12T08:48:00", risk_score: 0.66, risk_percent: 66, risk_category: "Moderate" },
    { prediction_id: 4, prediction_date: "2026-05-01T10:00:00", risk_score: 0.31, risk_percent: 31, risk_category: "Low" },
  ],
};

beforeEach(() => setToken("t1"));

test("shows stats from history", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, HISTORY] });
  renderApp("/dashboard");
  expect(await screen.findByText(/Welcome back, Ali!/)).toBeInTheDocument();
  const stats = await screen.findByRole("list", { name: "Summary" });
  expect(within(stats).getByText(/Total assessments: 2/)).toBeInTheDocument();
  expect(within(stats).getByText(/Latest risk score: 66%/)).toBeInTheDocument();
  expect(within(stats).getByText(/Risk category: Moderate/)).toBeInTheDocument();
  expect(within(stats).getByText(/Last assessment: 12 Jun 2026/)).toBeInTheDocument();
  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows).toHaveLength(3); // header + 2
  expect(within(rows[1]).getByRole("link", { name: "View" })).toHaveAttribute("href", "/result/9");
  expect(screen.getByRole("link", { name: "Start risk assessment" })).toHaveAttribute("href", "/assessment");
  expect(screen.getByText(/not a medical diagnosis/)).toBeInTheDocument();
});

test("shows only the latest 5 assessments", async () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ ...HISTORY.predictions[0], prediction_id: 20 - i }));
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, { predictions: many }] });
  renderApp("/dashboard");
  await screen.findByText(/Welcome back, Ali!/);
  expect(within(await screen.findByRole("table")).getAllByRole("row")).toHaveLength(6);
  expect(screen.getByText(/Total assessments: 7/)).toBeInTheDocument();
});

test("shows empty history message", async () => {
  mockApi({
    "GET /auth/me": [200, { user: USER }],
    "GET /history": [200, { predictions: [], message: "No prediction history found. Please complete a Risk Assessment." }],
  });
  renderApp("/dashboard");
  expect(await screen.findByText("No prediction history found. Please complete a Risk Assessment.")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("shows the API error if history cannot load", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [500, { error: "Something went wrong. Please try again later." }] });
  renderApp("/dashboard");
  expect(await screen.findByText("Something went wrong. Please try again later.")).toBeInTheDocument();
});
