import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests run in Node, not the Workers runtime, so they skip the Cloudflare and TanStack Start plugins.
export default defineConfig({plugins: [react()]});
