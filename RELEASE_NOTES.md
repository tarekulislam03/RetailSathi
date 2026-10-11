# Retail Sathi v0.2.0 - Billing Price Control, Quick POS Product Addition & Inventory Reversion

### 🚀 Key Features & Enhancements
- **Dynamic Cart MRP & Selling Price Editing**: Cashiers can now edit both the MRP and Selling Price directly within the POS cart table. When finalizing a checkout, updated MRP and price values automatically synchronize to the product inventory database and appear accurately on the generated receipt.
- **Accidental Billing & Quick Product Creation**: Added a dedicated "+ Quick Add Product" button in the Billing page cart section. If a customer presents an item not yet entered in inventory, cashiers can register product details on the fly and continue billing without interrupting the checkout workflow.
- **Reliable Sale Deletion & Stock Restoration**: Deleting a sale now reliably restores inventory quantities (`stock`) across all line items with multi-tier fallback matching (by product ID, barcode, and product name). Local views and tables instantly reload via live update notifications.
- **Label Printing Selection Reset**: Fixed an issue where selected items remained ticked in the bulk label printing dialog after print completion. Checkboxes and counts now cleanly reset upon successful printing or closing.

---
*Retail Sathi Automatic Online Update System*
