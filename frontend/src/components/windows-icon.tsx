import type { SVGProps } from "react";

// The Windows key glyph for the command palette button ("Win"-style search).
// lucide has no brand icons, so it is drawn here; it takes the same
// size/colour classes as a lucide icon.
//
// Four flat, evenly gapped panes — the Windows 11 mark. The older logo tilted
// the grid to fake perspective, which read as heavier and slightly blurry at
// the 16px the sidebar renders it at.
export function WindowsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="2.5" y="2.5" width="8.5" height="8.5" rx="1.4" />
      <rect x="13" y="2.5" width="8.5" height="8.5" rx="1.4" />
      <rect x="2.5" y="13" width="8.5" height="8.5" rx="1.4" />
      <rect x="13" y="13" width="8.5" height="8.5" rx="1.4" />
    </svg>
  );
}
