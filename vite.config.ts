/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// `--mode standalone` (ou `VITE_STANDALONE=1`) gera um build com caminhos relativos e
// roteamento por hash, útil para hospedar o app estático em qualquer subcaminho (ex.: preview).
// As variáveis do modo ficam em `.env.standalone`, o que funciona em qualquer shell (inclusive PowerShell).
export default defineConfig(({ mode }) => {
  const standalone =
    mode === "standalone" || process.env.VITE_STANDALONE === "1";
  return {
    base: standalone ? "./" : "/",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            tanstack: ["@tanstack/react-router", "@tanstack/react-query"],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["src/test/setup.ts"],
    },
  };
});
