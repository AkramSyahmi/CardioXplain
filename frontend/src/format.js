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

const YES_NO_FIELDS = ["smoke", "alco", "active"];
const GENDER = { male: "Male", female: "Female" };
const LEVEL = { 1: "Normal", 2: "Above normal", 3: "Well above normal" };

/** The user's value in plain words, e.g. smoke 0 -> "No", cholesterol 2 -> "Above normal". */
export function displayValue(feature, value) {
  if (YES_NO_FIELDS.includes(feature)) return value ? "Yes" : "No";
  if (feature === "gender") return GENDER[value] ?? value;
  if (feature === "cholesterol" || feature === "gluc") return LEVEL[value] ?? value;
  return value;
}
