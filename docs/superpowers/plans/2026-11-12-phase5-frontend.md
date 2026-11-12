# Phase 5: React Frontend (Functional, No CSS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every CardioXplain screen in React as plain, unstyled HTML that works end-to-end against the finished Flask API, so the student can confirm all features before styling.

**Architecture:** Vite + React single-page app in `frontend/`. One `api.js` wrapper does every HTTP call (token header, JSON, error shape). An `AuthContext` holds the logged-in user; `ProtectedRoute` guards pages by role. One page component per screen in `src/pages/`; shared result display in `src/components/ResultView.jsx`. Vite's dev proxy forwards `/api` to Flask on port 5000.

**Tech Stack:** Node 24, Vite 8.3, React 19.3, React Router 8.5 (`react-router`), Recharts 3.10 (SHAP bar chart), react-markdown 10.1 (health plan), Vitest 5.1 + Testing Library + jsdom.

**Spec:** PSM1 proposal `C:\Users\wanda\Desktop\CARDIOXPLAIN\CARDIOXPLAIN.md` (use cases 3.5, mockups Figures 3.25-3.35 for which elements each screen has) and the Phase 4 API in `docs/superpowers/plans/2026-11-12-phase4-backend-api.md` (Interfaces blocks: exact endpoints, bodies, responses, messages).

**Working rule:** one task at a time; explain, wait for "go", build test-first, commit and push, stop.

## Global Constraints

