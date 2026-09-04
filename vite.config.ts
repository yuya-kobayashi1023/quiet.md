import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri は固定ポートを前提にするため strictPort。
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "chrome110",
    sourcemap: true,
  },
});
