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

test("risk drivers card lists the factors that raise the latest risk", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, HISTORY], "GET /history/9": [200, RESULT] });
  renderApp("/dashboard");
  const card = await screen.findByRole("region", { name: "What's driving your risk" });
  expect(await within(card).findByText("Systolic blood pressure")).toBeInTheDocument();
  expect(within(card).getByText("+15.2%")).toBeInTheDocument();
  expect(within(card).getByText("Age")).toBeInTheDocument();
  expect(within(card).queryByText("Physical activity")).not.toBeInTheDocument(); // lowers risk, so not a driver
  expect(within(card).getByRole("link", { name: "See the full explanation" })).toHaveAttribute("href", "/result/9");
});

const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const task = (type, text) => ({ type, task: text, steps: ["Step one"] });
const PLAN = {
  plan: { plan_text: "{}", generated_at: "2026-11-14T09:00:00", prediction_id: 9,
    calendar: { format: "calendar", length: 7, start_date: TODAY, weeks: [{ week: 1, theme: "Start", days: [
      { day: 1, date: TODAY, title: "Easy start", blocks: {
        morning: [task("hydration", "Drink water")], afternoon: [task("workout", "Walk 15 minutes")],
        evening: [task("sleep", "Bed by 22:30")] } },
    ] }] } },
  disclaimer: RESULT.disclaimer,
};

test("today's plan shows today's tasks and ticking updates the progress", async () => {
  localStorage.removeItem("cardioxplain_plan_9_2026-11-14T09:00:00");
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, HISTORY], "GET /action-plan": [200, PLAN] });
  renderApp("/dashboard");
  const card = await screen.findByRole("region", { name: "Today's plan" });
  expect(await within(card).findByText("0 of 3 done")).toBeInTheDocument();
  await userEvent.click(within(card).getByRole("checkbox", { name: "Workout: Walk 15 minutes" }));
  expect(within(card).getByText("1 of 3 done")).toBeInTheDocument();
  localStorage.removeItem("cardioxplain_plan_9_2026-11-14T09:00:00");
});

test("today's plan without a plan links to create one", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, HISTORY],
    "GET /action-plan": [404, { error: "No health action plan yet." }] });
  renderApp("/dashboard");
  const card = await screen.findByRole("region", { name: "Today's plan" });
  expect(await within(card).findByRole("link", { name: "Create my plan" })).toHaveAttribute("href", "/plan");
});
