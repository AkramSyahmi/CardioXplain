// Day-by-day calendar health action plan (UC-1000, CHANGES.md #25). Ticks are kept in this browser.
import { useState } from "react";
import { formatDay } from "../format.js";

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
import Icon from "./Icon.jsx";
import "./PlanCalendar.css";

export const BLOCKS = [["morning", "Morning", "sun"], ["afternoon", "Afternoon", "cloud"], ["evening", "Evening", "moon"]];
export const TYPE_NAMES = { meal: "Meal", workout: "Workout", hydration: "Hydration", sleep: "Sleep", habit: "Habit" };

/** Ticks are saved per plan in this browser; the dashboard's Today's plan uses the same key. */
export function ticksKey(plan) {
  return `cardioxplain_plan_${plan.prediction_id}_${plan.generated_at}`;
}

export function loadTicks(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

export function saveTicks(key, ticks) {
  try {
    localStorage.setItem(key, JSON.stringify([...ticks]));
  } catch {
    // Private mode or blocked storage: ticks just are not remembered.
  }
}

export default function PlanCalendar({ plan }) {
  const storageKey = ticksKey(plan);
  const [ticks, setTicks] = useState(() => loadTicks(storageKey));
  // One day open at a time (today, or day 1 if the plan has not started), so the page is not one long wall.
  const allDays = plan.calendar.weeks.flatMap((week) => week.days);
  const [openDay, setOpenDay] = useState(() => (allDays.find((day) => day.date === todayIso()) ?? allDays[0])?.day);

  function toggle(id) {
    const next = new Set(ticks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTicks(next);
    saveTicks(storageKey, next);
  }

  return (
    <>
      {plan.calendar.weeks.map((week) => (
        <section key={week.week} className="card plan-week">
          <h2>Week {week.week}: {week.theme}</h2>
          <nav className="day-bar" aria-label={`Days in week ${week.week}`}>
            {week.days.map((day) => {
              const [weekday, date] = formatDay(day.date).split(" ");
              return (
                <button key={day.day} type="button" className="day-pill" aria-pressed={openDay === day.day}
                  aria-label={`${weekday} ${date}`} onClick={() => setOpenDay(day.day)}>
                  {weekday}<b>{date}</b>
                </button>
              );
            })}
          </nav>
          {week.days.map((day) => {
            const heading = `${formatDay(day.date)} - Day ${day.day}: ${day.title}`;
            const ids = BLOCKS.flatMap(([block]) => day.blocks[block].map((_, i) => `${day.day}-${block}-${i}`));
            const done = ids.filter((id) => ticks.has(id)).length;
            return (
              <section key={day.day} id={`day-${day.day}`} className="plan-day" aria-label={heading}>
                <details open={openDay === day.day}
                  onToggle={(event) => {
                    if (event.currentTarget.open) setOpenDay(day.day);
                    else if (openDay === day.day) setOpenDay(null);
                  }}>
                <summary>
                  <h3>{heading}</h3>
                  <span className="chip">{done} of {ids.length} done</span>
                </summary>
                {BLOCKS.map(([block, blockName, icon]) => (
                  <div key={block} className={`slot time-${block}`}>
                    <span className="slot-icon"><Icon name={icon} /></span>
                    <h4>{blockName}</h4>
                    <ul className="tasks">
                      {day.blocks[block].map((task, i) => {
                        const id = `${day.day}-${block}-${i}`;
                        const type = TYPE_NAMES[task.type] ?? task.type;
                        return (
                          <li key={id} className={ticks.has(id) ? "task done" : "task"}>
                            <label>
                              <input type="checkbox" checked={ticks.has(id)} onChange={() => toggle(id)}
                                aria-label={`${type}: ${task.task}`} />
                              <span className="task-text">
                                <span className="tag" aria-hidden="true">{type}</span>
                                {task.task}
                              </span>
                            </label>
                            <ol>
                              {task.steps.map((step, s) => <li key={s}>{step}</li>)}
                            </ol>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                </details>
              </section>
            );
          })}
        </section>
      ))}
    </>
  );
}
