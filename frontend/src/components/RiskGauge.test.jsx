import { render, screen } from "@testing-library/react";
import RiskGauge from "./RiskGauge.jsx";

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
