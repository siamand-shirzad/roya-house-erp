import type { SVGProps } from "react";

// The four-pane Windows key glyph, for the command palette button ("Win"
// style search). lucide has no brand icons, so it is drawn here; it takes the
// same size/colour classes as a lucide icon.
export function WindowsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M3 5.1 10.4 4v7.1H3zM11.4 3.9 21 2.5v8.6h-9.6zM3 12.1h7.4v7.1L3 18.1zM11.4 12.1H21v8.6l-9.6-1.4z" />
    </svg>
  );
}
