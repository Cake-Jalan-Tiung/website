import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        site: 'index.html',
        menu: 'menu.html',
        designSystem: 'design-system.html',
      },
    },
  },
});
