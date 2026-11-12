import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setToken } from "../api.js";
import { ADMIN, mockApi, renderApp } from "../test/helpers.jsx";

const METRICS = {
  metrics: { test_rows: 13720, accuracy: 0.7336, precision: 0.759, recall: 0.6764, f1_score: 0.7153, auc: 0.8015,
    confusion_matrix: { true_negative: 5473, false_positive: 1458, false_negative: 2197, true_positive: 4592 },
    risk_categories: { Low: { people: 6143, actual_cvd_percent: 24.5 }, Moderate: { people: 3501, actual_cvd_percent: 54 },
      High: { people: 4076, actual_cvd_percent: 83.2 } } },
  training: { method: "RandomizedSearchCV, 40 combinations x 5-fold CV", best_params: { max_depth: 6, n_estimators: 351 },
    best_cv_auc_mean: 0.7978 },
};
const STATS = { total_users: 12, total_assessments: 30, risk_distribution: { Low: 10, Moderate: 15, High: 5 },
  llm_calls: { success: 40, failed: 3 } };
const LOGS = { logs: [{ log_id: 5, user_id: 3, action: "PREDICT", description: "prediction_id=9", timestamp: "2026-06-12T08:48:00" }] };
const USERS = { users: [
  { ...ADMIN, status: "active", created_at: "2026-06-01T10:00:00" },
  { user_id: 3, full_name: "Ali Ahmad", email: "ali@mail.com", role: "general_user", status: "active", created_at: "2026-06-02T10:00:00" },
] };

beforeEach(() => setToken("admin-token"));

function adminApi(extra) {
  return mockApi({ "GET /auth/me": [200, { user: ADMIN }], ...extra });
}

test("admin dashboard shows metrics, stats and logs", async () => {
  adminApi({ "GET /admin/metrics": [200, METRICS], "GET /admin/stats": [200, STATS], "GET /admin/logs?limit=50": [200, LOGS] });
  renderApp("/admin");
  expect(await screen.findByText("Accuracy: 73.4%")).toBeInTheDocument();
  expect(screen.getByText("AUC: 0.8015")).toBeInTheDocument();
  expect(screen.getByText("F1-score: 71.5%")).toBeInTheDocument();
  const matrix = screen.getByRole("table", { name: "Confusion matrix" });
  expect(within(matrix).getByText("5473")).toBeInTheDocument();
  expect(within(matrix).getByText("4592")).toBeInTheDocument();
  expect(await screen.findByText("Total assessments: 30")).toBeInTheDocument();
  expect(screen.getByText("Moderate: 15")).toBeInTheDocument();
  expect(screen.getByText("LLM calls: 40 successful, 3 failed")).toBeInTheDocument();
  const logs = await screen.findByRole("table", { name: "Activity log" });
  expect(within(logs).getByText("PREDICT")).toBeInTheDocument();
});

test("admin dashboard shows metrics unavailable message", async () => {
  adminApi({ "GET /admin/metrics": [503, { error: "Model metrics are not available yet." }],
    "GET /admin/stats": [200, STATS], "GET /admin/logs?limit=50": [200, { logs: [] }] });
  renderApp("/admin");
  expect(await screen.findByText("Model metrics are not available yet.")).toBeInTheDocument();
  expect(await screen.findByText("Total users: 12")).toBeInTheDocument();
});

test("admin can create a user", async () => {
  const created = { user_id: 9, full_name: "New Admin", email: "new@mail.com", role: "admin", status: "active",
    created_at: "2026-06-13T10:00:00" };
  const api = adminApi({ "GET /admin/users": [200, USERS], "POST /admin/users": [201, { user: created }] });
  renderApp("/admin/users");
  await screen.findByText("ali@mail.com");
  await userEvent.type(screen.getByLabelText("Full name"), "New Admin");
  await userEvent.type(screen.getByLabelText("Email"), "new@mail.com");
  await userEvent.selectOptions(screen.getByLabelText("Role"), "admin");
  await userEvent.type(screen.getByLabelText("Temporary password"), "TempPass1");
  await userEvent.click(screen.getByRole("button", { name: "Create user" }));
  expect(await screen.findByText("new@mail.com")).toBeInTheDocument();
  expect(screen.getByText("User created.")).toBeInTheDocument();
  const body = JSON.parse(api.mock.calls.find(([, o]) => o.method === "POST")[1].body);
  expect(body).toEqual({ full_name: "New Admin", email: "new@mail.com", role: "admin", password: "TempPass1" });
});

test("admin sees error when deactivating self", async () => {
  adminApi({ "GET /admin/users": [200, USERS],
    "PATCH /admin/users/2": [400, { error: "You cannot deactivate your own administrator account." }] });
  renderApp("/admin/users");
  const row = (await screen.findByText("admin@cardioxplain.com")).closest("tr");
  await userEvent.click(within(row).getByRole("button", { name: "Deactivate" }));
  expect(await within(row).findByText("You cannot deactivate your own administrator account.")).toBeInTheDocument();
});

test("admin can change a role and deactivate a user", async () => {
  const api = adminApi({
    "GET /admin/users": [200, USERS],
    "PATCH /admin/users/3": (body) => [200, { user: { ...USERS.users[1], ...body } }],
  });
  renderApp("/admin/users");
  const row = (await screen.findByText("ali@mail.com")).closest("tr");
  await userEvent.selectOptions(within(row).getByLabelText("Role for Ali Ahmad"), "admin");
  await userEvent.click(within(row).getByRole("button", { name: "Save role" }));
  expect(await within(row).findByText("Saved.")).toBeInTheDocument();
  await userEvent.click(within(row).getByRole("button", { name: "Deactivate" }));
  expect(await within(row).findByText("inactive")).toBeInTheDocument();
  expect(within(row).getByRole("button", { name: "Activate" })).toBeInTheDocument();
  const patches = api.mock.calls.filter(([, o]) => o.method === "PATCH").map(([, o]) => JSON.parse(o.body));
  expect(patches).toEqual([{ role: "admin" }, { status: "inactive" }]);
});

test("admin can reset a password", async () => {
  const api = adminApi({ "GET /admin/users": [200, USERS], "PATCH /admin/users/3": [200, { user: USERS.users[1] }] });
  renderApp("/admin/users");
  const row = (await screen.findByText("ali@mail.com")).closest("tr");
  await userEvent.type(within(row).getByLabelText("New password for Ali Ahmad"), "NewPass99");
  await userEvent.click(within(row).getByRole("button", { name: "Reset password" }));
  expect(await within(row).findByText("Password reset.")).toBeInTheDocument();
  expect(JSON.parse(api.mock.calls.find(([, o]) => o.method === "PATCH")[1].body)).toEqual({ password: "NewPass99" });
});
