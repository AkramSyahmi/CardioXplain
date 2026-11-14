import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setToken } from "../api.js";
import { RESULT, USER, mockApi, renderApp } from "../test/helpers.jsx";

const UNAVAILABLE = "The Care Navigator is currently unavailable. Please try again later.";

beforeEach(() => setToken("t1"));

function sentBodies(api) {
  return api.mock.calls.filter(([url]) => url === "/api/navigator").map(([, o]) => JSON.parse(o.body));
}

async function ask(text) {
  await userEvent.type(screen.getByLabelText("Your question"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

test("navigator sends question with history", async () => {
  let n = 0;
  const api = mockApi({
    "GET /auth/me": [200, { user: USER }],
    "POST /navigator": () => [200, { reply: `Answer ${++n}`, disclaimer: RESULT.disclaimer }],
  });
  renderApp("/navigator");
  expect(await screen.findByText(/I'm your CardioXplain Care Navigator/)).toBeInTheDocument();
  await ask("What is BMI?");
  expect(await screen.findByText("Answer 1")).toBeInTheDocument();
  await ask("Is mine high?");
  expect(await screen.findByText("Answer 2")).toBeInTheDocument();
  const [first, second] = sentBodies(api);
  expect(first).toEqual({ message: "What is BMI?", history: [] });
  expect(second).toEqual({ message: "Is mine high?", history: [
    { role: "user", content: "What is BMI?" }, { role: "assistant", content: "Answer 1" }] });
  expect(screen.getByLabelText("Your question")).toHaveValue("");
});

test("suggested question is sent on click", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }], "POST /navigator": [200, { reply: "Sure.", disclaimer: "" }] });
  renderApp("/navigator");
  const suggestions = await screen.findByRole("list", { name: "Suggested questions" });
  expect(within(suggestions).getAllByRole("button")).toHaveLength(7);
  await userEvent.click(within(suggestions).getByRole("button", { name: "How do I lower my blood pressure?" }));
  expect(await screen.findByText("Sure.")).toBeInTheDocument();
  expect(sentBodies(api)[0].message).toBe("How do I lower my blood pressure?");
});

test("send disabled while waiting", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }] });
  const real = api.getMockImplementation();
  api.mockImplementation((url, o) => (url === "/api/navigator" ? new Promise(() => {}) : real(url, o)));
  renderApp("/navigator");
  await screen.findByLabelText("Your question");
  await ask("Hello");
  expect(screen.getByText("Thinking...")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
});

test("empty question is not sent", async () => {
  const api = mockApi({ "GET /auth/me": [200, { user: USER }] });
  renderApp("/navigator");
  await userEvent.click(await screen.findByRole("button", { name: "Send" }));
  expect(sentBodies(api)).toHaveLength(0);
});

test("navigator shows unavailable message and keeps the question", async () => {
  mockApi({ "GET /auth/me": [200, { user: USER }], "POST /navigator": [503, { error: UNAVAILABLE }] });
  renderApp("/navigator");
  await screen.findByLabelText("Your question");
  await ask("What is cholesterol?");
  expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument();
  expect(screen.getByText("What is cholesterol?")).toBeInTheDocument();
  expect(screen.getByText(/Educational only/)).toBeInTheDocument();
});
