import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-router")) return "vendor-router";
            if (id.includes("@tanstack/react-query")) return "vendor-query";
            if (id.includes("antd")) return "vendor-antd";
            return "vendor";
          }
          if (id.includes("/pages/traffic/")) return "page-traffic";
          if (id.includes("/pages/proxy-forward/")) return "page-proxy-forward";
          if (id.includes("/pages/mock/")) return "page-mock";
          if (id.includes("/pages/debug/")) return "page-debug";
          if (id.includes("/pages/settings/")) return "page-settings";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
