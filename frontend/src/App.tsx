import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Outlet, RouterProvider, createBrowserRouter, createRoutesFromElements, Route, useParams } from "react-router-dom";
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const DocumentListPage = lazy(() => import("@/pages/documents/DocumentListPage").then((m) => ({ default: m.DocumentListPage })));
const DocumentFormPage = lazy(() => import("@/pages/documents/DocumentFormPage").then((m) => ({ default: m.DocumentFormPage })));
import { DocumentsLayout } from "@/components/documents-layout";
import { AuthProvider, RequireAuth, useAuth } from "@/components/auth-provider";
import { canAccessPath } from "@/lib/permissions";
import { Toaster } from "@/components/ui/sonner";
import { CommandMenuProvider } from "@/components/command-menu";
const LandingPage = lazy(() => import("@/pages/site/LandingPage").then((m) => ({ default: m.LandingPage })));
import { LoginPage } from "@/pages/LoginPage";
const ProductsPage = lazy(() => import("@/pages/ProductsPage").then((m) => ({ default: m.ProductsPage })));
import { CustomersPage } from "@/pages/CustomersPage";
const UsersPage = lazy(() => import("@/pages/UsersPage").then((m) => ({ default: m.UsersPage })));
const ReportsPage = lazy(() => import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const InventoryPage = lazy(() => import("@/pages/InventoryPage").then((m) => ({ default: m.InventoryPage })));
const CompanySettingsPage = lazy(() => import("@/pages/CompanySettingsPage").then((m) => ({ default: m.CompanySettingsPage })));
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";
const PaymentsPage = lazy(() => import("@/pages/PaymentsPage").then((m) => ({ default: m.PaymentsPage })));
const ExchangePage = lazy(() => import("@/pages/ExchangePage").then((m) => ({ default: m.ExchangePage })));
const ReturnsPage = lazy(() => import("@/pages/ReturnsPage").then((m) => ({ default: m.ReturnsPage })));
const GuidePage = lazy(() => import("@/pages/GuidePage").then((m) => ({ default: m.GuidePage })));

// Remount the form whenever the type or document changes, so state from one
// document (e.g. its id) can never leak into "new" or a different document.
function KeyedDocumentFormPage() {
  const { typeSlug, id } = useParams();
  return <DocumentFormPage key={`${typeSlug}/${id ?? "new"}`} />;
}

function DocumentsIndex() {
  const { user } = useAuth();
  const target = ["/documents/proforma", "/documents/invoice", "/documents/goods-issue"].find((path) => canAccessPath(user, path));
  return target ? <Navigate to={target} replace /> : <div className="p-4">دسترسی به اسناد ندارید.</div>;
}

const documents = (page: ReactNode) => (
  <RequireAuth>
    <DocumentsLayout>{page}</DocumentsLayout>
  </RequireAuth>
);

// AuthProvider and CommandMenuProvider both call useNavigate/useLocation, so
// they have to render *inside* the router, not wrap it. This root route is
// the one place that's true for every page, including /site and /login.
function RootLayout() {
  return (
    <AuthProvider>
      <CommandMenuProvider>
        <Suspense fallback={<div className="p-8 text-center" role="status">در حال بارگذاری...</div>}><Outlet /></Suspense>
      </CommandMenuProvider>
      <Toaster />
    </AuthProvider>
  );
}

// A data router (rather than plain <BrowserRouter>) is what makes
// useBlocker available — it's how DocumentFormPage and ProductsPage stop
// in-app navigation (links, the header back button, browser back/forward)
// while there are unsaved edits, not just the browser-close beforeunload case.
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      {/* Public: landing page and sign-in. */}
      <Route path="/site" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* ERP: signed-in users only. */}
      <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/products" element={<RequireAuth><ProductsPage /></RequireAuth>} />
      <Route path="/customers/:id" element={<RequireAuth><CustomerDetailPage /></RequireAuth>} />
      <Route path="/customers" element={<RequireAuth><CustomersPage /></RequireAuth>} />
      <Route path="/users" element={<RequireAuth roles={["ADMIN"]}><UsersPage /></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
      <Route path="/inventory" element={<RequireAuth><InventoryPage /></RequireAuth>} />
      <Route path="/payments" element={<RequireAuth><PaymentsPage /></RequireAuth>} />
      <Route path="/exchange" element={<RequireAuth><ExchangePage /></RequireAuth>} />
      <Route path="/returns" element={<RequireAuth><ReturnsPage /></RequireAuth>} />
      <Route path="/guide" element={<RequireAuth><GuidePage /></RequireAuth>} />
      <Route
        path="/settings/company"
        element={<RequireAuth><CompanySettingsPage /></RequireAuth>}
      />
      <Route path="/documents" element={<RequireAuth><DocumentsIndex /></RequireAuth>} />
      <Route path="/documents/:typeSlug" element={documents(<DocumentListPage />)} />
      <Route path="/documents/:typeSlug/new" element={documents(<KeyedDocumentFormPage />)} />
      <Route path="/documents/:typeSlug/:id" element={documents(<KeyedDocumentFormPage />)} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  )
);

export default function App() {
  return <RouterProvider router={router} />;
}
