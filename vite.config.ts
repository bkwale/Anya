import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Precache all built assets so the app works fully offline
        globPatterns: ["**/*.{js,css,html,ico,svg,png,woff2}"],
        runtimeCaching: [
          {
            // Cache Google Fonts if any are used
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: "Anya — Speech Recovery Companion",
        short_name: "Anya",
        description: "Your daily speech practice companion",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        theme_color: "#4a7c6f",
        background_color: "#faf8f5",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
