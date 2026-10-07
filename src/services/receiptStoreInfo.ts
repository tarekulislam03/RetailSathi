import { getActiveOrFirstStore } from "../features/stores/services/storeService";
import { getActiveStoreInfo, StoreReceiptInfo } from "./escposService";

const CACHE_KEY = "last_receipt_store_info";

function readCache(): StoreReceiptInfo | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as StoreReceiptInfo) : null;
  } catch {
    return null;
  }
}

function writeCache(info: StoreReceiptInfo): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CACHE_KEY, JSON.stringify(info));
    }
  } catch {
    // ignore
  }
}

const flag = (v: unknown) => v !== 0 && v !== false;

/**
 * Loads the real store profile (address, UPI QR, etc.) for receipts.
 * Retries on transient DB errors (e.g. "database is locked" right after a sale)
 * and falls back to the last successfully loaded profile instead of the
 * hard-coded demo defaults.
 */
export async function loadReceiptStoreInfo(): Promise<StoreReceiptInfo> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const store = await getActiveOrFirstStore();
      if (store) {
        const info: StoreReceiptInfo = {
          name: store.name || "Retail Sathi Supermarket",
          code: store.code || "",
          tagline: store.tagline || "",
          promo_text: store.promo_text || "",
          address: store.address || "",
          phone: store.phone || "",
          email: store.email || "",
          gstin: store.gstin || "",
          fssai: store.fssai || "",
          logo_url: store.logo_url || "/Retail Sathi.png",
          return_policy: store.return_policy ?? "Exchange within 7 days with original bill.",
          upi_id: store.upi_id || undefined,
          upi_name: store.upi_name || store.name || undefined,
          receipt_footer:
            store.receipt_footer ?? "Thank you for shopping with us!\nPlease visit again!",
          show_barcode: flag(store.show_barcode),
          show_upi_qr: flag(store.show_upi_qr),
          show_header: flag(store.show_header),
          show_customer: flag(store.show_customer),
          show_savings: flag(store.show_savings),
          show_tax: flag(store.show_tax),
          show_return_policy: flag(store.show_return_policy),
          mandatory_bill_note: flag(store.mandatory_bill_note),
          paper_width: store.paper_width || 80,
          default_printer: store.default_printer || undefined,
        };
        writeCache(info);
        return info;
      }
    } catch (err) {
      console.warn(`[Receipt] Store load attempt ${attempt + 1} failed:`, err);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return readCache() || (await getActiveStoreInfo());
}
