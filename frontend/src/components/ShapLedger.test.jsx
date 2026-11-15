import { render, screen } from "@testing-library/react";
import ShapLedger, { ledgerRows } from "./ShapLedger.jsx";

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

test("total uses the backend's percent so it matches the gauge", () => {
  render(<ShapLedger shap={SHAP} riskScore={0.3951} riskPercent={39} />);
  expect(screen.getByText("39%")).toBeInTheDocument();
  expect(screen.getByText(/add up to your 39%/)).toBeInTheDocument();
});

test("smoking row adjusted with Framingham data gets a note (CHANGES.md #29)", () => {
  const smoker = [...SHAP, { feature: "smoke", label: "Smoking", value: 1, shap: 0.08, adjusted: true }];
  render(<ShapLedger shap={smoker} riskScore={0.643} />);
  expect(screen.getByText(/Framingham Heart Study/)).toBeInTheDocument();
});

test("no note when smoking is not adjusted", () => {
  render(<ShapLedger shap={SHAP} riskScore={0.563} />);
  expect(screen.queryByText(/Framingham/)).not.toBeInTheDocument();
});
