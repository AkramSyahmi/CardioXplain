import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setToken } from "../api.js";
import { RESULT, USER, mockApi, renderApp } from "../test/helpers.jsx";

beforeEach(() => setToken("t1"));

async function fillForm() {
  await userEvent.type(screen.getByLabelText("Age (years)"), "50");
  await userEvent.selectOptions(screen.getByLabelText("Gender"), "male");
  await userEvent.type(screen.getByLabelText("Height (cm)"), "170");
  await userEvent.type(screen.getByLabelText("Weight (kg)"), "80");
  await userEvent.type(screen.getByLabelText("Systolic blood pressure (mmHg)"), "140");
  await userEvent.type(screen.getByLabelText("Diastolic blood pressure (mmHg)"), "90");
  await userEvent.selectOptions(screen.getByLabelText("Cholesterol level"), "2");
  await userEvent.selectOptions(screen.getByLabelText("Glucose level"), "1");
  await userEvent.type(screen.getByLabelText("Cigarettes per day"), "0");
  await userEvent.type(screen.getByLabelText("Alcoholic drinks per week"), "0");
  await userEvent.type(screen.getByLabelText("Moderate exercise (minutes per week)"), "200");
}

test("assessment shows BMI from height and weight", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }] });
  renderApp("/assessment");
  await userEvent.type(await screen.findByLabelText("Height (cm)"), "170");
  await userEvent.type(screen.getByLabelText("Weight (kg)"), "80");
  expect(screen.getByText("Your BMI: 27.68")).toBeInTheDocument();
});

test("assessment shows help text for unsure users", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }] });
  renderApp("/assessment");
  expect((await screen.findAllByText("If you are unsure, choose \"I don't know\" and ask for a check at a clinic.")).length).toBe(2);
  expect(screen.getByText(/systolic is the first, diastolic the second/)).toBeInTheDocument();
});

test("assessment sends the form and goes to the result page", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }], "POST /predict": [201, RESULT] });
  renderApp("/assessment");
  await screen.findByLabelText("Age (years)");
  await fillForm();
  await userEvent.click(screen.getByRole("button", { name: "Predict Risk" }));
  expect(await screen.findByRole("heading", { name: "Risk Assessment Results" })).toBeInTheDocument();
  const body = JSON.parse(api.mock.calls.find(([url]) => url === "/api/predict")[1].body);
  expect(body).toEqual({ age: 50, gender: "male", height: 170, weight: 80, ap_hi: 140, ap_lo: 90,
    cholesterol: 2, gluc: 1, cigarettes_per_day: 0, drinks_per_week: 0, activity_minutes: 200 });
});

test("assessment shows field errors from the API", async () => {
  mockApi({
    "GET /auth/me": [200, { user: USER }],
    "POST /predict": [400, { error: "Please correct the highlighted fields.",
      fields: { ap_hi: "Systolic blood pressure must be between 60 and 300 mmHg." } }],
  });
  renderApp("/assessment");
  await screen.findByLabelText("Age (years)");
  await fillForm();
  await userEvent.click(screen.getByRole("button", { name: "Predict Risk" }));
  expect(await screen.findByText("Please correct the highlighted fields.")).toBeInTheDocument();
  expect(screen.getByText("Systolic blood pressure must be between 60 and 300 mmHg.")).toBeInTheDocument();
});

test("assessment button disabled while waiting", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }] });
  const real = api.getMockImplementation();
  api.mockImplementation((url, options) => (url === "/api/predict" ? new Promise(() => {}) : real(url, options)));
  renderApp("/assessment");
  await screen.findByLabelText("Age (years)");
  await fillForm();
  await userEvent.click(screen.getByRole("button", { name: "Predict Risk" }));
  const button = screen.getByRole("button", { name: /Analysing/ });
  expect(button).toBeDisabled();
  await userEvent.click(button);
  expect(api.mock.calls.filter(([url]) => url === "/api/predict")).toHaveLength(1);
});

test("unknown blood pressure and cholesterol are sent as unknown", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }], "POST /predict": [201, RESULT] });
  renderApp("/assessment");
  await screen.findByLabelText("Age (years)");
  await fillForm();
  await userEvent.click(screen.getByLabelText("I don't know my blood pressure"));
  expect(screen.getByLabelText("Systolic blood pressure (mmHg)")).toBeDisabled();
  expect(screen.getByLabelText("Diastolic blood pressure (mmHg)")).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText("Cholesterol level"), "unknown");
  await userEvent.click(screen.getByRole("button", { name: "Predict Risk" }));
  await screen.findByRole("heading", { name: "Risk Assessment Results" });
  const body = JSON.parse(api.mock.calls.find(([url]) => url === "/api/predict")[1].body);
  expect(body).toMatchObject({ ap_hi: "unknown", ap_lo: "unknown", cholesterol: "unknown", gluc: 1, age: 50 });
});

test("lifestyle questions explain what to enter", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }] });
  renderApp("/assessment");
  expect(await screen.findByText("Enter 0 if you do not smoke.")).toBeInTheDocument();
  expect(screen.getByText(/150 minutes or more a week counts as active/)).toBeInTheDocument();
  expect(screen.getByText(/One drink = a can of beer, a glass of wine or a shot/)).toBeInTheDocument();
});
