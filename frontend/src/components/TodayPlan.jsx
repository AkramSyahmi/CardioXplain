// "Today's plan": today's tasks from the calendar health plan, ticked in the same place as the Plan page.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api.js";
import { formatDay } from "../format.js";
import Icon from "./Icon.jsx";
import { BLOCKS, TYPE_NAMES, loadTicks, saveTicks, ticksKey } from "./PlanCalendar.jsx";
import "./TodayPlan.css";

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function TodayPlan() {
  const [plan, setPlan] = useState(undefined); // undefined = loading, null = no plan
  const [ticks, setTicks] = useState(new Set());

  useEffect(() => {
    apiRequest("/action-plan")
      .then((data) => {
        setPlan(data.plan);
        if (data.plan?.calendar) setTicks(loadTicks(ticksKey(data.plan)));
      })
      .catch(() => setPlan(null));
  }, []);

  const days = plan?.calendar?.weeks.flatMap((week) => week.days) ?? [];
  const today = days.find((day) => day.date === todayIso());
  const tasks = today
    ? BLOCKS.flatMap(([block, blockName, icon]) => today.blocks[block].map((task, i) => ({
      id: `${today.day}-${block}-${i}`, blockName, icon, ...task })))
    : [];
  const done = tasks.filter((task) => ticks.has(task.id)).length;

  function toggle(id) {
    const next = new Set(ticks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTicks(next);
    saveTicks(ticksKey(plan), next);
  }

  return (
    <section className="card today" aria-labelledby="today-heading">
      <div className="card-head">
        <h2 id="today-heading">Today's plan</h2>
        {today && <span className="chip">{done} of {tasks.length} done</span>}
      </div>

      {plan === undefined && <p className="help">Loading...</p>}
      {plan === null && (
        <div className="today-empty">
          <p>Get a day-by-day plan with meals, exercise and sleep tasks based on your result.</p>
          <Link className="btn btn-primary" to="/plan">Create my plan</Link>
        </div>
      )}
      {plan && !today && (
        <div className="today-empty">
          <p>
            {days.length > 0
              ? `Your plan covers ${formatDay(days[0].date)} to ${formatDay(days.at(-1).date)}.`
              : "Your saved plan has no calendar days."}
          </p>
          <Link className="btn btn-light" to="/plan">Open my plan</Link>
        </div>
      )}
      {today && (
        <>
          <div className="today-progress" aria-hidden="true">
            <span style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
          </div>
          <ul className="today-tasks">
            {tasks.map((task) => {
              const type = TYPE_NAMES[task.type] ?? task.type;
              return (
                <li key={task.id} className={ticks.has(task.id) ? "done" : ""}>
                  <label>
                    <input type="checkbox" checked={ticks.has(task.id)} onChange={() => toggle(task.id)}
                      aria-label={`${type}: ${task.task}`} />
                    <span className="today-icon"><Icon name={task.icon} size={18} /></span>
                    <span className="today-text"><span className="today-task" title={task.task}>{task.task}</span><small>{task.blockName} · {type}</small></span>
                  </label>
                </li>
              );
            })}
          </ul>
          <Link className="today-link" to="/plan">See the whole week</Link>
        </>
      )}
    </section>
  );
}
