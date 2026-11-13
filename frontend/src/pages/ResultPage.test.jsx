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
  expect(await screen.findByText("Moderate risk")).toBeInTheDocument();
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

test("estimated result shows a warning and marks estimated factors", async () => {
  const estimated = { ...RESULT, estimated_fields: ["ap_hi", "ap_lo"], inputs: { ...RESULT.inputs, ap_hi: 120, ap_lo: 80 },
    shap: [{ feature: "ap_hi", label: "Systolic blood pressure", value: 120, shap: 0.05 }, ...RESULT.shap.slice(1)] };
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history/7": [200, estimated] });
  renderApp("/result/7");
  const warning = (await screen.findByText(/Estimated result/)).closest("p");
  expect(warning).toHaveTextContent("systolic blood pressure, diastolic blood pressure");
  expect(warning).toHaveTextContent("120/80 mmHg");
  const row = within(screen.getByRole("table", { name: "Factor contributions" })).getAllByRole("row")[1];
  expect(within(row).getByText("120 (estimated)")).toBeInTheDocument();
});

test("result without estimated fields shows no warning", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history/7": [200, { ...RESULT, estimated_fields: [] }] });
  renderApp("/result/7");
  await screen.findByText("41%");
  expect(screen.queryByText(/Estimated result/)).not.toBeInTheDocument();
});

test("result shows lifestyle amounts and the Yes/No note", async () => {
  const withAmounts = { ...RESULT, inputs: { ...RESULT.inputs, cigarettes_per_day: 20, drinks_per_week: 3, activity_minutes: 60 } };
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history/7": [200, withAmounts] });
  renderApp("/result/7");
  expect(await screen.findByText(/20 cigarettes per day/)).toBeInTheDocument();
  expect(screen.getByText(/3 drinks per week/)).toBeInTheDocument();
  expect(screen.getByText(/60 minutes of exercise per week/)).toBeInTheDocument();
  expect(screen.getByText(/The risk model uses Yes\/No for lifestyle/)).toBeInTheDocument();
});

test("saved result without SHAP explains why the chart is missing", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history/7": [200, { ...RESULT, shap: null }] });
  renderApp("/result/7");
  expect(await screen.findByText("No explanation was saved for this result.")).toBeInTheDocument();
});
