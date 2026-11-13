// Base styles must load before the app so page and component rules can override them (final review, Important 3).
import { readFileSync } from "node:fs";

test("base.css is imported before App", () => {
  const main = readFileSync("src/main.jsx", "utf8"); // vitest runs from frontend/
  expect(main.indexOf("./styles/base.css")).toBeGreaterThan(-1);
  expect(main.indexOf("./styles/base.css")).toBeLessThan(main.indexOf("./App.jsx"));
});
