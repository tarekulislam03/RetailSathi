import { fetchProducts } from "../features/inventory/services/inventoryService";
import { fetchCustomers } from "../features/customers/services/customerService";

export interface AppNotification {
  id: string;
  type: "warning" | "info" | "danger";
  title: string;
  message: string;
  timestamp: string;
  category: "Stock Alert" | "Customer Due" | "System";
}

export async function fetchSystemNotifications(): Promise<AppNotification[]> {
  const notifications: AppNotification[] = [];

  try {
    // 1. Check Low Stock Items
    const products = await fetchProducts();
    const lowStockProducts = products.filter(
      (p) => p.stock <= p.reorder_threshold
    );

    for (const p of lowStockProducts) {
      notifications.push({
        id: `stock-${p.id}`,
        type: p.stock === 0 ? "danger" : "warning",
        title: p.stock === 0 ? "Out of Stock Alert" : "Low Stock Alert",
        message: `${p.name} (Batch: ${p.batch_no || "N/A"}) has ${
          p.stock
        } units remaining (Reorder threshold: ${p.reorder_threshold}).`,
        timestamp: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        category: "Stock Alert",
      });
    }

    // 2. Check Customer Pending Dues
    const customers = await fetchCustomers();
    const pendingDuesCustomers = customers.filter((c) => (c.dues || 0) > 0);

    for (const c of pendingDuesCustomers) {
      notifications.push({
        id: `due-${c.id}`,
        type: "warning",
        title: "Outstanding Customer Due",
        message: `${c.name} (${c.phone || "No phone"}) has outstanding dues of ₹${(
          c.dues || 0
        ).toFixed(2)}.`,
        timestamp: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        category: "Customer Due",
      });
    }
  } catch (err) {
    console.error("Error fetching system notifications:", err);
  }

  return notifications;
}

const CLEARED_NOTIFICATIONS_KEY = "cleared_notification_ids";

export function getClearedNotificationIds(): string[] {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(CLEARED_NOTIFICATIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to read cleared notification IDs from localStorage:", err);
  }
  return [];
}

export function saveClearedNotificationIds(ids: string[]): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CLEARED_NOTIFICATIONS_KEY, JSON.stringify(ids));
    }
  } catch (err) {
    console.error("Failed to save cleared notification IDs to localStorage:", err);
  }
}

export function addClearedNotificationId(id: string): string[] {
  const current = new Set(getClearedNotificationIds());
  current.add(id);
  const updatedList = Array.from(current);
  saveClearedNotificationIds(updatedList);
  return updatedList;
}

export function addClearedNotificationIds(ids: string[]): string[] {
  const current = new Set(getClearedNotificationIds());
  ids.forEach((id) => current.add(id));
  const updatedList = Array.from(current);
  saveClearedNotificationIds(updatedList);
  return updatedList;
}

