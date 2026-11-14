import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setToken } from "../api.js";
import { RESULT, USER, mockApi, renderApp } from "../test/helpers.jsx";

const task = (type, text) => ({ type, task: text, steps: [`${text}: step one`, "Tick when done"] });
const day = (n, date) => ({ day: n, date, title: `Day ${n} focus`, blocks: {
  morning: [task("hydration", `Water day ${n}`), task("meal", `Breakfast day ${n}`)],
  afternoon: [task("workout", `Walk day ${n}`)],
  evening: [task("sleep", `Sleep day ${n}`)],
} });
const week = (number, start) => ({ week: number, theme: `Theme ${number}`, days: Array.from({ length: 7 }, (_, i) => {
  const n = (number - 1) * 7 + i + 1;
  return day(n, `2026-11-${String(start + i).padStart(2, "0")}`);
}) });
const plan = (length, weeks) => ({
  plan: { plan_text: "{}", generated_at: "2026-11-16T09:00:00", prediction_id: 7,
    calendar: { format: "calendar", length, start_date: "2026-11-16", weeks } },
  disclaimer: RESULT.disclaimer,
});
const NO_PLAN = [404, { error: "No health action plan yet." }];

beforeEach(() => {
  setToken("t1");
  localStorage.removeItem("cardioxplain_plan_7_2026-11-16T09:00:00");
});

test("plan shows a day-by-day calendar with dates, time blocks and checklists", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": [200, plan(7, [week(1, 16)])] });
  renderApp("/plan");
  expect(await screen.findByRole("heading", { name: "Week 1: Theme 1" })).toBeInTheDocument();
  const day1 = screen.getByRole("region", { name: "Mon 16 Nov 2026 - Day 1: Day 1 focus" });
  expect(within(day1).getByRole("heading", { name: "Morning" })).toBeInTheDocument();
  expect(within(day1).getByRole("heading", { name: "Afternoon" })).toBeInTheDocument();
  expect(within(day1).getByRole("heading", { name: "Evening" })).toBeInTheDocument();
  expect(within(day1).getByRole("checkbox", { name: "Meal: Breakfast day 1" })).toBeInTheDocument();
  expect(within(day1).getByText("Breakfast day 1: step one")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Sun 22 Nov 2026 - Day 7: Day 7 focus" })).toBeInTheDocument();
  expect(screen.getByText(RESULT.disclaimer)).toBeInTheDocument();
});

