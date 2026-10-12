# Retail Sathi v0.2.1 - Receipt MRP Column, Dynamic UPI QR Fix & Standardized 50-Item Pagination

### 🚀 Key Features & Enhancements
- **Receipt Items MRP Column**: Added a dedicated `MRP` column in the items table (`Item Name | Qty | MRP | Rate | Amount`) across both the on-screen customer receipt preview and thermal ESC/POS print rendering (optimized for both 80mm and 58mm receipt rolls).
- **Thermal Receipt Typography Optimization**: Refined header proportions by moderating the store name font size and increasing the store tagline font size for enhanced clarity and aesthetic balance.
- **Dynamic UPI QR Code Reliability**: Completely resolved dynamic UPI QR rendering by integrating the robust ISO/IEC 18004 compliant `qrcode` engine, strictly formatting NPCI UPI payment strings (preserving unencoded VPA `@` handles), adding quiet-zone margins, and ensuring reliable image cache invalidation.
- **Standardized 50-Item Pagination**: Standardized the default table pagination across the entire app to 50 items per page with selectable increments of `50, 100, 200, 500` (applied across Inventory, Sales History, Purchases, Customers, Suppliers, Stock Ledger, Marketing, and related modals).

---
*Retail Sathi Automatic Online Update System*
