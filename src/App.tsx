import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./features/auth/context/AuthContext";
import { ProtectedRoute } from "./features/auth/components/ProtectedRoute";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { MainLayout } from "./components/layout/MainLayout";
import { BillingPage } from "./features/billing/pages/BillingPage";
import { InventoryPage } from "./features/inventory/pages/InventoryPage";
import { SalesPage } from "./features/sales/pages/SalesPage";
import { PurchasesPage } from "./features/purchases/pages/PurchasesPage";
import { CustomersPage } from "./features/customers/pages/CustomersPage";
import { LedgerPage } from "./features/ledger/pages/LedgerPage";
import { MarketingPage } from "./features/marketing/pages/MarketingPage";
import { UsersPage } from "./features/users/pages/UsersPage";
import { SettingsPage } from "./features/settings/pages/SettingsPage";
import { GstReportPage } from "./features/reports/pages/GstReportPage";
import { UpdateChecker } from "./components/common/UpdateChecker";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <UpdateChecker />
      <HashRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes for Authenticated Users */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/billing" replace />} />
              
              {/* POS / Billing accessible to both Cashiers and Admins */}
              <Route path="billing" element={<BillingPage />} />

              {/* Admin-only Routes */}
              <Route element={<ProtectedRoute allowedRoles={["admin", "manager"]} />}>
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="purchases" element={<PurchasesPage />} />
                <Route path="sales" element={<SalesPage />} />
                <Route path="sales-history" element={<SalesPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="ledger" element={<LedgerPage />} />
                <Route path="gst-report" element={<GstReportPage />} />
                <Route path="reports" element={<GstReportPage />} />
                <Route path="marketing" element={<MarketingPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/billing" replace />} />
            </Route>
          </Route>

          {/* Fallback to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
