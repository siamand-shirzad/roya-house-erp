import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

// Renders the already-mounted #elementId node (the DocumentPrint component)
// to a canvas and drops it into a single-page-per-A4-sheet PDF. Doing the
// capture from the live DOM (rather than re-drawing text manually) is what
// keeps Persian/RTL shaping correct in the exported file.
export function ExportPdfButton({
  elementId,
  fileName,
}: {
  elementId: string;
  fileName: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      // html2canvas-pro (not html2canvas): Tailwind v4 colors are oklch(),
      // which the original html2canvas can't parse.
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const node = document.getElementById(elementId);
      if (!node) throw new Error("Printable element not found");

      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        // The on-screen preview may be shrunk to fit (PrintPreview); capture at full size.
        onclone: (doc) => {
          doc.querySelectorAll<HTMLElement>("[data-print-zoom]").forEach((el) => {
            el.style.zoom = "1";
          });
        },
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(fileName);
    } catch (err) {
      console.error(err);
      alert(`ساخت فایل PDF ناموفق بود: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleExport} disabled={loading} size="sm">
      {loading ? <Loader2 className="animate-spin" /> : <Download />}
      دانلود PDF
    </Button>
  );
}
