import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            strategies: "injectManifest",
            srcDir: "src/pwa",
            filename: "sw.ts",
            registerType: "autoUpdate",
            injectRegister: null,
            manifest: false,
            includeAssets: [
                "favicon.svg",
                "manifest.webmanifest",
                "offline.html",
                "barbershop-barber.svg",
                "icons/*.png",
                "*.avif",
                "*.jpg",
            ],
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,avif,jpg,jpeg,woff2}"],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },
            injectManifest: {
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },
            devOptions: {
                enabled: true,
                type: "module",
                navigateFallback: "index.html",
            },
        }),
    ],
});
