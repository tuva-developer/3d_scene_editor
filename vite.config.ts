import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api/vbd": {
        target: "https://developers.vietbando.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/vbd/, "/V2/service/PartnerPortalService.svc/rest"),
      },
    },
  },
});
