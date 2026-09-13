// Turns a mounted DocumentPrint node into an A4 PDF. The capture works on the
// rendered DOM (rather than drawing text with jsPDF) because that is what keeps
// Persian shaping and RTL layout correct in the file.
//
// Size: the sheet used to go in as a PNG, re-embedded on every page, which
// made even a one-page document several megabytes. It now goes in as a JPEG,
// jsPDF compresses the stream, and every page reuses the same embedded image
// through an alias instead of storing another copy.

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

  const canvas = await html2canvas(node, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    backgroundColor: "#ffffff",
    // The on-screen preview may be shrunk to fit (PrintPreview); capture at full size.
    onclone: (doc) => {
      doc.querySelectorAll<HTMLElement>("[data-print-zoom]").forEach((el) => {
        el.style.zoom = "1";
      });
    },
  });

  const imgData = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  // One image, shifted up a page height at a time; the alias makes jsPDF embed it once.
  // A sheet exactly one A4 tall comes out a fraction of a point taller after
  // px -> pt rounding, so ignore overflow under 2pt instead of adding a blank page.
  const OVERFLOW_TOLERANCE = 2;
  for (let offset = 0; offset < imgHeight - OVERFLOW_TOLERANCE; offset += pageHeight) {
    if (offset > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, -offset, pageWidth, imgHeight, "sheet", "FAST");
  }

  return pdf;
}

export async function exportElementToPdf(node: HTMLElement, fileName: string) {
  const pdf = await renderElementToPdf(node);
  pdf.save(fileName);
}
