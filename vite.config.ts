import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Content-Security-Policy injected only in production builds (dev server needs inline scripts).
function csp(supabaseUrl: string): Plugin {
  const host = supabaseUrl ? new URL(supabaseUrl).host : "*.supabase.co";
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    `connect-src 'self' https://${host} wss://${host}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "inject-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: "./",
    plugins: [react(), tailwindcss(), csp(env.VITE_SUPABASE_URL)],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    build: { chunkSizeWarningLimit: 1500 },
  };
});
