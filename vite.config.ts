import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
export default defineConfig({
  root: resolve("frontend"),
  base: "./",
  publicDir: resolve("build/public"),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve("dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve("frontend/index.html"),
        "practice-store": resolve("frontend/storage/practice-store.ts"),
        "study-store": resolve("frontend/storage/study-store.ts"),
        "score-viewer": resolve("app/score-viewer.js"),
        "file-export": resolve("frontend/platform/file-export.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
});
