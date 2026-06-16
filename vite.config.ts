import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  publicDir: false,
  server: { port: 5173, open: true },
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
  },
});
