import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { exportElementToPdf } from "@/lib/exportPdf";

// Exports the already-mounted #elementId node (the DocumentPrint preview).
// The capture and PDF assembly live in lib/exportPdf.ts, shared with the
// "دانلود PDF" action on the document list.
export function ExportPdfButton({ elementId, fileName }: { elementId: string; fileName: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const node = document.getElementById(elementId);
      if (!node) throw new Error("Printable element not found");
      await exportElementToPdf(node, fileName);
    } catch (err) {
      console.error(err);
      toast.error("ساخت فایل PDF ناموفق بود.", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleExport} disabled={loading} size="sm">
      {loading ? <LoaderCircle className="animate-spin" /> : <Download />}
      دانلود PDF
    </Button>
  );
}
