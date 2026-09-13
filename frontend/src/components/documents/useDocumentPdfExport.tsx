import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { DocumentPrint } from "@/components/documents/DocumentPrint";
import { exportElementToPdf } from "@/lib/exportPdf";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import type { Document } from "@/types";

export function documentPdfFileName(doc: Pick<Document, "type" | "number">) {
  return `${TYPE_TO_SLUG[doc.type]}-${doc.number || "draft"}.pdf`;
}

// Export a document to PDF from anywhere, without opening its form: the sheet
// is mounted for a moment behind the app (it has to be laid out to be
// captured), exported, and unmounted. Render `host` somewhere in the page.
export function useDocumentPdfExport() {
  const [doc, setDoc] = useState<Document | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!doc) return;
    const node = hostRef.current?.firstElementChild as HTMLElement | null;
    if (!node) return;
    let cancelled = false;
    exportElementToPdf(node, documentPdfFileName(doc))
      .catch((err) => {
        console.error(err);
        if (!cancelled) toast.error("ساخت فایل PDF ناموفق بود.", { description: (err as Error).message });
      })
      .finally(() => {
        if (!cancelled) setDoc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const host = doc
    ? createPortal(
        // Behind everything (z-index -1) but still laid out at full A4 width;
        // visibility:hidden or opacity:0 would be captured as a blank page.
        <div
          ref={hostRef}
          aria-hidden
          style={{ position: "absolute", top: 0, left: 0, width: 794, zIndex: -1, pointerEvents: "none" }}
        >
          <DocumentPrint doc={doc} />
        </div>,
        document.body
      )
    : null;

  return {
    /** Starts an export; ignored while another one is still running. */
    exportDocument: (next: Document) => setDoc((current) => current ?? next),
    exportingId: doc?.id ?? null,
    host,
  };
}
