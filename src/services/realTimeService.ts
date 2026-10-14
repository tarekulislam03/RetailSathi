/**
 * Real Time Service
 * Calibrates real-world time against server time so inaccurate computer clocks
 * (e.g. wrong timezone, dead CMOS battery, clock drift on cashier PCs)
 * do not record incorrect sale dates or invoice numbers.
 */

const TIME_OFFSET_KEY = "retail_sathi_time_offset";

// Read cached offset from localStorage if available
let timeOffsetMs: number = (() => {
  try {
    const val = localStorage.getItem(TIME_OFFSET_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
})();

let syncPromise: Promise<void> | null = null;

export async function syncRealTime(): Promise<void> {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const url =
        import.meta.env.VITE_SUPABASE_URL ||
        "https://sfbzeehmjrarhprpagxy.supabase.co";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const serverDateHeader = res.headers.get("date");
      if (serverDateHeader) {
        const serverTimestamp = new Date(serverDateHeader).getTime();
        if (!isNaN(serverTimestamp)) {
          timeOffsetMs = serverTimestamp - Date.now();
          try {
            localStorage.setItem(TIME_OFFSET_KEY, String(timeOffsetMs));
          } catch {}
          console.log(
            `[RealTime] Calibrated with server. Clock offset: ${timeOffsetMs}ms`
          );
        }
      }
    } catch {
      // Offline or network error: fallback to cached timeOffsetMs
      console.warn(
        "[RealTime] Could not reach server to calibrate clock, using offset:",
        timeOffsetMs
      );
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

// Automatically sync on load and every 5 minutes
syncRealTime();
if (typeof window !== "undefined") {
  setInterval(syncRealTime, 5 * 60 * 1000);
}

/**
 * Returns a Date object representing the true calibrated real-world time.
 */
export function getRealTime(): Date {
  return new Date(Date.now() + timeOffsetMs);
}

/**
 * Formats an invoice number and local timestamp in Indian Standard Time (Asia/Kolkata).
 * Guarantees date and time are always in the same timezone and free of PC clock skew.
 */
export function generateInvoiceInfo(d: Date = getRealTime()): {
  invoiceNo: string;
  dateStr: string;
  timeStr: string;
  localCreatedAt: string;
  isoString: string;
} {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(d);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const dateStr = `${map.year}${map.month}${map.day}`;
  const timeStr = `${map.hour}${map.minute}${map.second}`;
  const rand = Math.floor(100 + Math.random() * 900);
  const invoiceNo = `INV-${dateStr}-${timeStr}-${rand}`;

  const localCreatedAt = d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return {
    invoiceNo,
    dateStr,
    timeStr,
    localCreatedAt,
    isoString: d.toISOString(),
  };
}
