// Shared display helpers.

/** "2026-06-12T08:48:00" -> "12 Jun 2026, 08:48" */
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** "2026-06-12T08:48:00" -> "12 Jun 2026" */
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "2026-11-16" (a calendar date, no time) -> "Mon 16 Nov 2026" */
export function formatDay(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  }).replace(",", "");
}
