// UC-700 Use Virtual Care Navigator (Figure 3.33). The chat lives only in this page; nothing is stored.
import { useState } from "react";
import { apiRequest } from "../api.js";
import "./NavigatorPage.css";

const GREETING =
  "Hello! I'm your CardioXplain Virtual Care Navigator. I can help you understand cardiovascular health, " +
  "explain your risk results, and provide educational guidance. Please note that I provide educational " +
  "information only and cannot replace professional medical advice. How can I help you today?";

const SUGGESTED = [
  "What is cardiovascular disease?",
  "What are the main risk factors?",
  "How do I lower my blood pressure?",
  "What does my risk score mean?",
  "Is my cholesterol level dangerous?",
  "Should I be concerned about my BMI?",
  "How often should I check my heart health?",
];

const SPEAKER = { user: "You", assistant: "Navigator", error: "Navigator" };

export default function NavigatorPage() {
  // role: "user" | "assistant" | "error" (error lines are shown but never sent back to the LLM)
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.filter((m) => m.role !== "error").map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: message }]);
    setQuestion("");
    setBusy(true);
    try {
      const data = await apiRequest("/navigator", { method: "POST", body: { message, history } });
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((current) => [...current, { role: "error", content: err.message }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    send(question);
  }

  return (
    <>
      <h1>Virtual Care Navigator</h1>
      <p className="page-lead">Ask health-related questions and receive educational guidance.</p>
      <p className="chip nav-note"><strong>Educational only - not medical advice.</strong></p>

      <div className="chat-layout">
        <section className="card chat" aria-labelledby="chat-heading">
          <h2 id="chat-heading">Health Chat</h2>
          <ol className="messages" aria-label="Conversation">
            <li className="msg msg-assistant">
              <strong>Navigator:</strong> {GREETING}
            </li>
            {messages.map((m, i) => (
              <li key={i} className={`msg msg-${m.role}`}>
                <strong>{SPEAKER[m.role]}:</strong>{" "}
                {m.role === "error" ? <span role="alert">{m.content}</span> : m.content}
              </li>
            ))}
            {busy && <li className="msg msg-assistant msg-busy">Thinking...</li>}
          </ol>

          <form className="ask" onSubmit={submit}>
            <label htmlFor="question" className="visually-hidden">Your question</label>
            <input id="question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000}
              placeholder="Type your health question here..." />
            <button type="submit" disabled={busy}>Send</button>
          </form>
        </section>

        <section aria-labelledby="suggest-heading">
          <h2 id="suggest-heading">Suggested Questions</h2>
          <ul className="suggestions" aria-label="Suggested Questions">
            {SUGGESTED.map((text) => (
              <li key={text}>
                <button type="button" onClick={() => send(text)} disabled={busy}>{text}</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
