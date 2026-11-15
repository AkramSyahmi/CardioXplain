import { render, screen } from "@testing-library/react";
import PageHeader from "./PageHeader.jsx";

test("page header has the title, a useful sentence and a status on the right", () => {
  render(<PageHeader icon="list" title="My history" lead="Every assessment, newest first."
    crumb={<span>My history</span>}><span>13 assessments</span></PageHeader>);
  expect(screen.getByRole("heading", { level: 1, name: "My history" })).toBeInTheDocument();
  expect(screen.getByText("Every assessment, newest first.")).toBeInTheDocument();
  expect(screen.getByText("13 assessments")).toBeInTheDocument();
});
