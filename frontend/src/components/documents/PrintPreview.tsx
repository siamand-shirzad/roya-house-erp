import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Width of the DocumentPrint sheet (A4 at 96dpi).
const SHEET_WIDTH = 794;

// Shows the fixed-width sheet shrunk to fit its container, so the preview
// never needs a scrollbar. Uses CSS `zoom` (which also shrinks the layout
// height). ExportPdfButton resets the zoom on its clone before capturing,
// so the PDF is always rendered at full A4 size.
export function PrintPreview({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / SHEET_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <div data-print-zoom style={{ zoom: scale }}>
        {children}
      </div>
    </div>
  );
}
