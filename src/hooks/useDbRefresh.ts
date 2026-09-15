import { useEffect, useRef } from "react";
import { DB_UPDATED_EVENT } from "../services/syncProcessor";

/**
 * Hook to keep component data constantly refreshed in real time.
 * Triggers refresh when:
 * 1. Background sync pulls changes from Supabase (DB_UPDATED_EVENT)
 * 2. Window/Tab gains focus
 * 3. Constant polling timer (default every 3000ms)
 */
export function useDbRefresh(
  onRefresh: () => void | Promise<void>,
  intervalMs = 3000
): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const handleDbUpdate = () => {
      onRefreshRef.current();
    };

    const handleWindowFocus = () => {
      onRefreshRef.current();
    };

    // Listen for database sync events
    window.addEventListener(DB_UPDATED_EVENT, handleDbUpdate);
    window.addEventListener("focus", handleWindowFocus);

    // Constant background refresh interval
    const timer = setInterval(() => {
      onRefreshRef.current();
    }, intervalMs);

    return () => {
      window.removeEventListener(DB_UPDATED_EVENT, handleDbUpdate);
      window.removeEventListener("focus", handleWindowFocus);
      clearInterval(timer);
    };
  }, [intervalMs]);
}
