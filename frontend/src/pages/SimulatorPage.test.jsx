import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setToken } from "../api.js";
import { RESULT, USER, mockApi, renderApp } from "../test/helpers.jsx";

const INPUTS = { ...RESULT.inputs, smoke: 1, active: 0, weight: 92, bmi: 31.83,
  cigarettes_per_day: 20, drinks_per_week: 0, activity_minutes: 60 };
const SIMULATION = {
  original: { risk_score: 0.87, risk_percent: 87, risk_category: "High" },
  simulated: { risk_score: 0.824, risk_percent: 82, risk_category: "High",
    inputs: { ...INPUTS, active: 1 }, shap: RESULT.shap },
  change_percent_points: -4.6,
  narrative: { text: "Being active lowers your estimated risk a little.", source: "llm" },
  disclaimer: RESULT.disclaimer,
};

beforeEach(() => setToken("t1"));

function api(extra = {}) {
  return mockApi({ "GET /auth/me": [200, { user: USER }], "GET /simulation": [200, { inputs: INPUTS }], ...extra });
}

test("simulator prefills from latest assessment", async () => {
  api();
  renderApp("/simulator");
  expect(await screen.findByLabelText("Weight (kg)")).toHaveValue(92);
  expect(screen.getByLabelText("Cigarettes per day")).toHaveValue(20);
  expect(screen.getByLabelText("Moderate exercise (minutes per week)")).toHaveValue(60);
  expect(screen.getByText(/Blood pressure: 140\/90/)).toBeInTheDocument();
  expect(screen.getByText("These stay fixed in the simulator.")).toBeInTheDocument();
});

test("simulator without assessment shows message", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }],
    "GET /simulation": [404, { error: "Please complete a Risk Assessment first." }] });
  renderApp("/simulator");
  expect(await screen.findByText("Please complete a Risk Assessment first.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Start risk assessment" })).toHaveAttribute("href", "/assessment");
});

test("simulator sends only changed fields and shows before and after", async () => {
  const fetchMock = api({ "POST /simulation": [200, SIMULATION] });
  renderApp("/simulator");
  const minutes = await screen.findByLabelText("Moderate exercise (minutes per week)");
  await userEvent.clear(minutes);
  await userEvent.type(minutes, "200");
  await userEvent.click(screen.getByRole("button", { name: "Simulate" }));
  expect(await screen.findByText("Before: 87% (High)")).toBeInTheDocument();
  expect(screen.getByText("After: 82% (High)")).toBeInTheDocument();
  expect(screen.getByText("Your estimated risk would be 4.6 percentage points lower.")).toBeInTheDocument();
  expect(screen.getByText(SIMULATION.narrative.text)).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Factor contributions" })).toBeInTheDocument();
  const sent = JSON.parse(fetchMock.mock.calls.find(([url, o]) => url === "/api/simulation" && o.method === "POST")[1].body);
  expect(sent).toEqual({ activity_minutes: 200 });
});

test("simulator asks for a change before simulating", async () => {
  const fetchMock = api();
  renderApp("/simulator");
  await userEvent.click(await screen.findByRole("button", { name: "Simulate" }));
  expect(screen.getByText("Please change at least one lifestyle value.")).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([, o]) => o.method === "POST")).toBe(false);
});

test("simulator passes values to health plan", async () => {
  api({ "POST /simulation": [200, SIMULATION], "GET /action-plan": [404, { error: "No health action plan yet." }] });
  renderApp("/simulator");
  const minutes = await screen.findByLabelText("Moderate exercise (minutes per week)");
  await userEvent.clear(minutes);
  await userEvent.type(minutes, "200");
  await userEvent.click(screen.getByRole("button", { name: "Simulate" }));
  await userEvent.click(await screen.findByRole("button", { name: "Create a health plan with these values" }));
  expect(await screen.findByRole("heading", { name: "Health Action Plan" })).toBeInTheDocument();
});

test("simulator shows Yes/No for an old assessment without amounts", async () => {
  const old = { ...INPUTS, cigarettes_per_day: null, drinks_per_week: null, activity_minutes: null };
  const fetchMock = mockApi({ "GET /auth/me": [200, { user: USER }], "GET /simulation": [200, { inputs: old }],
    "POST /simulation": [200, SIMULATION] });
  renderApp("/simulator");
  expect(await screen.findByRole("radio", { name: "Smoking: Yes" })).toBeChecked();
  await userEvent.click(screen.getByRole("radio", { name: "Physical activity: Yes" }));
  await userEvent.click(screen.getByRole("button", { name: "Simulate" }));
  await screen.findByText("Before: 87% (High)");
  const sent = JSON.parse(fetchMock.mock.calls.find(([url, o]) => url === "/api/simulation" && o.method === "POST")[1].body);
  expect(sent).toEqual({ active: 1 });
});
