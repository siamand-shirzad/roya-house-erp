import { createPrintPages } from "./print-pages";

// Turns a mounted DocumentPrint node into an A4 PDF. The capture works on the
// rendered DOM (rather than drawing text with jsPDF) because that is what keeps
// Persian shaping and RTL layout correct in the file.
//
// Each page captures whole rows with repeated headers. Totals and signatures
// appear only on the last page. Compressed JPEG keeps the file size modest.

const JPEG_QUALITY = 0.82;
const CAPTURE_SCALE = 2; // 794px sheet -> 1588px image; keeps small print legible

async function waitForAssets(node: HTMLElement) {
  // A capture taken before the logo or a web font has loaded shows a gap or a
  // fallback font, which matters most for sheets rendered just for export.
  await document.fonts?.ready;
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined)
    )
  );
}

export async function renderElementToPdf(node: HTMLElement) {
  // html2canvas-pro (not html2canvas): Tailwind v4 colors are oklch(), which
  // the original html2canvas can't parse.
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  await waitForAssets(node);

  const { host, pages } = createPrintPages(node);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  try {
    for (const [index, page] of pages.entries()) {
      await waitForAssets(page);
      const canvas = await html2canvas(page, {
        scale: CAPTURE_SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      if (index) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", JPEG_QUALITY), "JPEG", 0, 0,
        pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), `page-${index}`, "FAST");
    }
  } finally {
    host.remove();
  }

  return pdf;
}

export async function exportElementToPdf(node: HTMLElement, fileName: string) {
  const pdf = await renderElementToPdf(node);
  pdf.save(fileName);
}
