/**
 * Utility function to format any date input (Date object, ISO string, SQL datetime string, etc.)
 * into a consistent 12-hour formatted date/time string (e.g. "13 Sep 2026, 10:15:30 PM").
 */
export function formatTo12Hour(dateInput?: string | Date | null): string {
  if (!dateInput) return "—";

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return "—";
    return dateInput.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  const rawStr = String(dateInput).trim();
  if (!rawStr) return "—";

  // Check if string already contains 12-hour format indicators (AM / PM)
  if (/\b(am|pm)\b/i.test(rawStr)) {
    return rawStr;
  }

  // Handle standard SQL datetime "YYYY-MM-DD HH:mm:ss" format
  let parseable = rawStr;
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?/.test(rawStr)) {
    parseable = rawStr.replace(" ", "T");
  }

  const d = new Date(parseable);
  if (!isNaN(d.getTime())) {
    // If input was YYYY-MM-DD (date only, no time component)
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawStr)) {
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  return rawStr;
}
