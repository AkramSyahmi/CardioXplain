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
