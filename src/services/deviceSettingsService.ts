import { getDb } from "./database";

export interface DevicePrinterSettings {
  pos_printer?: string;
  pos_paper_width?: 58 | 80;
  barcode_printer?: string;
}

const STORAGE_KEYS = {
  pos_printer: "selected_pos_printer",
  pos_paper_width: "pos_paper_width",
  barcode_printer: "selected_barcode_printer",
};

let tableEnsured = false;

export async function ensureDeviceSettingsTable(db?: any): Promise<void> {
  if (tableEnsured) return;
  try {
    const activeDb = db || (await getDb());
    await activeDb.execute(`
      CREATE TABLE IF NOT EXISTS device_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn("[DeviceSettings] Failed to ensure device_settings table:", err);
  }
}

/**
 * Synchronous snapshot of local device printer settings from localStorage.
 */
export function getLocalDevicePrinterSettingsSync(): DevicePrinterSettings {
  if (typeof localStorage === "undefined") {
    return { pos_paper_width: 80 };
  }
  const posPrinter = localStorage.getItem(STORAGE_KEYS.pos_printer) || undefined;
  const rawWidth = localStorage.getItem(STORAGE_KEYS.pos_paper_width);
  const posPaperWidth: 58 | 80 = rawWidth === "58" ? 58 : 80;
  const barcodePrinter = localStorage.getItem(STORAGE_KEYS.barcode_printer) || undefined;

  return {
    pos_printer: posPrinter,
    pos_paper_width: posPaperWidth,
    barcode_printer: barcodePrinter,
  };
}

/**
 * Loads device-specific printer settings from the machine's LOCAL database (device_settings).
 * NEVER pulls from or syncs with Supabase.
 */
export async function getDevicePrinterSettings(): Promise<DevicePrinterSettings> {
  try {
    const db = await getDb();
    await ensureDeviceSettingsTable(db);

    const rows = await db.select<{ key: string; value: string | null }[]>(
      "SELECT key, value FROM device_settings WHERE key IN ('pos_printer', 'pos_paper_width', 'barcode_printer')"
    );

    const rowMap = new Map<string, string | null>();
    for (const r of rows) {
      rowMap.set(r.key, r.value);
    }

    // Read values from local SQLite
    let posPrinter = rowMap.get("pos_printer") || undefined;
    let rawWidth = rowMap.get("pos_paper_width");
    let barcodePrinter = rowMap.get("barcode_printer") || undefined;

    // Fallback to localStorage if local SQLite has not yet been populated
    if (!posPrinter && typeof localStorage !== "undefined") {
      posPrinter = localStorage.getItem(STORAGE_KEYS.pos_printer) || undefined;
      if (posPrinter) {
        await saveDevicePrinterSettingKey(db, "pos_printer", posPrinter);
      }
    }

    if (!rawWidth && typeof localStorage !== "undefined") {
      rawWidth = localStorage.getItem(STORAGE_KEYS.pos_paper_width);
      if (rawWidth) {
        await saveDevicePrinterSettingKey(db, "pos_paper_width", rawWidth);
      }
    }

    if (!barcodePrinter && typeof localStorage !== "undefined") {
      barcodePrinter = localStorage.getItem(STORAGE_KEYS.barcode_printer) || undefined;
      if (barcodePrinter) {
        await saveDevicePrinterSettingKey(db, "barcode_printer", barcodePrinter);
      }
    }

    const posPaperWidth: 58 | 80 = rawWidth === "58" ? 58 : 80;

    // Keep localStorage in sync with local SQLite
    if (typeof localStorage !== "undefined") {
      if (posPrinter) localStorage.setItem(STORAGE_KEYS.pos_printer, posPrinter);
      else localStorage.removeItem(STORAGE_KEYS.pos_printer);

      localStorage.setItem(STORAGE_KEYS.pos_paper_width, String(posPaperWidth));

      if (barcodePrinter) localStorage.setItem(STORAGE_KEYS.barcode_printer, barcodePrinter);
      else localStorage.removeItem(STORAGE_KEYS.barcode_printer);
    }

    return {
      pos_printer: posPrinter || undefined,
      pos_paper_width: posPaperWidth,
      barcode_printer: barcodePrinter || undefined,
    };
  } catch (err) {
    console.warn("[DeviceSettings] Failed to load from SQLite, falling back to localStorage:", err);
    return getLocalDevicePrinterSettingsSync();
  }
}

async function saveDevicePrinterSettingKey(db: any, key: string, value: string): Promise<void> {
  await db.execute(
    `INSERT INTO device_settings (key, value, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
}

/**
 * Saves printer settings exclusively into this device's LOCAL SQLite database (device_settings).
 * This data is NOT added to SYNC_TABLES and is NEVER sent to Supabase.
 */
export async function saveDevicePrinterSettings(
  settings: Partial<DevicePrinterSettings>
): Promise<void> {
  // Update localStorage immediately for fast synchronous access
  if (typeof localStorage !== "undefined") {
    if (settings.pos_printer !== undefined) {
      if (settings.pos_printer) {
        localStorage.setItem(STORAGE_KEYS.pos_printer, settings.pos_printer);
      } else {
        localStorage.removeItem(STORAGE_KEYS.pos_printer);
      }
    }

    if (settings.pos_paper_width !== undefined) {
      localStorage.setItem(STORAGE_KEYS.pos_paper_width, String(settings.pos_paper_width));
    }

    if (settings.barcode_printer !== undefined) {
      if (settings.barcode_printer) {
        localStorage.setItem(STORAGE_KEYS.barcode_printer, settings.barcode_printer);
      } else {
        localStorage.removeItem(STORAGE_KEYS.barcode_printer);
      }
    }
  }

  // Persist directly to local SQLite database (device_settings)
  try {
    const db = await getDb();
    await ensureDeviceSettingsTable(db);

    if (settings.pos_printer !== undefined) {
      await saveDevicePrinterSettingKey(db, "pos_printer", settings.pos_printer || "");
    }

    if (settings.pos_paper_width !== undefined) {
      await saveDevicePrinterSettingKey(db, "pos_paper_width", String(settings.pos_paper_width));
    }

    if (settings.barcode_printer !== undefined) {
      await saveDevicePrinterSettingKey(db, "barcode_printer", settings.barcode_printer || "");
    }
  } catch (err) {
    console.error("[DeviceSettings] Failed to persist to local SQLite database:", err);
  }
}
