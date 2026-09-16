import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted fonts (bundled, no Google Fonts request). Latin + digits:
// Inter (text), Space Grotesk (headings), Geist Mono (numbers/codes). Persian
// letters fall back to IBM Plex Sans Arabic. Stacks are defined in index.css.
import "@fontsource-variable/inter";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource-variable/geist-mono";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import { LucideProvider } from "lucide-react";

import App from "./App";
import { ThemeProvider } from "@/components/theme-provider";
import "./index.css";
import "./rtl.css";

// lucide's own default stroke is 2, which reads heavy at the larger icon
// sizes this UI uses. The provider only sets a default: any icon passing its
// own strokeWidth still wins.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LucideProvider strokeWidth={1.5}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </LucideProvider>
  </StrictMode>
);
