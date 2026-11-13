# Styling (Direction A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the working (unstyled) React frontend the approved "soft dashboard" look from `docs/design/style-preview.html`, without changing what any page does.

**Architecture:** One global stylesheet holds the design tokens and styles plain HTML elements (forms, tables, buttons), so every page improves at once. Each component/page then gets a small CSS file next to it plus class names in its JSX. Two new display components replace the Recharts bar chart: `RiskGauge` (tick gauge) and `ShapLedger` (waterfall from the average risk to the user's risk). Behaviour, routes, API calls and visible text that tests rely on stay the same.

**Tech Stack:** React 19, Vite 8, plain CSS (custom properties, grid, media queries), Vitest + Testing Library. Font: `@fontsource-variable/manrope` (self-hosted, so the viva demo works offline). Recharts is removed.

**Spec:** `docs/design/style-preview.html` (visual reference, direction A), `docs/design/compare.html`, `docs/design/decisions.md`, `PRODUCT.md`.

## Global Constraints

- Tokens (copy exactly into `:root`): `--ground #e7eaee`, `--panel #f5f6f8`, `--tile #ffffff`, `--ink #101317`, `--ink-2 #5b636e`, `--ink-3 #646c78`, `--line #e2e6eb`, `--blue #2155f5`, `--blue-soft #e5ecff`, `--sky #cfe6f3`, `--sage #dceccf`, `--butter #f7e7a8`, `--night #0f1216`, `--night-2 #1b2027`, `--raise #f0643c`, `--lower #2fae6b`, `--low #2fae6b`, `--mod #e6a31e`, `--high #e5484d`, `--low-ink #17703f`, `--mod-ink #8a5a00`, `--high-ink #b4232a`, radii `--r-xl 32px`, `--r-lg 24px`, `--r-md 18px`, `--pill 999px`.
- Font: Manrope, body 16px / 1.5; big numbers weight 800, letter-spacing -0.04em to -0.05em, units at 0.38em in `--ink-3`.
- Risk colours always come with the word (Low / Moderate / High, "Raises risk" / "Lowers risk"). Colour is never the only signal.
- Text contrast WCAG AA (4.5:1 body). Focus ring: `3px solid var(--blue)`, offset 3px, via `:focus-visible`.
- Tap targets at least 44px. Layout works at 390px wide with no sideways scroll.
- `prefers-reduced-motion: reduce` turns off transitions.
- Risk categories: Low < 40%, Moderate 40–69%, High ≥ 70% (same as backend).
- Do not change visible text, labels, roles or accessible names that existing tests query. All 70 frontend tests stay green after every task.
- Heart image: `docs/design/assets/heart-3d.png` (Microsoft Fluent Emoji, MIT); decorative, `alt=""`.
- Commit messages: plain, no co-author line.
- No CSS framework, no new dependency except `@fontsource-variable/manrope`.

## Review Focus

- A result with every SHAP value near 0 (all pushes under 0.5 points): the ledger must still draw bars at least 2px wide and never divide by zero. Test in Task 4.
- A risk score of exactly 0.40 or 0.70: the gauge, the chip and the category word must agree with the backend's category (it is given, never recomputed). Test in Task 3.
- An old result with no SHAP saved (`result.shap` null): the result page shows the existing "No explanation was saved" message, not an empty ledger. Covered by the existing ResultPage tests; keep them green in Task 5.
- Long names and long LLM text (a 60-character full name, a 1,200-character narrative or chat reply): no overflow at 390px. Checked in the Task 10 screenshots with the sample data in Step 2.
- Keyboard-only use of the mobile tab bar and the plan's day bar: every item reachable and the focus ring visible on the dark bar. Checked in Task 2 and Task 8 with Tab.

---

### Task 1: Foundations (tokens, font, base elements)

**Files:**
- Create: `frontend/src/styles/base.css`
- Create: `frontend/src/assets/heart-3d.png` (copy of `docs/design/assets/heart-3d.png`)
- Modify: `frontend/src/main.jsx` (import font and `./styles/base.css`)
- Modify: `frontend/index.html` (add `<meta name="theme-color" content="#e7eaee">`)
- Modify: `frontend/package.json` (add `@fontsource-variable/manrope`, remove `recharts` happens in Task 4)

**Interfaces:**
- Produces: CSS custom properties from Global Constraints; utility classes used by later tasks: `.card` (white, `--r-xl`, padding 24px, soft shadow), `.card-dark` (night background, white text), `.card-sky`, `.card-sage`, `.chip`, `.chip-low`, `.chip-mod`, `.chip-high`, `.btn`, `.btn-primary` (blue pill), `.btn-light` (white pill), `.big-num` + `.unit`, `.grid-12` (12-column grid, 16px gap), `.visually-hidden`.
- Base element styles: `h1` (clamp 2.2rem–3.6rem, weight 800), `h2`, `h3`; `a`; `button`; `input`, `select`, `textarea` (height 48px, `--r-md`, 1px `--line` border, blue focus); `fieldset`/`legend`; `table` (white card, header row in `--panel`, 14px 16px cells); `[role="alert"]` (butter-tinted box with dark text); `em` inside disclaimers stays readable `--ink-2`.

- [ ] **Step 1:** `cd frontend && npm install @fontsource-variable/manrope` and copy the heart image.
- [ ] **Step 2:** Write `base.css` with the tokens, base element styles and utility classes above. Body background `--ground`; main content area max-width 1400px, centred.
- [ ] **Step 3:** Import `@fontsource-variable/manrope` and `./styles/base.css` in `main.jsx`.
- [ ] **Step 4:** Run `npm test` → 70 passed. Run `npm run build` → no errors.
- [ ] **Step 5:** Commit: `Add design tokens, Manrope font and base element styles`

### Task 2: App shell (Layout)

**Files:**
- Create: `frontend/src/components/Icon.jsx`
- Create: `frontend/src/components/Layout.css`
- Modify: `frontend/src/components/Layout.jsx`
- Test: `frontend/src/components/Layout.test.jsx`

**Interfaces:**
- Produces: `Icon({ name: string, size?: number = 20 })` returning an inline `<svg aria-hidden="true">` with stroke `currentColor`. Names: `home, heart, gauge, calendar, chat, list, plus, drop, clock, run, scale, sugar, smoke, dots, spark, alert, sun, cloud, moon, arrow, left, right, user, chart, logout`. Paths copied from the `<symbol>`s in `style-preview.html`; the missing ones (`plus, user, chart, logout`) are simple 24×24 stroke paths.
- Layout keeps the same link labels and order (tests query them) but uses `NavLink` so the active link gets `aria-current="page"`.

- [ ] **Step 1: Write the failing test**

```jsx
test("current page link is marked and every link stays available", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "GET /history": [200, { predictions: [], message: "No assessments yet." }] });
  renderApp("/dashboard");
  const nav = await screen.findByRole("navigation", { name: "Main" });
  expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  expect(within(nav).getByRole("link", { name: "Care Navigator" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
});
```

- [ ] **Step 2:** `npx vitest run src/components/Layout.test.jsx` → FAIL (no navigation named "Main").
- [ ] **Step 3:** Rebuild `Layout.jsx`:
  - top bar with the logo mark (dark rounded square + coral heart with ECG line, from the preview) and "CardioXplain"
  - `<nav aria-label="Main">` as a white pill holding `NavLink`s with icon + label (dark pill when active)
  - user chip (initials avatar in a blue gradient, full name, role) and a light "Sign Out" button
  - `<main id="main">` with a "Skip to content" link first in the page
  - Icons: dashboard `home`, assessment `plus`, history `list`, simulator `gauge`, plan `calendar`, navigator `chat`; admin `chart`, `user`.
- [ ] **Step 4:** In `Layout.css`, at ≤720px the nav becomes a fixed dark (`--night`) pill bar at the bottom: 16px from the edges, 70px tall, icons only. Labels stay in the DOM inside `.visually-hidden`, so the accessible names don't change. The active item gets a `--sky` circle. Add `padding-bottom: 110px` to `main` so content clears the bar.
- [ ] **Step 5:** Run `npm test` → 71 passed. In `npm run dev` at 390px, Tab through the bar: every item is reachable and the focus ring is visible on dark.
- [ ] **Step 6:** Commit: `Style the app shell with pill navigation and mobile tab bar`

### Task 3: RiskGauge component

**Files:**
- Create: `frontend/src/components/RiskGauge.jsx`, `frontend/src/components/RiskGauge.css`
- Test: `frontend/src/components/RiskGauge.test.jsx`

**Interfaces:**
- Produces: `RiskGauge({ percent: number, category: "Low"|"Moderate"|"High", size?: "large"|"small" = "large" })`. It renders a `<figure>` with an SVG of 51 ticks on a half circle (algorithm in the preview's `gauge()` script: colour stops 0 → #2fae6b, 0.4 → #e6a31e, 0.7 → #f0643c, 1 → #e5484d; ticks ≤ value at opacity 1, others 0.18; every 10th tick longer). Also:
  - the number `{percent}` with a `%` unit
  - a scale line "Low under 40 · Moderate · High 70+"
  - a chip with `{category} risk`
- Also produces `categoryClass(category) -> "chip-low"|"chip-mod"|"chip-high"` (exported, reused by Tasks 5, 6, 10).

- [ ] **Step 1: Write the failing tests**

```jsx
test("gauge states percent and category in words", () => {
  render(<RiskGauge percent={69} category="Moderate" />);
  expect(screen.getByRole("img", { name: "Risk gauge: 69 percent, Moderate risk" })).toBeInTheDocument();
  expect(screen.getByText("Moderate risk")).toHaveClass("chip-mod");
});
test("lit ticks follow the percent and the category is never recomputed", () => {
  const { container } = render(<RiskGauge percent={70} category="High" />);
  expect(container.querySelectorAll("line[data-on='true']")).toHaveLength(36); // ticks 0..35 of 51 cover 0-70%
  expect(screen.getByText("High risk")).toHaveClass("chip-high");
  render(<RiskGauge percent={40} category="Moderate" />);
  expect(screen.getByText("Moderate risk")).toHaveClass("chip-mod");
});
```

- [ ] **Step 2:** `npx vitest run src/components/RiskGauge.test.jsx` → FAIL (module not found).
- [ ] **Step 3:** Implement as specified. Tick i is on when `i / 50 <= percent / 100 + 1e-9`; mark it with `data-on`. `aria-label` on the SVG is exactly as in the test.
- [ ] **Step 4:** Run the file → PASS.
- [ ] **Step 5:** Commit: `Add risk gauge component`

### Task 4: ShapLedger component (replaces the Recharts chart)

**Files:**
- Create: `frontend/src/components/ShapLedger.jsx`, `frontend/src/components/ShapLedger.css`
- Test: `frontend/src/components/ShapLedger.test.jsx`
- Modify: `frontend/package.json` (`npm uninstall recharts` after Task 5 removes the last import; do it in Task 5 Step 4)

**Interfaces:**
- Consumes: `displayValue(feature, value)` from `ResultView.jsx`, `Icon` from Task 2.
- Produces: `ShapLedger({ shap: Array<{feature,label,value,shap}>, riskScore: number, estimated?: string[] = [] })` and the pure helper `ledgerRows(shap, riskScore) -> { baseline: number, rows: Array<{feature,label,value,shap,from,to}>, scale: { lo: number, hi: number } }`. All values are 0–1 probabilities.
  - `baseline = riskScore - Σ shap`.
  - Rows keep the given order.
  - `from` and `to` are running sums.
  - The scale is the min/max of the baseline and every `from`/`to`, padded by 0.03, rounded outward to 0.05, clamped to [0, 1].
- Each row shows:
  - the factor icon (`ap_hi/ap_lo→drop`, `age→clock`, `active→run`, `bmi/weight/height→scale`, `cholesterol→drop`, `gluc→sugar`, `smoke→smoke`, `alco→dots`, `gender→user`)
  - the label, the user's value with " (estimated)" when in `estimated`
  - a bar segment (`up` gradient `--raise`, `down` gradient `--lower`; minimum width 2px)
  - the effect `+12.4%` / `−3.1%` and the hidden word "Raises risk"/"Lowers risk"
- The last row is "Your estimate" with a dark marker at `riskScore` and the label "You". There is a dashed "average person" line at the baseline, an axis with 5 ticks across the scale, and a legend.

- [ ] **Step 1: Write the failing tests**

```jsx
const SHAP = [{ feature: "cholesterol", label: "Cholesterol", value: 3, shap: 0.124 },
  { feature: "ap_hi", label: "Systolic blood pressure", value: 120, shap: -0.031 }];
test("rows add up from the average to the user's risk", () => {
  const { baseline, rows, scale } = ledgerRows(SHAP, 0.563);
  expect(baseline).toBeCloseTo(0.47);
  expect(rows[1].to).toBeCloseTo(0.563);
  expect(scale).toEqual({ lo: 0.4, hi: 0.65 });
});
test("tiny effects still get a valid scale", () => {
  const { scale } = ledgerRows([{ feature: "age", label: "Age", value: 40, shap: 0.0001 }], 0.3001);
  expect(scale.hi).toBeGreaterThan(scale.lo);
});
test("ledger says direction in words and marks estimated values", () => {
  render(<ShapLedger shap={SHAP} riskScore={0.563} estimated={["ap_hi"]} />);
  expect(screen.getByText("+12.4%")).toBeInTheDocument();
  expect(screen.getByText("Lowers risk")).toBeInTheDocument();
  expect(screen.getByText(/120 \(estimated\)/)).toBeInTheDocument();
  expect(screen.getByText(/Everyone starts at the average risk in the data \(47%\)/)).toBeInTheDocument();
});
```

- [ ] **Step 2:** `npx vitest run src/components/ShapLedger.test.jsx` → FAIL.
- [ ] **Step 3:** Implement. Intro sentence (fixed copy): `Everyone starts at the average risk in the data ({baseline%}%). Each factor pushed you up or down from there, and the pushes add up to your {risk%}%.`
- [ ] **Step 4:** Run the file → PASS.
- [ ] **Step 5:** Commit: `Add SHAP ledger component`

### Task 5: Result page (ResultView)

**Files:**
- Modify: `frontend/src/components/ResultView.jsx`, create `frontend/src/components/ResultView.css`
- Modify: `frontend/package.json` (remove `recharts`)

**Interfaces:**
- Consumes: `RiskGauge`, `categoryClass` (Task 3), `ShapLedger` (Task 4), `Icon` (Task 2).
- Keeps the exports `displayValue`, `ShapTable` and every existing heading and text the ResultPage/History tests query.

- [ ] **Step 1:** Replace `ShapChart` (Recharts) with `<ShapLedger shap={result.shap} riskScore={result.risk_score} estimated={...} />`. Keep `ShapTable` below it under an `<h3>Exact numbers</h3>`.
- [ ] **Step 2:** Lay out as in the preview, on `.grid-12`:
  - **Left column (span 5):**
    - Dark risk card with `RiskGauge`, the prediction date, and `EstimateWarning` inside it (dark inner box, amber alert icon).
    - Input tiles: blood pressure (`--sky`, "Estimated · not measured" when estimated), exercise (`activity_minutes` of 150, 15-segment meter, 1 segment = 10 min, capped at 15; tile hidden when `activity_minutes` is null), BMI with weight and height, smoking (`cigarettes_per_day`, `--sage`; hidden when null).
  - **Right column (span 7):** ledger card, then the "AI-Generated Risk Narrative" card (sparkle icon, disclaimer in small grey text), then "Explore your results" as four light pill buttons with the arrow icon.
  - **≤1100px:** one column.
- [ ] **Step 3:** Run `npm test` → all pass. Fix only class names or wrapping elements if a test breaks, never test text.
- [ ] **Step 4:** `npm uninstall recharts`, then `npm run build` → OK, with no "recharts" in `src` (`grep -r recharts src` prints nothing).
- [ ] **Step 5:** Commit: `Style the result page with risk gauge and SHAP ledger`

### Task 6: Dashboard

**Files:**
- Modify: `frontend/src/pages/DashboardPage.jsx`, create `frontend/src/pages/DashboardPage.css`
- Modify: `frontend/src/components/HistoryTable.jsx` (category cell shows `.chip` + `categoryClass`, same text)

- [ ] **Step 1:** Hero row:
  - greeting line plus the `h1` "Dashboard"
  - the 3D heart (190px, neutral drop shadow; 108px in the top-right corner at ≤720px)
  - `+ New Assessment` as `.btn-primary` and `View all` history as `.btn-light`
- [ ] **Step 2:** Summary `<ul aria-label="Summary">` becomes 4 stat tiles:
  - total assessments
  - latest risk as a big number
  - category chip
  - last date
  
  The texts stay the same, e.g. `Total Assessments: 3`. Labels go small and grey, values big; split with spans inside the same `li` so the text content is unchanged.
- [ ] **Step 3:** Recent assessments go in a `.card`. Quick actions become 4 pastel cards (sky, sage, butter, white) with an icon circle and arrow. The educational notice becomes a quiet panel at the bottom.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Commit: `Style the dashboard`

### Task 7: Forms (Login, Assessment, shared fields)

**Files:**
- Modify: `frontend/src/pages/LoginPage.jsx`, `frontend/src/pages/AssessmentPage.jsx`, `frontend/src/components/YesNoField.jsx`, `frontend/src/components/FieldError.jsx`
- Create: `frontend/src/styles/forms.css` (imported in `base.css`)

- [ ] **Step 1:** Login: two-panel card on `--ground`:
  - left panel (dark `--night`) with logo, the heart image, and one line "Understand your heart risk and what you can change."
  - right panel holds the existing form
  - ≤720px: the dark panel shrinks to a header strip
- [ ] **Step 2:** Assessment:
  - each `h2` section ("About you", "Health measurements", "Lifestyle") becomes a `.card` with a number circle (the sections are a real sequence, so the numbers are honest)
  - fields in a 2-column grid (1 column at ≤720px)
  - help text in `--ink-2` under each label
  - "I don't know" options styled as chips
  - submit as a full-width `.btn-primary` on mobile
- [ ] **Step 3:** `YesNoField` radios become a two-pill segmented control. The real `<input type="radio">` stays and is visually hidden, the label is the pill, and `:focus-visible` shows on the pill. `FieldError` gets red text `--high-ink` with the alert icon.
- [ ] **Step 4:** `npm test` → all pass. Keyboard check: Tab and arrow keys move through the Yes/No pills.
- [ ] **Step 5:** Commit: `Style login and assessment forms`

### Task 8: Simulator and Plan

**Files:**
- Modify: `frontend/src/pages/SimulatorPage.jsx`, `frontend/src/pages/PlanPage.jsx`, `frontend/src/components/PlanCalendar.jsx`
- Create: `frontend/src/pages/SimulatorPage.css`, `frontend/src/components/PlanCalendar.css`

- [ ] **Step 1:** Simulator:
  - form in two cards: fixed values (white) and lifestyle changes (`--sky`)
  - the result shows a `--sky` card with the original percent struck through, the new percent as a big number, and a dark delta pill (e.g. "−4.6 points"); keep the existing sentence text
  - small `RiskGauge size="small"` for before and after side by side
  - factors table as in Task 5
- [ ] **Step 2:** PlanCalendar:
  - each week is a `.card`
  - a horizontal day bar of pills (weekday + date number) at the top of each week; each pill is an `<a href="#day-{n}">` to that day's section, which gets `id="day-{n}"`
  - all days stay rendered (tests query every day region)
  - each day: Morning / Afternoon / Evening rows with sun / cloud / moon icon circles (butter, sky, lavender `#e9e3ff`)
  - tasks as `--panel` rounded rows: checkbox, task text, step list, and type tag pill on the right
  - ticked tasks are struck through in `--ink-2`
- [ ] **Step 3:** PlanPage: the plan-length radios become two pill cards. The generate button is `.btn-primary`. The waiting text stays the same; add a slim pulsing bar under the button while busy (no animation under reduced motion). The disclaimer is small grey.
- [ ] **Step 4:** `npm test` → all pass. Tab through the day pills: focus is visible and Enter jumps to the day.
- [ ] **Step 5:** Commit: `Style the What-If simulator and health plan calendar`

### Task 9: Navigator, History, Admin, Not found

**Files:**
- Modify: `frontend/src/pages/NavigatorPage.jsx`, `HistoryPage.jsx`, `AdminDashboardPage.jsx`, `AdminUsersPage.jsx`, `NotFoundPage.jsx`
- Create: `frontend/src/pages/NavigatorPage.css`, `frontend/src/pages/AdminPages.css`

- [ ] **Step 1:** Navigator:
  - chat as a white card with bubbles: user messages right-aligned in `--blue` with white text, assistant messages left in `--panel`
  - long text wraps (`overflow-wrap: anywhere`)
  - input and send button in a pill bar at the bottom of the card
  - suggested questions as chips
- [ ] **Step 2:** History: table in a `.card` with category chips (from Task 6's HistoryTable).
- [ ] **Step 3:** Admin:
  - model metrics (accuracy, AUC and the rest) as big-number stat tiles
  - confusion matrix and risk category check tables as cards
  - usage numbers as tiles
  - activity log and users tables in cards that scroll sideways inside the card on small screens (`overflow-x: auto` on a wrapper), never the page
- [ ] **Step 4:** Not found: centred card with the heart image and a `.btn-primary` link home.
- [ ] **Step 5:** `npm test` → all pass.
- [ ] **Step 6:** Commit: `Style navigator, history, admin and not-found pages`

### Task 10: Visual check, records, wrap-up

**Files:**
- Modify: `CHANGES.md` (row #26), `README.md` (credits)

- [ ] **Step 1:** Start the backend and `npm run dev`. Log in as a user with a real assessment.
- [ ] **Step 2:** Make a stress test user with a 60-character full name, then ask the navigator a question that gets a long reply.
- [ ] **Step 3:** Screenshot at 1440px and at 390px (Chrome device mode) for:
  - login, dashboard, assessment, result, simulator, plan, navigator, history, admin, admin users
  
  Fix any overflow, overlap or cramped spacing found. Then run the Impeccable detector on `frontend/src` and fix real findings.
- [ ] **Step 4:** Add CHANGES.md row #26:
  - Change: new visual design (soft dashboard: rounded cards, pill navigation, dark risk card with a tick gauge, SHAP ledger waterfall from the average risk, mobile bottom tab bar, Manrope font, Fluent 3D heart image under the MIT licence); Recharts bar chart replaced by the ledger.
  - Reason: the FYP1 mockups were a prototype; the ledger shows SHAP's additive meaning (average + pushes = your risk) better than a plain bar chart.
  - Report: Figures 3.25–3.35.
- [ ] **Step 5:** Add a README "Credits" line: `3D heart image: Microsoft Fluent Emoji (MIT License), https://github.com/microsoft/fluentui-emoji`.
- [ ] **Step 6:** `npm test` → all pass. `npm run build` → OK. Commit: `Record the new visual design and image credit`. Commit `PRODUCT.md` and `docs/design/` in the same commit; add `.impeccable/review/` to `.gitignore`.
