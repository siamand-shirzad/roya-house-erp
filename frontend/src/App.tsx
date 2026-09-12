import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import { DocumentListPage } from "@/pages/documents/DocumentListPage";
import { DocumentFormPage } from "@/pages/documents/DocumentFormPage";
import { DocumentsLayout } from "@/components/documents-layout";
import { AuthProvider, RequireAuth } from "@/components/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { LandingPage } from "@/pages/site/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { UsersPage } from "@/pages/UsersPage";

// Remount the form whenever the type or document changes, so state from one
// document (e.g. its id) can never leak into "new" or a different document.
function KeyedDocumentFormPage() {
  const { typeSlug, id } = useParams();
  return <DocumentFormPage key={`${typeSlug}/${id ?? "new"}`} />;
}

const documents = (page: ReactNode) => (
  <RequireAuth>
    <DocumentsLayout>{page}</DocumentsLayout>
  </RequireAuth>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public: landing page and sign-in. */}
          <Route path="/site" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* ERP: signed-in users only. */}
          <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/products" element={<RequireAuth><ProductsPage /></RequireAuth>} />
          <Route path="/users" element={<RequireAuth roles={["ADMIN"]}><UsersPage /></RequireAuth>} />
          <Route path="/documents/:typeSlug" element={documents(<DocumentListPage />)} />
          <Route path="/documents/:typeSlug/new" element={documents(<KeyedDocumentFormPage />)} />
          <Route path="/documents/:typeSlug/:id" element={documents(<KeyedDocumentFormPage />)} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
