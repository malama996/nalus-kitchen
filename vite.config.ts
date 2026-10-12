import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import netlify from "@netlify/vite-plugin-tanstack-start";
import tailwindcss from "@tailwindcss/vite";

const target = process.env['DEPLOY_TARGET'] ?? "cloudflare";

export default defineConfig({
  plugins: [
    ...(target === "cloudflare" ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    ...(target === "netlify" ? [netlify()] : []),
  ],
});

