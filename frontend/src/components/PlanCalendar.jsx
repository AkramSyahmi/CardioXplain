// Day-by-day calendar health action plan (UC-1000, CHANGES.md #25). Ticks are kept in this browser.
import { useState } from "react";
import { formatDay } from "../format.js";
import Icon from "./Icon.jsx";
import "./PlanCalendar.css";

const BLOCKS = [["morning", "Morning", "sun"], ["afternoon", "Afternoon", "cloud"], ["evening", "Evening", "moon"]];
const TYPE_NAMES = { meal: "Meal", workout: "Workout", hydration: "Hydration", sleep: "Sleep", habit: "Habit" };

function loadTicks(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

function saveTicks(key, ticks) {
  try {
    localStorage.setItem(key, JSON.stringify([...ticks]));
  } catch {
    // Private mode or blocked storage: ticks just are not remembered.
  }
}

export default function PlanCalendar({ plan }) {
  const storageKey = `cardioxplain_plan_${plan.prediction_id}_${plan.generated_at}`;
  const [ticks, setTicks] = useState(() => loadTicks(storageKey));

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
                <a key={day.day} href={`#day-${day.day}`} className="day-pill">
                  {weekday}<b>{date}</b>
                </a>
              );
            })}
          </nav>
          {week.days.map((day) => {
            const heading = `${formatDay(day.date)} - Day ${day.day}: ${day.title}`;
            return (
              <section key={day.day} id={`day-${day.day}`} className="plan-day" aria-label={heading}>
                <h3>{heading}</h3>
                {BLOCKS.map(([block, blockName, icon]) => (
                  <div key={block} className="slot">
                    <span className={`slot-icon slot-${block}`}><Icon name={icon} /></span>
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
              </section>
            );
          })}
        </section>
      ))}
    </>
  );
}