- **No CSS in this phase** (student's rule): no `.css` files, no `style=` props, no `className` for looks, no CSS library. Plain semantic HTML only (`<h1>`, `<form>`, `<label>`, `<table>`, `<nav>`, `<button>`). Styling to match the mockups is a later, separate phase.
- Show the backend's messages exactly as returned (`error`, `fields`), never rewrite them.
- Network failure (server not running) shows: "Cannot reach the server. Please check that the backend is running."
- Token is kept in `localStorage` under `cardioxplain_token`. Any 401 from the API clears it and sends the user to `/login` with "Please log in again."
- LLM-backed actions (assessment, simulation, plan, navigator) show a loading text while waiting and disable their button so the user cannot submit twice.
- LLM text is rendered as text (React escaping) or with `react-markdown` without raw HTML; never `dangerouslySetInnerHTML`.
- Disclaimer from the API is shown on every result, simulation, plan and navigator screen.
- Routes: public `/login`; general user `/dashboard`, `/assessment`, `/result/:id`, `/simulator`, `/history`, `/plan`, `/navigator`; admin `/admin`, `/admin/users`. `/` redirects to the role's home (`/dashboard` or `/admin`).
- Run commands from `frontend/`: `npm test` (Vitest, single run), `npm run dev` (port 5173), `npm run build`.
- Commit messages plain, no co-author line.

## Review Focus

1. **Page refresh on `/result/:id`** (no router state): the page loads the result from `GET /api/history/:id` instead of showing a blank screen. Test in Task 4 (`result page loads from API after refresh`).
2. **Token expires mid-session**: the next API call gets 401, the user lands on `/login` with "Please log in again." Test in Task 1 (`401 clears token and notifies logout`) and Task 2 (`logout event sends user to login`).
3. **Double submit** on Predict, Generate Plan, Send: button disabled while the request is pending. Tests in Task 4, Task 7, Task 8 (`button disabled while waiting`).
4. **Slow LLM (up to 10 s)**: visible loading text, page stays usable. Covered by the same tests (loading text visible while pending).
5. **Backend not running**: friendly message, not a blank page. Test in Task 1 (`network error gives server message`).

---

## File Structure

| File | Responsibility |
|---|---|
| `frontend/package.json`, `vite.config.js`, `index.html` | Vite app, `/api` proxy to `http://localhost:5000`, Vitest config (jsdom) |
| `frontend/src/main.jsx` | Mount `<App/>` |
| `frontend/src/App.jsx` | Router + routes + `AuthProvider` |
| `frontend/src/api.js` | `apiRequest`, `ApiError`, token helpers |
| `frontend/src/auth.jsx` | `AuthProvider`, `useAuth`, `ProtectedRoute` |
| `frontend/src/components/Layout.jsx` | Nav links per role, user name, Sign Out |
| `frontend/src/components/ResultView.jsx` | Score, category, SHAP chart + table, narrative, disclaimer |
| `frontend/src/components/FieldError.jsx` | Shows one field's error text |
| `frontend/src/pages/*.jsx` | One file per screen (Login, Dashboard, Assessment, Result, Simulator, History, Plan, Navigator, AdminDashboard, AdminUsers, NotFound) |
| `frontend/src/test/setup.js`, `frontend/src/**/*.test.jsx` | Testing Library setup, tests next to the code |

---

### Task 1: Project setup and API client

**Files:** Create `frontend/` with Vite React template (delete the template's `.css` files, logos and their imports), `vite.config.js`, `src/api.js`, `src/api.test.js`, `src/test/setup.js`. Modify root `.gitignore` (already ignores `node_modules/`, `dist/`), `README.md` (frontend run steps), `CHANGES.md`.

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number; fields: object }` — `message` is the API's `error` text.
  - `apiRequest(path: string, { method = "GET", body } = {}) -> Promise<object>` — sends JSON to `/api${path}` with `Authorization: Bearer <token>` when a token exists; resolves with the parsed JSON on 2xx; throws `ApiError(status, error, fields)` otherwise; on 401 calls `clearToken()` and dispatches `window` event `"auth:logout"`; on network failure throws `ApiError(0, "Cannot reach the server. Please check that the backend is running.")`.
  - `getToken()`, `setToken(token)`, `clearToken()` — `localStorage` key `cardioxplain_token`.

- [ ] **Step 1: Scaffold** — `npm create vite@latest frontend -- --template react`, then `npm install react-router recharts react-markdown` and `npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`. Add `"test": "vitest run"` to `package.json`. Configure `server.proxy["/api"] = "http://localhost:5000"` and `test: { environment: "jsdom", setupFiles: "./src/test/setup.js" }` in `vite.config.js`. Remove all template CSS.
- [ ] **Step 2: Failing tests** in `src/api.test.js` (mock `global.fetch` with `vi.fn`):

```js
test("sends JSON with the saved token")          // setToken("abc"); headers.Authorization === "Bearer abc", body JSON
test("returns parsed JSON on success")
test("throws ApiError with message and fields")  // 400 {error, fields} -> err.status 400, err.fields.ap_hi
test("401 clears token and notifies logout")     // getToken() === null, "auth:logout" listener called
test("network error gives server message")       // fetch rejects -> status 0, exact message above
```

- [ ] **Step 3: Run `npm test`, expect FAIL** (api.js missing). **Step 4: Implement `api.js`.** **Step 5: `npm test` PASS, `npm run build` succeeds.**
- [ ] **Step 6: CHANGES.md #22** — frontend talks to Flask through the Vite proxy (`/api` → port 5000) during development; UI built unstyled first, styling later (student's decision). README: frontend setup.
- [ ] **Step 7: Commit** — `Set up React frontend and API client`

---

### Task 2: Login, register, roles and layout (UC-100)

**Files:** Create `src/auth.jsx`, `src/components/Layout.jsx`, `src/components/FieldError.jsx`, `src/pages/LoginPage.jsx`, `src/pages/NotFoundPage.jsx`, `src/App.jsx`, tests `src/pages/LoginPage.test.jsx`, `src/auth.test.jsx`.

**Interfaces:**
- Consumes: `apiRequest`, `setToken`, `clearToken`, `getToken`.
- Produces:
  - `AuthProvider` — on start, if a token exists, loads `GET /auth/me`; listens for `"auth:logout"`.
  - `useAuth() -> { user, loading, login(email, password), register({full_name, email, password}), logout() }`. `login` stores the token and sets `user`; `register` calls `POST /auth/register` only (user then signs in).
  - `<ProtectedRoute role="general_user"|"admin">` — not logged in → `/login`; wrong role → that role's home.
  - `homeFor(user) -> "/dashboard" | "/admin"`.
  - `<FieldError fields={obj} name="ap_hi"/>` — renders the message or nothing.
  - `<Layout>` — `<nav>` with links for the role (user: Dashboard, New Assessment, My History, What-If Simulator, Health Action Plan, Care Navigator; admin: Model Performance, User Management), the user's name and role, and a Sign Out button.
- Login page (Figure 3.25/3.26): two tabs as buttons "Sign In" / "Create Account". Create Account has Full Name, Email, Password, Confirm Password; mismatch shows "Passwords do not match." without calling the API. After registering, switch to Sign In with "Registration successful. Please log in.". After login go to `homeFor(user)`. Footer text: "This system is for educational purposes only and does not provide medical advice."
- `/login` after a forced logout shows "Please log in again."

- [ ] **Step 1: Failing tests**

```js
test("sign in shows the API message on wrong password")   // "Invalid email or password"
test("sign in sends general user to dashboard and admin to admin")
test("create account checks confirm password locally")    // "Passwords do not match.", fetch not called
test("create account shows field errors from the API")    // fields.password rule text visible
test("protected route sends logged-out user to login")
test("general user cannot open admin page")               // lands on /dashboard
test("logout event sends user to login")                  // dispatch "auth:logout" -> "Please log in again."
```

- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: `npm test` PASS.**
- [ ] **Step 5: Commit** — `Add login, register and role-based routing (UC-100)`

---

### Task 3: User dashboard

**Files:** Create `src/pages/DashboardPage.jsx`, `src/pages/DashboardPage.test.jsx`.

**Interfaces:** Consumes `GET /history`. Shows (Figure 3.27): "Welcome back, {first name}", Total Assessments, Latest Risk Score (%), Risk Category, Last Assessment date; Recent Assessments table (latest 5: #, date, score, category, View link to `/result/:id`); Quick Actions links (Start Risk Assessment, What-If Simulator, Health Action Plan, Care Navigator); Educational Notice text from the mockup. With no history, shows the API's `message` and a "Start Risk Assessment" link.

- [ ] **Step 1: Failing tests** — `shows stats from history`, `shows empty history message`.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `Add user dashboard`

---

### Task 4: Risk assessment form and result (UC-200, UC-300, UC-400)

**Files:** Create `src/pages/AssessmentPage.jsx`, `src/components/ResultView.jsx`, `src/pages/ResultPage.jsx`, tests for each. Modify `CHANGES.md` (weakness "users may not know their numbers" ticked).

**Interfaces:**
- `AssessmentPage`: inputs age, gender (select Male/Female), height (cm), weight (kg), systolic + diastolic blood pressure (mmHg), cholesterol and glucose (select: 1 Normal / 2 Above normal / 3 Well above normal), smoke / alco / active (Yes/No radios). Shows calculated BMI live once height and weight are filled. Help text: blood pressure — "The two numbers from a blood pressure reading, e.g. 120/80: systolic is the first, diastolic the second."; cholesterol and glucose — "If you are unsure, choose Normal and ask for a check at a clinic."; age — "This tool supports ages 30 to 65." Submit `POST /predict`; while waiting the button reads "Analysing..." and is disabled; on 400 show `error` and each `FieldError`; on 201 navigate to `/result/{prediction_id}` with the response as router state.
- `<ResultView result={obj}/>` — shows `risk_percent`% and `risk_category`; SHAP: Recharts horizontal `BarChart` of `shap` (label vs. `shap * 100`, percentage points) plus a table (Factor, Your value, Effect "+4.4%" / "-1.2%", Direction "Raises risk" / "Lowers risk"); if `shap` is null shows `shap_error`; narrative text; disclaimer; links "What-If Lifestyle Simulator", "View Health Action Plan", "Ask the Care Navigator", "View All History".
- `ResultPage`: uses router state if present, else `GET /history/:id`; 404 shows the API message.

- [ ] **Step 1: Failing tests**

```js
test("assessment shows field errors from the API")        // 400 fields.ap_hi text under the field
test("assessment button disabled while waiting")          // "Analysing..." visible, button disabled
test("assessment shows BMI from height and weight")       // 170 cm, 80 kg -> 27.68
test("assessment goes to result page on success")
test("result view shows score, factors and narrative")    // "41%", "Moderate", "Systolic blood pressure", "Raises risk"
test("result view shows shap_error when shap is null")
test("result page loads from API after refresh")          // no router state -> GET /history/7
```

- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `Add risk assessment form and result page (UC-200/300/400)`

---

### Task 5: What-If simulator (UC-500)

**Files:** Create `src/pages/SimulatorPage.jsx` + test.

**Interfaces:** `GET /simulation` pre-fills; 404 shows its message with a link to `/assessment`. Controls: smoke, alco, active (Yes/No), weight (number). Fixed values (age, blood pressure, cholesterol, glucose) shown read-only with "These stay fixed in the simulator." Sends only the changed fields to `POST /simulation`; "Simulating..." while waiting. Shows Before / After (score + category), change in percentage points with "lower" / "higher" wording, the simulated factor table (reuse the table part of `ResultView` via a prop `showLinks={false}` or a small exported `ShapTable`), narrative, disclaimer, and a button "Create a health plan with these values" that navigates to `/plan` with `{ lifestyle: <changed values> }` as router state.

- [ ] **Step 1: Failing tests** — `simulator prefills from latest assessment`, `simulator without assessment shows message`, `simulator sends only changed fields and shows before and after`, `simulator passes values to health plan`.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `Add What-If simulator page (UC-500)`

---

### Task 6: Prediction history (UC-600)

**Files:** Create `src/pages/HistoryPage.jsx` + test.

**Interfaces:** `GET /history`; table (#, Date, Risk Score, Category, View → `/result/:id`); empty → API `message` with a link to `/assessment`. Read-only (no edit/delete controls).

- [ ] **Step 1: Failing tests** — `history lists past results newest first`, `history shows empty message`.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `Add prediction history page (UC-600)`

---

### Task 7: Health action plan (UC-1000)

**Files:** Create `src/pages/PlanPage.jsx` + test.

**Interfaces:** On open `GET /action-plan`: plan → show it; 404 "No health action plan yet." → show it with a "Generate my plan" button; 404 no-assessment message → link to `/assessment`. If router state has `lifestyle`, show "Using your What-If values" and send `{ lifestyle }` with `POST /action-plan`. Button text "Generating your plan... (this can take up to 10 seconds)" and disabled while waiting. Render `plan_text` with `react-markdown`. Button "Generate a new plan" when a plan exists. 503 → show the API `error` and "Your risk category: {risk_category}". Disclaimer.

- [ ] **Step 1: Failing tests** — `plan page shows saved plan`, `plan page generates a plan`, `generate button disabled while waiting`, `plan uses What-If values from router state`, `plan unavailable shows message and risk category`.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `Add health action plan page (UC-1000)`

---

### Task 8: Virtual care navigator (UC-700)

**Files:** Create `src/pages/NavigatorPage.jsx` + test.

**Interfaces:** Chat list starting with the greeting from Figure 3.33 ("Hello! I'm your CardioXplain Virtual Care Navigator..."; the greeting is display-only and not sent as history). Text input (`maxLength` 1000) + Send; Suggested Questions list (the 7 from Figure 3.33) — clicking one sends it. Sends `{ message, history }` where history is the earlier user/assistant turns (excluding the greeting). While waiting: "Thinking..." and Send disabled. 503 → shows the API `error` as a chat line; the user's question stays in the list. Note "Educational only — not medical advice".

- [ ] **Step 1: Failing tests** — `navigator sends question with history`, `suggested question is sent on click`, `send disabled while waiting`, `navigator shows unavailable message`.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `Add virtual care navigator page (UC-700)`

---

### Task 9: Admin pages (UC-900, UC-800)

**Files:** Create `src/pages/AdminDashboardPage.jsx`, `src/pages/AdminUsersPage.jsx` + tests.

**Interfaces:**
- Admin dashboard: `GET /admin/metrics` (accuracy, precision, recall, F1 as %, AUC to 3 dp; confusion matrix as a 2x2 table; best parameters list; 503 → API message), `GET /admin/stats` (total users, total assessments, Low/Moderate/High counts, LLM success/failed), `GET /admin/logs?limit=50` (table: time, action, user id, description).
- User management: table from `GET /admin/users` (name, email, role, status, created); per row: role `<select>` + Save, Activate/Deactivate button, "Reset password" input + button → `PATCH /admin/users/:id`; create form (full name, email, role, temporary password) → `POST /admin/users`. Show API errors next to the action (e.g. "You cannot deactivate your own administrator account.").

- [ ] **Step 1: Failing tests** — `admin dashboard shows metrics and stats`, `admin dashboard shows metrics unavailable message`, `admin can create a user`, `admin sees error when deactivating self`, `admin can change a role`.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS. Step 5: Commit** — `Add admin model performance and user management pages (UC-900/800)`

---

### Task 10: End-to-end check with the real backend

- [ ] **Step 1:** `npm test` (all pass) and `npm run build` (no errors).
- [ ] **Step 2:** Start Flask (`backend: venv\Scripts\python run.py`) and Vite (`frontend: npm run dev`); walk the checklist in a browser: register → login → assessment → result (chart, narrative) → What-If → plan with What-If values → history → navigator → logout; admin login → metrics → users (create, role, deactivate, reset). Record any failures.
- [ ] **Step 3:** Fix failures test-first. **Step 4:** Commit — `Verify frontend end-to-end`.
- [ ] **Step 5:** Final whole-branch review (fresh reviewer), as in Phase 4.
