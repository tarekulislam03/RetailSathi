import { HeldBill } from "../types";

const HELD_BILLS_STORAGE_KEY = "retail_sathi_held_bills";

// In-memory fallback for SSR / testing environments without window.localStorage
const memoryStorage: Record<string, string> = {};

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {}
  return memoryStorage[key] || null;
}

function setStorageItem(key: string, val: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, val);
    }
  } catch {}
  memoryStorage[key] = val;
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {}
  delete memoryStorage[key];
}

/**
 * Retrieve all currently held bills from persistent storage.
 */
export function getHeldBills(): HeldBill[] {
  try {
    const raw = getStorageItem(HELD_BILLS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to read held bills from storage:", err);
    return [];
  }
}

/**
 * Save a new bill into held bills storage.
 */
export function saveHeldBill(
  data: Omit<HeldBill, "id" | "heldAt">
): HeldBill {
  const current = getHeldBills();
  const newBill: HeldBill = {
    ...data,
    id: `HOLD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    heldAt: new Date().toISOString(),
  };

  const updated = [newBill, ...current];
  try {
    setStorageItem(HELD_BILLS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to persist held bill:", err);
  }

  return newBill;
}

/**
 * Delete a held bill by ID.
 */
export function removeHeldBill(id: string): HeldBill[] {
  const current = getHeldBills();
  const updated = current.filter((b) => b.id !== id);
  try {
    setStorageItem(HELD_BILLS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to update held bills after removal:", err);
  }
  return updated;
}

/**
 * Clear all held bills.
 */
export function clearAllHeldBills(): void {
  try {
    removeStorageItem(HELD_BILLS_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear held bills:", err);
  }
}