test("ticked tasks are remembered after reload", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": [200, plan(7, [week(1, 16)])] });
  const first = renderApp("/plan");
  await userEvent.click(await screen.findByRole("checkbox", { name: "Workout: Walk day 2" }));
  expect(screen.getByRole("checkbox", { name: "Workout: Walk day 2" })).toBeChecked();
  first.unmount();
  renderApp("/plan");
  expect(await screen.findByRole("checkbox", { name: "Workout: Walk day 2" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Workout: Walk day 3" })).not.toBeChecked();
});

test("generate a 30-day plan, then the next week", async () => {
  const api = mockApi({
    "GET /auth/me": [200, { user: USER }], "GET /action-plan": NO_PLAN,
    "POST /action-plan": [201, plan(30, [week(1, 16)])],
    "POST /action-plan/next-week": [201, plan(30, [week(1, 16), week(2, 23)])],
  });
  renderApp("/plan");
  await userEvent.click(await screen.findByRole("radio", { name: /30-day plan/ }));
  await userEvent.click(screen.getByRole("button", { name: "Generate my plan" }));
  expect(await screen.findByRole("heading", { name: "Week 1: Theme 1" })).toBeInTheDocument();
  expect(screen.getByText("Day 7 of 30 planned.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Generate Week 2" }));
  expect(await screen.findByRole("heading", { name: "Week 2: Theme 2" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Mon 23 Nov 2026 - Day 8: Day 8 focus" })).toBeInTheDocument();
  const body = JSON.parse(api.mock.calls.find(([url, o]) => url === "/api/action-plan" && o.method === "POST")[1].body);
  expect(body).toEqual({ length: 30 });
});

test("7-day plan has no next-week button", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": [200, plan(7, [week(1, 16)])] });
  renderApp("/plan");
  await screen.findByRole("heading", { name: "Week 1: Theme 1" });
  expect(screen.queryByRole("button", { name: /Generate Week/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate a new plan" })).toBeInTheDocument();
});

test("generate button disabled while waiting", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": NO_PLAN });
  const real = api.getMockImplementation();
  api.mockImplementation((url, o) => (o.method === "POST" ? new Promise(() => {}) : real(url, o)));
  renderApp("/plan");
  await userEvent.click(await screen.findByRole("button", { name: "Generate my plan" }));
  const button = screen.getByRole("button", { name: /Generating your plan... \(this can take up to 45 seconds\)/ });
  expect(button).toBeDisabled();
  await userEvent.click(button);
  expect(api.mock.calls.filter(([, o]) => o.method === "POST")).toHaveLength(1);
});

test("plan uses What-If values from router state", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": NO_PLAN,
    "POST /action-plan": [201, plan(7, [week(1, 16)])] });
  renderApp({ pathname: "/plan", state: { lifestyle: { active: 1 } } });
  expect(await screen.findByText("Using your What-If values.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Generate my plan" }));
  await screen.findByRole("heading", { name: "Week 1: Theme 1" });
  const body = JSON.parse(api.mock.calls.find(([, o]) => o.method === "POST")[1].body);
  expect(body).toEqual({ length: 7, lifestyle: { active: 1 } });
});

test("plan unavailable shows message and risk category", async () => {
  mockApi({
    "GET /auth/me": [200, { user: USER }], "GET /action-plan": NO_PLAN,
    "POST /action-plan": [503, { error: "Health Action Plan is currently unavailable. Please try again later.",
      risk_score: 0.41, risk_category: "Moderate" }],
  });
  renderApp("/plan");
  await userEvent.click(await screen.findByRole("button", { name: "Generate my plan" }));
  expect(await screen.findByText("Health Action Plan is currently unavailable. Please try again later.")).toBeInTheDocument();
  expect(screen.getByText("Your risk category: Moderate")).toBeInTheDocument();
});

test("plan page without assessment links to the form", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }],
    "GET /action-plan": [404, { error: "Please complete a Risk Assessment first." }] });
  renderApp("/plan");
  expect(await screen.findByText("Please complete a Risk Assessment first.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Start risk assessment" })).toHaveAttribute("href", "/assessment");
  expect(screen.queryByRole("button", { name: "Generate my plan" })).not.toBeInTheDocument();
});

test("old text plan still shows", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": [200, {
    plan: { plan_text: "## Week 1\n- Walk 20 minutes a day", calendar: null,
      generated_at: "2026-06-12T09:00:00", prediction_id: 7 }, disclaimer: RESULT.disclaimer }] });
  renderApp("/plan");
  expect(await screen.findByRole("heading", { name: "Week 1" })).toBeInTheDocument();
  expect(within(screen.getByRole("article")).getByRole("listitem")).toHaveTextContent("Walk 20 minutes a day");
});

test("a newly generated plan starts with nothing ticked", async () => {
  const newer = plan(7, [week(1, 16)]);
  newer.plan.generated_at = "2026-11-17T10:00:00";
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": [200, plan(7, [week(1, 16)])],
    "POST /action-plan": [201, newer] });
  renderApp("/plan");
  await userEvent.click(await screen.findByRole("checkbox", { name: "Workout: Walk day 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Generate a new plan" }));
  await screen.findByText(/Generated: 17 Nov 2026/);
  expect(screen.getByRole("checkbox", { name: "Workout: Walk day 1" })).not.toBeChecked();
  localStorage.removeItem("cardioxplain_plan_7_2026-11-17T10:00:00");
});

test("only one day is open at a time and the day buttons switch it", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": [200, plan(7, [week(1, 16)])] });
  renderApp("/plan");
  const day1 = await screen.findByRole("region", { name: "Mon 16 Nov 2026 - Day 1: Day 1 focus" });
  const day2 = screen.getByRole("region", { name: "Tue 17 Nov 2026 - Day 2: Day 2 focus" });
  expect(day1.querySelector("details")).toHaveAttribute("open");
  expect(day2.querySelector("details")).not.toHaveAttribute("open");
  await userEvent.click(screen.getByRole("button", { name: "Tue 17" }));
  expect(day2.querySelector("details")).toHaveAttribute("open");
  expect(day1.querySelector("details")).not.toHaveAttribute("open");
});
