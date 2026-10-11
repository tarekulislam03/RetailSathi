# Retail Sathi v0.1.9 - Inventory Pagination Fix & Directory Navigation Stability

### 🚀 Bug Fixes & Stability Improvements
- **Fixed Inventory Directory Pagination Glitch**: Resolved an issue where background database sync polls (every ~3 seconds) caused the inventory table to reset back to page 1 while navigating or viewing subsequent pages (e.g., page 3).
- **Directory Navigation Stability**: Enhanced pagination state across Inventory, Customers, Sales, Stock Ledger, Purchases, and Marketing directories. Table views now maintain the user's active page during automatic background syncs and only reset to page 1 upon user-initiated search query or filter changes.
- **Safe Page Clamping**: Added automatic boundary clamping so that if item counts shrink or change, the table cleanly adjusts to the nearest valid page without crashing or displaying empty slices.
- **Page Size Selector Handling**: Smooth page recalculation whenever the rows-per-page selector is adjusted.

---
*Retail Sathi Automatic Online Update System*
