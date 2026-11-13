// Line icons (24x24, stroke = currentColor). Decorative: the text next to them carries the meaning.
const PATHS = {
  home: <path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5Z" />,
  heart: <path d="M12 20.5 4.3 13a4.6 4.6 0 0 1 6.5-6.5L12 7.7l1.2-1.2a4.6 4.6 0 0 1 6.5 6.5Z" />,
  gauge: <><path d="M4 16a8 8 0 1 1 16 0" /><path d="m12 16 4-5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  chat: <path d="M5 18.5V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8Z" />,
  list: <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />,
  plus: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></>,
  drop: <path d="M12 3.5s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  run: <><circle cx="14" cy="4.5" r="1.8" /><path d="m6 20 3.5-5 3 2 1-5 3 3h3M9.5 10l3-2.5 3.5 1.5" /></>,
  scale: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 10a5 5 0 0 1 7 0l-2.5 3" /></>,
  sugar: <path d="m12 3 7.5 4.3v8.6L12 20.2l-7.5-4.3V7.3Z" />,
  smoke: <><rect x="3" y="14" width="15" height="4" rx="1" /><path d="M14 14v4M20 14v4M18 10c0-2 2-2 2-4M15.5 10c0-2 2-2 2-4" /></>,
  dots: <><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></>,
  spark: <><path d="M12 3.5 13.8 9 19.5 11l-5.7 2-1.8 5.5-1.8-5.5L4.5 11l5.7-2Z" /><path d="M19 3v3M17.5 4.5h3" /></>,
  alert: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5M12 16.2v.3" /></>,
  sun: <><circle cx="12" cy="12" r="3.8" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  cloud: <path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 18Z" />,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5Z" />,
  arrow: <path d="M7 17 17 7M9 7h8v8" />,
  left: <path d="m14.5 6-6 6 6 6" />,
  right: <path d="m9.5 6 6 6-6 6" />,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  chart: <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />,
  logout: <><path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" /><path d="M14 8l4 4-4 4M18 12H9" /></>,
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
