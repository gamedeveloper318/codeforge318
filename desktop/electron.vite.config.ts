import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";

const alias = { "@shared": resolve("src/shared") };

// Monaco 0.57 vendors DOMPurify 3.4.15, which has published advisories. Its only
// import site ("./dompurify/dompurify.js") is redirected to the patched npm
// package pinned in package.json. Same API: a default-exported DOMPurify instance.
const rendererAlias = [
  { find: "@shared", replacement: resolve("src/shared") },
  { find: /^\.\/dompurify\/dompurify\.js$/, replacement: "dompurify" },
];

/**
 * Injects the Content Security Policy into index.html. The dev server needs
 * inline scripts (React refresh) and a websocket for HMR; production builds
 * get the strict policy.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: "codeforge-csp",
    transformIndexHtml(html, ctx) {
      const dev = Boolean(ctx.server);
      const policy = [
        "default-src 'self'",
        dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "worker-src 'self' blob:",
        dev ? "connect-src 'self' ws://localhost:* http://localhost:*" : "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-src 'none'",
      ].join("; ");
      return html.replace("__CSP__", policy);
    },
  };
}

export default defineConfig({
  main: {
    resolve: { alias },
  },
  preload: {
    resolve: { alias },
  },
  renderer: {
    resolve: { alias: rendererAlias },
    plugins: [react(), contentSecurityPolicy()],
    worker: { format: "es" },
    build: { chunkSizeWarningLimit: 12000 },
  },
});
