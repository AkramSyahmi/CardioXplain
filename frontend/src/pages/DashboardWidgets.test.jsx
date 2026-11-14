import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setToken } from "../api.js";
import { RESULT, USER, mockApi, renderApp } from "../test/helpers.jsx";

const HISTORY = {
  predictions: [
    { prediction_id: 9, prediction_date: "2026-06-12T08:48:00", risk_score: 0.66, risk_percent: 66, risk_category: "Moderate" },
    { prediction_id: 4, prediction_date: "2026-05-01T10:00:00", risk_score: 0.31, risk_percent: 31, risk_category: "Low" },
  ],
};

beforeEach(() => setToken("t1"));

test("risk trend chart shows every assessment in date order and the change", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, HISTORY] });
  renderApp("/dashboard");
  const chart = await screen.findByRole("img", { name: /Risk over time: 31% on 1 May 2026, 66% on 12 Jun 2026/ });
  expect(chart).toBeInTheDocument();
  const card = screen.getByRole("region", { name: "Your risk over time" });
  expect(within(card).getByText("Up 35 points since your first assessment")).toBeInTheDocument();
});

test("risk trend with one assessment asks for another one", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, { predictions: [HISTORY.predictions[1]] }] });
  renderApp("/dashboard");
  const card = await screen.findByRole("region", { name: "Your risk over time" });
  expect(within(card).getByText("Do another assessment later to see your trend.")).toBeInTheDocument();
});
