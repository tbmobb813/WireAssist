import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Prevent Vite/Rollup from trying to statically resolve Tauri's API modules
  // when building a web bundle. These modules are only available at runtime
  // inside the Tauri desktop environment.
  build: {
    rollupOptions: {
      external: [
        /^@tauri-apps\/api($|\/)/,
        // Externalize @lia-code/core and its Node.js dependencies
        // These modules are only used in the Tauri backend, not in the browser
        '@lia-code/core',
        'better-sqlite3',
        'crypto',
        'fs',
        'path',
        'os',
        'util',
      ],
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks
          vendor: ["react", "react-dom"],
          ui: ["lucide-react", "zustand"],
          markdown: [
            "react-markdown",
            "rehype-highlight",
            "rehype-katex",
            "remark-gfm",
            "remark-math",
          ],
          math: ["katex"],
        },
      },
    },
    // Enable compression reporting
    reportCompressedSize: true,
    // Reduce chunk size warning limit
    chunkSizeWarningLimit: 400,
  },
  // Enable dependency optimization
  optimizeDeps: {
    exclude: [
      "@tauri-apps/api",
      "@lia-code/core",
      "better-sqlite3",
    ],
  },
});
