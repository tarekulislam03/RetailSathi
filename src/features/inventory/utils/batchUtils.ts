import { Product } from "../types";

export type BatchStatus = "New Stock" | "Old Stock";

export function getBatchStatusMap(products: Product[]): Map<number, BatchStatus> {
  const statusMap = new Map<number, BatchStatus>();

  // Group products by barcode or lowercase product name
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const key = (p.barcode && p.barcode.trim())
      ? `barcode:${p.barcode.trim().toLowerCase()}`
      : `name:${p.name.trim().toLowerCase()}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(p);
  }

  // Evaluate each group of products/batches
  for (const group of groups.values()) {
    // Sort group items by creation timestamp DESC, falling back to id DESC
    group.sort((a, b) => {
      if (a.created_at && b.created_at) {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
          return dateB - dateA; // latest date first
        }
      }
      return b.id - a.id; // highest/newest ID first
    });

    // The first item (latest created) is 'New Stock'. If only 1 batch exists, it is also 'New Stock'!
    if (group.length > 0) {
      statusMap.set(group[0].id, "New Stock");
    }

    // All older batches of the same product are 'Old Stock'
    for (let i = 1; i < group.length; i++) {
      statusMap.set(group[i].id, "Old Stock");
    }
  }

  return statusMap;
}
