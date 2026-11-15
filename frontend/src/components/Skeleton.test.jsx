import { render, screen } from "@testing-library/react";
import Skeleton from "./Skeleton.jsx";

test("skeleton tells screen readers the page is loading", () => {
  const { container } = render(<Skeleton tiles={4} cards={2} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  expect(container.querySelectorAll(".sk-tile")).toHaveLength(4);
  expect(container.querySelectorAll(".sk-card")).toHaveLength(2);
});

test("skeleton without cards shows bare lines for use inside a card", () => {
  const { container } = render(<Skeleton cards={0} lines={3} />);
  expect(container.querySelectorAll(".sk-card")).toHaveLength(0);
  expect(container.querySelectorAll(".sk-line")).toHaveLength(3);
});
