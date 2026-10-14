/**
 * Utility functions to format and parse dates accurately in Indian Standard Time (Asia/Kolkata).
 */

/**
 * Accurately parses any date string, ISO string, or invoice number into a Date.
 * If invoiceNo (INV-YYYYMMDD-HHMMSS-RAND) is provided, extracts the exact
 * date and time recorded when the invoice was generated.
 */
export function parseSaleDate(
  dateInput?: string | Date | null,
  invoiceNo?: string | null
): Date | null {
  // 1. Highest fidelity: extract from invoice number INV-YYYYMMDD-HHMMSS-RAND
  if (invoiceNo && typeof invoiceNo === "string") {
    const match = invoiceNo.match(
      /^INV-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/i
    );
    if (match) {
      const [, y, m, d, h, min, s] = match;
      const parsed = new Date(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(h),
        Number(min),
        Number(s)
      );
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  const rawStr = String(dateInput).trim();
  if (!rawStr) return null;

  // 2. Handle DD/MM/YYYY or DD-MM-YYYY format with optional time
  const dmyMatch = rawStr.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i
  );
  if (dmyMatch) {
    let [, d, m, y, h, min, s, ampm] = dmyMatch;
    let hour = h ? parseInt(h, 10) : 0;
    if (ampm) {
      if (ampm.toLowerCase() === "pm" && hour < 12) hour += 12;
      if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;
    }
    const parsed = new Date(
      parseInt(y, 10),
      parseInt(m, 10) - 1,
      parseInt(d, 10),
      hour,
      min ? parseInt(min, 10) : 0,
      s ? parseInt(s, 10) : 0
    );
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 3. Fallback standard Date parsing
  let parseable = rawStr;
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?/.test(rawStr)) {
    parseable = rawStr.replace(" ", "T");
  }
  const standard = new Date(parseable);
  if (!isNaN(standard.getTime())) {
    // Detect timestamps saved as local IST but tagged with +00:00 (UTC), which causes them
    // to render 5.5 hours into the future. Correct them back to the intended local time.
    const nowMs = Date.now();
    if (standard.getTime() > nowMs + 60000) {
      return new Date(standard.getTime() - 5.5 * 3600 * 1000);
    }
    return standard;
  }

  return null;
}

/**
 * Format any date input into a 12-hour formatted string in Asia/Kolkata timezone.
 */
export function formatTo12Hour(
  dateInput?: string | Date | null,
  invoiceNo?: string | null
): string {
  if (!dateInput && !invoiceNo) return "—";

  const parsed = parseSaleDate(dateInput, invoiceNo);
  if (parsed && !isNaN(parsed.getTime())) {
    return parsed.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  return dateInput ? String(dateInput) : "—";
}
