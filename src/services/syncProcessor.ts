import { createClient } from "@supabase/supabase-js";
import { getDb, rawExecute } from "./database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let isProcessing = false;
let syncTimeout: any = null;

/**
 * Drain the sync_jobs queue one by one in strict FIFO order (lowest ID first).
 * Sends each SQL query to Supabase via exec_sql RPC.
 */
export async function processSyncJobs(): Promise<void> {
  if (isProcessing) return;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }

  isProcessing = true;

  try {
    const db = await getDb();

    while (true) {
      // Pick the oldest job in the queue
      const rows = await db.select<{ id: number; query: string }[]>(
        "SELECT id, query FROM sync_jobs ORDER BY id ASC LIMIT 1"
      );

      if (!rows || rows.length === 0) {
        break; // Queue is completely empty
      }

      const job = rows[0];

      try {
        const { error } = await supabase.rpc("exec_sql", {
          query_text: job.query,
        });

        if (error) {
          const errMsg = (error.message || "").toLowerCase();

          // If the exec_sql function is not yet installed on Supabase, pause and don't discard
          if (
            errMsg.includes("could not find the function") ||
            errMsg.includes("schema cache")
          ) {
            console.warn(
              "[Sync] Cloud exec_sql function not found in Supabase. Please install the function in Supabase SQL editor."
            );
            break;
          }

          // Network or timeout errors: keep the job and retry when reconnected
          if (
            errMsg.includes("fetch") ||
            errMsg.includes("network") ||
            errMsg.includes("failed to fetch") ||
            errMsg.includes("timeout") ||
            errMsg.includes("connection")
          ) {
            console.warn("[Sync] Network issue while syncing job #" + job.id + ". Retrying later.");
            break;
          }

          // Other errors (e.g. invalid query or syntax): log and discard so the queue doesn't stay blocked
          console.error(
            `[Sync] Unrecoverable error on job #${job.id} (${error.message}). Discarding query:`,
            job.query
          );
        }

        // Successfully executed or discarded: remove from sync_jobs
        await rawExecute("DELETE FROM sync_jobs WHERE id = $1", [job.id]);
      } catch (networkErr: any) {
        console.warn(
          `[Sync] Exception sending job #${job.id} to cloud. Pausing sync:`,
          networkErr?.message || networkErr
        );
        break;
      }
    }
  } catch (err) {
    console.error("[Sync] Error running processSyncJobs:", err);
  } finally {
    isProcessing = false;
  }
}

/**
 * Trigger background sync job processing with debounce.
 */
export function triggerSync(delayMs = 150): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    processSyncJobs().catch((err) => {
      console.error("[Sync] Background sync execution failed:", err);
    });
  }, delayMs);
}

// Automatically process sync jobs on network restoration and periodic interval
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[Sync] Online status detected, flushing sync jobs...");
    triggerSync(200);
  });

  // Check queue every 15 seconds to ensure any offline jobs get processed
  setInterval(() => {
    triggerSync(0);
  }, 15000);
}
