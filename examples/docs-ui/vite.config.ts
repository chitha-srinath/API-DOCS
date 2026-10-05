import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The example API (examples/basic) runs on API_TARGET. These paths are proxied so the page
// can read the spec and call endpoints from the same origin.
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:3111';
const API_PATHS = [
  '/openapi.json',
  '/health',
  '/widgets',
  '/widgets-plain',
  '/events',
  '/dummy',
  '/secure',
  '/uploads',
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    proxy: Object.fromEntries(API_PATHS.map((p) => [p, { target: API_TARGET, changeOrigin: true }])),
  },
});
