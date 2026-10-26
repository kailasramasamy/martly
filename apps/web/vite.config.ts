import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import path from "node:path"

export default defineConfig({
  plugins: [tanstackStart(), tailwindcss()],
  resolve: {
    alias: { "~": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
})
