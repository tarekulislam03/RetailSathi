import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { BillingPage } from "./features/billing/pages/BillingPage";
import { InventoryPage } from "./features/inventory/pages/InventoryPage";
import { SalesPage } from "./features/sales/pages/SalesPage";
import { PurchasesPage } from "./features/purchases/pages/PurchasesPage";
import { CustomersPage } from "./features/customers/pages/CustomersPage";
import { LedgerPage } from "./features/ledger/pages/LedgerPage";
import { MarketingPage } from "./features/marketing/pages/MarketingPage";
import "./App.css";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/billing" replace />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="purchases" element={<PurchasesPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="marketing" element={<MarketingPage />} />
          <Route path="*" element={<Navigate to="/billing" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
