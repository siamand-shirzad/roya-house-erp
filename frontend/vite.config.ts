import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Inline (empty) PostCSS config stops Vite searching parent folders for one;
  // Tailwind v4 runs through @tailwindcss/vite, so PostCSS isn't needed.
  css: {
    postcss: {},
  },
  server: {
    port: 5173,
  },
});
