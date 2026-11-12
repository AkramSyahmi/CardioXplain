import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setToken } from "../api.js";
import { RESULT, USER, mockApi, renderApp } from "../test/helpers.jsx";

const PLAN = {
  plan: { plan_text: "## Week 1\n- Walk 20 minutes a day\n\nPlease consult a healthcare professional.",
    generated_at: "2026-06-12T09:00:00", prediction_id: 7 },
  disclaimer: RESULT.disclaimer,
};
const NO_PLAN = [404, { error: "No health action plan yet." }];

beforeEach(() => setToken("t1"));

test("plan page shows saved plan as formatted text", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": [200, PLAN] });
  renderApp("/plan");
  expect(await screen.findByRole("heading", { name: "Week 1" })).toBeInTheDocument();
  expect(within(screen.getByRole("article")).getByRole("listitem")).toHaveTextContent("Walk 20 minutes a day");
  expect(screen.getByText(RESULT.disclaimer)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate a new plan" })).toBeInTheDocument();
});

test("plan page generates a plan", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": NO_PLAN, "POST /action-plan": [201, PLAN] });
  renderApp("/plan");
  expect(await screen.findByText("No health action plan yet.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Generate my plan" }));
  expect(await screen.findByRole("heading", { name: "Week 1" })).toBeInTheDocument();
});

test("generate button disabled while waiting", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": NO_PLAN });
  const real = api.getMockImplementation();
  api.mockImplementation((url, o) => (o.method === "POST" ? new Promise(() => {}) : real(url, o)));
  renderApp("/plan");
  await userEvent.click(await screen.findByRole("button", { name: "Generate my plan" }));
  const button = screen.getByRole("button", { name: /Generating your plan/ });
  expect(button).toBeDisabled();
  await userEvent.click(button);
  expect(api.mock.calls.filter(([, o]) => o.method === "POST")).toHaveLength(1);
});

test("plan uses What-If values from router state", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }], "GET /action-plan": NO_PLAN, "POST /action-plan": [201, PLAN] });
  renderApp({ pathname: "/plan", state: { lifestyle: { active: 1 } } });
  expect(await screen.findByText("Using your What-If values.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Generate my plan" }));
  await screen.findByRole("heading", { name: "Week 1" });
  const body = JSON.parse(api.mock.calls.find(([, o]) => o.method === "POST")[1].body);
  expect(body).toEqual({ lifestyle: { active: 1 } });
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
  expect(screen.getByRole("link", { name: "Start Risk Assessment" })).toHaveAttribute("href", "/assessment");
  expect(screen.queryByRole("button", { name: "Generate my plan" })).not.toBeInTheDocument();
});
