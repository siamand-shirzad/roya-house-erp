import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import { DocumentListPage } from "@/pages/documents/DocumentListPage";
import { DocumentFormPage } from "@/pages/documents/DocumentFormPage";
import { DocumentsLayout } from "@/components/documents-layout";
import { LandingPage } from "@/pages/site/LandingPage";

// Remount the form whenever the type or document changes, so state from one
// document (e.g. its id) can never leak into "new" or a different document.
function KeyedDocumentFormPage() {
  const { typeSlug, id } = useParams();
  return <DocumentFormPage key={`${typeSlug}/${id ?? "new"}`} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        {/* Public landing page (outside the ERP shell). */}
        <Route path="/site" element={<LandingPage />} />

        <Route
          path="/documents/:typeSlug"
          element={
            <DocumentsLayout>
              <DocumentListPage />
            </DocumentsLayout>
          }
        />
        <Route
          path="/documents/:typeSlug/new"
          element={
            <DocumentsLayout>
              <KeyedDocumentFormPage />
            </DocumentsLayout>
          }
        />
        <Route
          path="/documents/:typeSlug/:id"
          element={
            <DocumentsLayout>
              <KeyedDocumentFormPage />
            </DocumentsLayout>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
