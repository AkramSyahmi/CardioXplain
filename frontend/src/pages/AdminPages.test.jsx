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
  await userEvent.click(screen.getByRole("button", { name: "Create user" }));
  const dialog = screen.getByRole("dialog", { name: "Create a user" });
  await userEvent.type(within(dialog).getByLabelText("Full name"), "New Admin");
  await userEvent.type(within(dialog).getByLabelText("Email"), "new@mail.com");
  await userEvent.selectOptions(within(dialog).getByLabelText("Role"), "admin");
  await userEvent.type(within(dialog).getByLabelText("Temporary password"), "TempPass1");
  await userEvent.click(within(dialog).getByRole("button", { name: "Save user" }));
  // Dialog closes, the page confirms, and the new user is in the right role group.
  expect(await screen.findByText("New Admin was created and added to Administrators.")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(within(screen.getByRole("table", { name: "Administrators" })).getByText("new@mail.com")).toBeInTheDocument();
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
  let ali = USERS.users[1]; // the server keeps earlier changes, like the real backend
  const api = adminApi({
    "GET /admin/users": [200, USERS],
    "PATCH /admin/users/3": (body) => {
      ali = { ...ali, ...body };
      return [200, { user: ali }];
    },
  });
  renderApp("/admin/users");
  let row = (await screen.findByText("ali@mail.com")).closest("tr");
  await userEvent.selectOptions(within(row).getByLabelText("Role for Ali Ahmad"), "admin");
  await userEvent.click(within(row).getByRole("button", { name: "Save role" }));
  // The user moves to the Administrators group, and the page says so.
  expect(await screen.findByText("Ali Ahmad is now in Administrators.")).toBeInTheDocument();
  const admins = screen.getByRole("table", { name: "Administrators" });
  row = within(admins).getByText("ali@mail.com").closest("tr");
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

test("activity log shows the latest 10 and can show all", async () => {
  const many = { logs: Array.from({ length: 25 }, (_, i) => ({ log_id: 100 - i, user_id: 3, action: `ACTION_${i}`,
    description: "", timestamp: "2026-06-12T08:48:00" })) };
  adminApi({ "GET /admin/metrics": [200, METRICS], "GET /admin/stats": [200, STATS], "GET /admin/logs?limit=50": [200, many] });
  renderApp("/admin");
  const logs = await screen.findByRole("table", { name: "Activity log" });
  expect(within(logs).getAllByRole("row")).toHaveLength(11); // header + 10
  await userEvent.click(screen.getByRole("button", { name: "Show all 25" }));
  expect(within(logs).getAllByRole("row")).toHaveLength(26);
});

test("password reset sits behind a Set new password toggle in each row", async () => {
  adminApi({ "GET /admin/users": [200, USERS] });
  renderApp("/admin/users");
  const row = (await screen.findByText("ali@mail.com")).closest("tr");
  const toggle = within(row).getByText("Set new password");
  expect(toggle.closest("details")).not.toHaveAttribute("open");
  await userEvent.click(toggle);
  expect(toggle.closest("details")).toHaveAttribute("open");
  expect(within(row).getByLabelText("New password for Ali Ahmad")).toBeInTheDocument();
});

test("users are grouped by role with a count for each group", async () => {
  adminApi({ "GET /admin/users": [200, USERS] });
  renderApp("/admin/users");
  const admins = await screen.findByRole("table", { name: "Administrators" });
  const general = screen.getByRole("table", { name: "General users" });
  expect(within(admins).getByText("admin@cardioxplain.com")).toBeInTheDocument();
  expect(within(general).getByText("ali@mail.com")).toBeInTheDocument();
  expect(within(general).queryByText("admin@cardioxplain.com")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /Administrators/ })).toHaveTextContent("1");
});

test("a role with no users shows a short empty message", async () => {
  adminApi({ "GET /admin/users": [200, { users: [USERS.users[1]] }] });
  renderApp("/admin/users");
  expect(await screen.findByText("No administrators yet.")).toBeInTheDocument();
  expect(screen.queryByRole("table", { name: "Administrators" })).not.toBeInTheDocument();
});

test("a role the page does not know still gets its own group", async () => {
  const other = { ...USERS.users[1], user_id: 7, email: "c@mail.com", role: "clinician" };
  adminApi({ "GET /admin/users": [200, { users: [...USERS.users, other] }] });
  renderApp("/admin/users");
  const group = await screen.findByRole("table", { name: "clinician" });
  expect(within(group).getByText("c@mail.com")).toBeInTheDocument();
});

test("create user dialog shows field errors and can be cancelled", async () => {
  adminApi({ "GET /admin/users": [200, USERS],
    "POST /admin/users": [400, { error: "Please correct the highlighted fields.", fields: { email: "Please enter a valid email address." } }] });
  renderApp("/admin/users");
  const open = await screen.findByRole("button", { name: "Create user" });
  await userEvent.click(open);
  const dialog = screen.getByRole("dialog", { name: "Create a user" });
  expect(within(dialog).getByLabelText("Full name")).toHaveFocus();
  await userEvent.click(within(dialog).getByRole("button", { name: "Save user" }));
  expect(await within(dialog).findByText("Please enter a valid email address.")).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(open).toHaveFocus();
  await userEvent.click(open);
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
